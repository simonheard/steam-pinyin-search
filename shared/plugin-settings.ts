export const STORE_SEARCH_ENABLED_KEY = 'storeSearchEnabled';
export const STORE_SERVER_URL_KEY = 'storeServerUrl';

export interface StorePluginSettings {
  enabled: boolean;
  remoteServer: string | null;
}

export function normalizeServerUrl(value: string | null | undefined): string | null {
  const configured = value?.trim();
  if (!configured) return null;
  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new TypeError('Server URL must use http or https');
  return parsed.origin + parsed.pathname.replace(/\/$/, '');
}

export function readStorePluginSettings(value: unknown): StorePluginSettings {
  if (typeof value === 'string') {
    try {
      return readStorePluginSettings(JSON.parse(value) as unknown);
    } catch {
      return { enabled: true, remoteServer: null };
    }
  }
  if (typeof value !== 'object' || value === null) return { enabled: true, remoteServer: null };
  const settings = value as Record<string, unknown>;
  const enabled = settings[STORE_SEARCH_ENABLED_KEY] !== false;
  const rawServer = settings[STORE_SERVER_URL_KEY];
  let remoteServer: string | null = null;
  if (typeof rawServer === 'string') {
    try {
      remoteServer = normalizeServerUrl(rawServer);
    } catch {
      remoteServer = null;
    }
  }
  return { enabled, remoteServer };
}
