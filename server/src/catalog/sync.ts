import type { CatalogApp, CatalogDetailsAdapter, CatalogRepository, CatalogSource } from './types.js';

const LAST_SYNC_KEY = 'catalog.last_successful_sync';

export interface SyncResult {
  fetched: number;
  written: number;
  enriched: number;
  startedAt: number;
  completedAt: number;
}

export async function syncCatalog(
  repository: CatalogRepository,
  source: CatalogSource,
  detailsAdapter?: CatalogDetailsAdapter,
): Promise<SyncResult> {
  const startedAt = Math.floor(Date.now() / 1000);
  const previousSync = Number.parseInt(repository.getState(LAST_SYNC_KEY) ?? '', 10);
  const ifModifiedSince = Number.isSafeInteger(previousSync) && previousSync > 0 ? previousSync : undefined;
  let lastAppId: number | undefined;
  let fetched = 0;
  let written = 0;
  let enriched = 0;

  do {
    const page = await source.fetchPage({ lastAppId, ifModifiedSince });
    fetched += page.apps.length;
    const records: CatalogApp[] = [];
    for (const app of page.apps) {
      const existing = repository.getApp(app.appId);
      let localizedName = existing?.localizedName;
      let type = existing?.type ?? 'game';
      const changed = !existing || existing.name !== app.name || existing.lastModified !== app.lastModified;
      if (changed && detailsAdapter) {
        try {
          const details = await detailsAdapter.getDetails(app.appId);
          localizedName = details?.localizedName ?? localizedName;
          type = details?.type ?? type;
          if (details) enriched += 1;
        } catch {
          // Enrichment is optional; retain official catalog data and continue.
        }
      }
      records.push({ appId: app.appId, name: app.name, localizedName, type, aliases: existing?.aliases ?? [], lastModified: app.lastModified });
    }
    repository.upsertApps(records);
    written += records.length;
    if (!page.hasMore || page.lastAppId === null || page.lastAppId === lastAppId) break;
    lastAppId = page.lastAppId;
  } while (true);

  const completedAt = Math.floor(Date.now() / 1000);
  repository.setState(LAST_SYNC_KEY, String(completedAt));
  return { fetched, written, enriched, startedAt, completedAt };
}
