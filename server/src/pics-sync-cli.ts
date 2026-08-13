import { applyAliasDataset, loadAliasDataset } from './catalog/curated-aliases.js';
import { syncPicsLocalizedNames } from './catalog/pics-localized-sync.js';
import { SqliteCatalogRepository } from './catalog/sqlite-repository.js';
import { readServerConfig } from './config.js';

const config = readServerConfig();
const repository = new SqliteCatalogRepository(config.databasePath);
try {
  const result = await syncPicsLocalizedNames(repository, {
    full: process.argv.includes('--full'),
    onProgress(progress) {
      if (progress.scanned % 5_000 === 0) console.info('[SteamPinyinSearch] PICS progress', progress);
    },
  });
  const aliases = applyAliasDataset(repository, await loadAliasDataset(config.aliasesPath));
  console.info('[SteamPinyinSearch] PICS localized sync complete', result);
  console.info('[SteamPinyinSearch] curated aliases applied', aliases);
} finally {
  repository.close();
}
