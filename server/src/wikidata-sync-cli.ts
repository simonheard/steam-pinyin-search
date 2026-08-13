import { applyAliasDataset, loadAliasDataset } from './catalog/curated-aliases.js';
import { SqliteCatalogRepository } from './catalog/sqlite-repository.js';
import { syncWikidataAliases } from './catalog/wikidata-alias-sync.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const repository = new SqliteCatalogRepository(config.databasePath);
try {
  const result = await syncWikidataAliases(repository, {
    onProgress(processed, total) {
      if (processed % 500 === 0 || processed === total) console.info('[SteamPinyinSearch] Wikidata progress', { processed, total });
    },
  });
  const aliases = applyAliasDataset(repository, await loadAliasDataset(config.aliasesPath));
  console.info('[SteamPinyinSearch] Wikidata alias sync complete', result);
  console.info('[SteamPinyinSearch] curated aliases applied', aliases);
} finally {
  repository.close();
}
