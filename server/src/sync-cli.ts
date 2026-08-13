import { SqliteCatalogRepository } from './catalog/sqlite-repository.js';
import { applyAliasDataset, loadAliasDataset } from './catalog/curated-aliases.js';
import { SteamStoreServiceCatalogSource } from './catalog/steam-store-service.js';
import { SteamUnofficialLocalizedDetailsAdapter } from './catalog/store-details-adapter.js';
import { syncCatalog } from './catalog/sync.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const repository = new SqliteCatalogRepository(config.databasePath);
try {
  const source = new SteamStoreServiceCatalogSource(config.steamWebApiKey);
  const details = config.enableLocalizedDetails ? new SteamUnofficialLocalizedDetailsAdapter() : undefined;
  const result = await syncCatalog(repository, source, details);
  console.info('[SteamPinyinSearch] catalog sync complete', result);
  const aliases = applyAliasDataset(repository, await loadAliasDataset(config.aliasesPath));
  console.info('[SteamPinyinSearch] curated aliases applied', aliases);
} finally {
  repository.close();
}
