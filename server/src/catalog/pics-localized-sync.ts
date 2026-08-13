import SteamUser from 'steam-user';

import type { CatalogRepository } from './types.js';

const LAST_SUCCESSFUL_SYNC_KEY = 'catalog.pics_last_successful_sync';
const CHECKPOINT_KEY = 'catalog.pics_checkpoint_appid';

export interface PicsLocalizedSyncOptions {
  batchSize?: number;
  full?: boolean;
  onProgress?: (progress: PicsLocalizedSyncProgress) => void;
}

export interface PicsLocalizedSyncProgress {
  scanned: number;
  localized: number;
  changed: number;
  lastAppId: number;
}

export interface PicsLocalizedSyncResult extends PicsLocalizedSyncProgress {
  candidates: number;
  startedAt: number;
  completedAt: number;
}

export interface PicsClient {
  connect(): Promise<void>;
  getSimplifiedChineseNames(appIds: readonly number[]): Promise<Map<number, string>>;
  close(): void;
}

function readLocalizedName(appInfo: unknown): string | null {
  if (typeof appInfo !== 'object' || appInfo === null) return null;
  const common = (appInfo as { appinfo?: { common?: unknown } }).appinfo?.common;
  if (typeof common !== 'object' || common === null) return null;
  const names = (common as { name_localized?: unknown }).name_localized;
  if (typeof names !== 'object' || names === null) return null;
  const value = (names as Record<string, unknown>).schinese;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

class AnonymousSteamPicsClient implements PicsClient {
  readonly #client = new SteamUser({ dataDirectory: null, autoRelogin: false });

  constructor() {
    // Keep EventEmitter's special `error` event handled after initial logon;
    // individual PICS requests still reject their returned promises.
    this.#client.on('error', () => {});
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Steam PICS anonymous logon timed out')), 30_000);
      const cleanup = (): void => {
        clearTimeout(timeout);
        this.#client.removeListener('loggedOn', onLoggedOn);
        this.#client.removeListener('error', onError);
      };
      const onLoggedOn = (): void => {
        cleanup();
        resolve();
      };
      const onError = (error: Error): void => {
        cleanup();
        reject(error);
      };
      this.#client.once('loggedOn', onLoggedOn);
      this.#client.once('error', onError);
      this.#client.logOn({ anonymous: true });
    });
  }

  async getSimplifiedChineseNames(appIds: readonly number[]): Promise<Map<number, string>> {
    const result = await this.#client.getProductInfo([...appIds], [], false);
    const names = new Map<number, string>();
    for (const [rawAppId, app] of Object.entries(result.apps)) {
      const localizedName = readLocalizedName(app);
      const appId = Number(rawAppId);
      if (localizedName && Number.isSafeInteger(appId)) names.set(appId, localizedName);
    }
    return names;
  }

  close(): void {
    this.#client.logOff();
  }
}

export async function syncPicsLocalizedNames(
  repository: CatalogRepository,
  options: PicsLocalizedSyncOptions = {},
  client: PicsClient = new AnonymousSteamPicsClient(),
): Promise<PicsLocalizedSyncResult> {
  const startedAt = Math.floor(Date.now() / 1000);
  const batchSize = options.batchSize ?? 500;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2_000) throw new RangeError('PICS batch size must be between 1 and 2000');
  const lastSuccessfulSync = Number(repository.getState(LAST_SUCCESSFUL_SYNC_KEY) ?? 0);
  const checkpoint = Number(repository.getState(CHECKPOINT_KEY) ?? 0);
  const candidates = repository
    .listApps()
    .filter((app) => app.appId > checkpoint && (options.full || !lastSuccessfulSync || (app.lastModified ?? 0) >= lastSuccessfulSync));
  let scanned = 0;
  let localized = 0;
  let changed = 0;
  let lastAppId = checkpoint;

  await client.connect();
  try {
    for (let offset = 0; offset < candidates.length; offset += batchSize) {
      const batch = candidates.slice(offset, offset + batchSize);
      const names = await client.getSimplifiedChineseNames(batch.map((app) => app.appId));
      const updates = batch.flatMap((app) => {
        const localizedName = names.get(app.appId);
        if (!localizedName || localizedName === app.localizedName) return [];
        return [{ ...app, localizedName }];
      });
      if (updates.length) repository.upsertApps(updates);
      scanned += batch.length;
      localized += names.size;
      changed += updates.length;
      lastAppId = batch.at(-1)?.appId ?? lastAppId;
      repository.setState(CHECKPOINT_KEY, String(lastAppId));
      options.onProgress?.({ scanned, localized, changed, lastAppId });
    }
  } finally {
    client.close();
  }

  const completedAt = Math.floor(Date.now() / 1000);
  repository.setState(LAST_SUCCESSFUL_SYNC_KEY, String(completedAt));
  repository.setState(CHECKPOINT_KEY, '0');
  return { candidates: candidates.length, scanned, localized, changed, lastAppId, startedAt, completedAt };
}
