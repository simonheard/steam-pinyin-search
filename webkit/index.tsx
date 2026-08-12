import { installStoreSearch, type StoreIntegrationHandle } from './store/integration';
import { LocalStoreSearchClient, type LocalStoreCatalogEntry } from './store/local';
import { readConfiguredApiBaseUrl, writeConfiguredApiBaseUrl } from './store/provider';

const GLOBAL_KEY = '__steamPinyinSearchWebkit';

interface GlobalState {
  cleanup(): void;
}

interface PublicStoreApi {
  configureRemoteServer(url: string | null): void;
  importLocalCatalog(entries: LocalStoreCatalogEntry[] | { games: LocalStoreCatalogEntry[] }): number;
  clearLocalCatalog(): void;
  status(): { mode: 'local' | 'remote'; localGames: number; remoteServer: string | null };
}

type PluginGlobal = typeof globalThis & { [GLOBAL_KEY]?: GlobalState; SteamPinyinSearch?: PublicStoreApi };

export default async function WebkitMain(): Promise<void> {
  const scope = globalThis as PluginGlobal;
  scope[GLOBAL_KEY]?.cleanup();

  let integration: StoreIntegrationHandle | null = null;
  const refresh = (): void => {
    if (integration && !integration.isConnected()) {
      integration.cleanup();
      integration = null;
    }
    integration ??= installStoreSearch();
  };
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();

  scope.SteamPinyinSearch = {
    configureRemoteServer(url) {
      if (integration) integration.configureRemoteServer(url);
      else writeConfiguredApiBaseUrl(url);
      integration?.cleanup();
      integration = null;
      refresh();
    },
    importLocalCatalog(entries) {
      return integration?.importLocalCatalog(entries) ?? new LocalStoreSearchClient().importCatalog(entries);
    },
    clearLocalCatalog() {
      if (integration) integration.clearLocalCatalog();
      else new LocalStoreSearchClient().clear();
    },
    status() {
      if (integration) return integration.status();
      const remoteServer = readConfiguredApiBaseUrl();
      return { mode: remoteServer ? 'remote' : 'local', localGames: new LocalStoreSearchClient().size, remoteServer };
    },
  };

  const cleanup = (): void => {
    observer.disconnect();
    integration?.cleanup();
    integration = null;
    window.removeEventListener('beforeunload', cleanup);
    delete scope.SteamPinyinSearch;
    if (scope[GLOBAL_KEY]?.cleanup === cleanup) delete scope[GLOBAL_KEY];
  };
  scope[GLOBAL_KEY] = { cleanup };
  window.addEventListener('beforeunload', cleanup, { once: true });
}
