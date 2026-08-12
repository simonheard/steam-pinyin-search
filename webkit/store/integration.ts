import { createLogger } from '../../shared/logger';
import { normalizeSearchText } from '../../shared/normalize';
import { findStoreSearchElements } from '../steam-integration/store-search-elements';
import { StoreSearchDropdown } from './dropdown';
import type { LocalStoreCatalogEntry } from './local';
import { HybridStoreSearchClient, readConfiguredApiBaseUrl, writeConfiguredApiBaseUrl } from './provider';

const DEBOUNCE_MS = 200;
const logger = createLogger(localStorage.getItem('steam-pinyin-search:debug') === '1');

export interface StoreIntegrationHandle {
  cleanup(): void;
  isConnected(): boolean;
  configureRemoteServer(url: string | null): void;
  importLocalCatalog(entries: LocalStoreCatalogEntry[] | { games: LocalStoreCatalogEntry[] }): number;
  clearLocalCatalog(): void;
  status(): { mode: 'local' | 'remote'; localGames: number; remoteServer: string | null };
}

export function installStoreSearch(): StoreIntegrationHandle | null {
  const elements = findStoreSearchElements();
  if (!elements) return null;

  const apiBaseUrl = readConfiguredApiBaseUrl();
  const client = new HybridStoreSearchClient(apiBaseUrl);
  const dropdown = new StoreSearchDropdown(elements.anchor);
  let debounceTimer: number | null = null;

  const onInput = (): void => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    client.cancel();
    const query = normalizeSearchText(elements.input.value);
    if (query.length < 2) {
      dropdown.hide();
      return;
    }

    debounceTimer = window.setTimeout(() => {
      void client
        .search(query, 10)
        .then(({ response, source }) => {
          if (source === 'local-fallback') logger.debug('remote store request failed; using local catalog');
          if (normalizeSearchText(elements.input.value) === query) dropdown.render(response, source);
        })
        .catch((error: unknown) => {
          dropdown.hide();
          if (error instanceof DOMException && error.name === 'AbortError') return;
          logger.debug('store request failed', error);
        });
    }, DEBOUNCE_MS);
  };

  const onDocumentPointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && target !== elements.input && !dropdown.contains(target)) dropdown.hide();
  };

  elements.input.addEventListener('input', onInput);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  window.addEventListener('resize', dropdown.reposition);
  window.addEventListener('scroll', dropdown.reposition, true);
  logger.info('store hook mounted', { mode: client.mode, localGames: client.local.size });

  return {
    isConnected: () => elements.input.isConnected && elements.anchor.isConnected,
    configureRemoteServer(url) {
      writeConfiguredApiBaseUrl(url);
    },
    importLocalCatalog(entries) {
      return client.local.importCatalog(entries);
    },
    clearLocalCatalog() {
      client.local.clear();
    },
    status() {
      return { mode: client.mode, localGames: client.local.size, remoteServer: apiBaseUrl };
    },
    cleanup() {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      client.cancel();
      elements.input.removeEventListener('input', onInput);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      window.removeEventListener('resize', dropdown.reposition);
      window.removeEventListener('scroll', dropdown.reposition, true);
      dropdown.destroy();
    },
  };
}
