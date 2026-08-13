import { normalizeServerUrl, readStorePluginSettings, type StorePluginSettings } from '../shared/plugin-settings';

const MIRRORED_SERVER_URL_KEY = 'steam-pinyin-search:store-server-url';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readMirroredServerUrl(storage: StorageLike): string | null {
  try {
    return normalizeServerUrl(storage.getItem(MIRRORED_SERVER_URL_KEY));
  } catch {
    return null;
  }
}

export function writeMirroredServerUrl(storage: StorageLike, value: string): void {
  const normalized = normalizeServerUrl(value);
  if (normalized) storage.setItem(MIRRORED_SERVER_URL_KEY, normalized);
  else storage.removeItem(MIRRORED_SERVER_URL_KEY);
}

export function isMillenniumConfigAcknowledgementError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('json.exception.type_error.302') || message.includes('Unexpected end of JSON input');
}

export function readBoundStoreSettings(bindSettings: () => unknown): StorePluginSettings {
  try {
    return readStorePluginSettings(bindSettings());
  } catch {
    return { enabled: true, remoteServer: null };
  }
}

export async function persistSettingWithReadback<T>(
  write: (value: T) => Promise<void>,
  read: () => Promise<T>,
  value: T,
): Promise<void> {
  try {
    await write(value);
  } catch (writeError) {
    // Millennium 3.4 can persist a config value and then reject while parsing
    // an empty IPC acknowledgement. Treat a matching readback as success.
    try {
      if (Object.is(await read(), value)) return;
    } catch {
      // Preserve the original write error; it is the actionable failure.
    }
    throw writeError;
  }
}
