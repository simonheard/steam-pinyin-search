import { createLogger } from '../../shared/logger';
import { normalizeSearchText } from '../../shared/normalize';
import { findStoreSearchElements } from '../steam-integration/store-search-elements';
import { StoreSearchClient } from './api';
import { StoreSearchDropdown } from './dropdown';

const DEBOUNCE_MS = 200;
const logger = createLogger(localStorage.getItem('steam-pinyin-search:debug') === '1');

export interface StoreIntegrationHandle {
  cleanup(): void;
  isConnected(): boolean;
}

export function installStoreSearch(): StoreIntegrationHandle | null {
  const elements = findStoreSearchElements();
  if (!elements) return null;

  const apiBaseUrl = localStorage.getItem('steam-pinyin-search:api-base-url') ?? 'http://127.0.0.1:8787';
  const client = new StoreSearchClient(apiBaseUrl);
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
        .then((response) => {
          if (normalizeSearchText(elements.input.value) === query) dropdown.render(response);
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
  logger.info('store hook mounted');

  return {
    isConnected: () => elements.input.isConnected && elements.anchor.isConnected,
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
