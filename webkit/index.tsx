import { installStoreSearch, type StoreIntegrationHandle } from './store/integration';

const GLOBAL_KEY = '__steamPinyinSearchWebkit';

interface GlobalState {
  cleanup(): void;
}

type PluginGlobal = typeof globalThis & { [GLOBAL_KEY]?: GlobalState };

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

  const cleanup = (): void => {
    observer.disconnect();
    integration?.cleanup();
    integration = null;
    window.removeEventListener('beforeunload', cleanup);
    if (scope[GLOBAL_KEY]?.cleanup === cleanup) delete scope[GLOBAL_KEY];
  };
  scope[GLOBAL_KEY] = { cleanup };
  window.addEventListener('beforeunload', cleanup, { once: true });
}
