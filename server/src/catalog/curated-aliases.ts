import { readFile } from 'node:fs/promises';

import type { CatalogRepository } from './types.js';

interface AliasEntry {
  appId: number;
  localizedName?: string;
  aliases: string[];
}

interface AliasDataset {
  schemaVersion: number;
  games: AliasEntry[];
}

export interface AliasImportResult {
  matched: number;
  missing: number;
  changed: number;
}

function parseAliasDataset(value: unknown): AliasDataset {
  if (typeof value !== 'object' || value === null) throw new TypeError('Alias dataset must be an object');
  const candidate = value as Partial<AliasDataset>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.games)) throw new TypeError('Unsupported alias dataset schema');
  const games = candidate.games.map((entry) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !Number.isSafeInteger(entry.appId) ||
      (entry as AliasEntry).appId <= 0 ||
      !Array.isArray(entry.aliases) ||
      !entry.aliases.every((alias) => typeof alias === 'string' && alias.trim()) ||
      (entry.localizedName !== undefined && (typeof entry.localizedName !== 'string' || !entry.localizedName.trim()))
    ) {
      throw new TypeError('Invalid alias dataset entry');
    }
    return {
      appId: entry.appId,
      ...(entry.localizedName ? { localizedName: entry.localizedName.trim() } : {}),
      aliases: [...new Set(entry.aliases.map((alias) => alias.trim()))],
    };
  });
  return { schemaVersion: 1, games };
}

export async function loadAliasDataset(filename: string): Promise<AliasDataset> {
  return parseAliasDataset(JSON.parse(await readFile(filename, 'utf8')) as unknown);
}

export function applyAliasDataset(repository: CatalogRepository, dataset: AliasDataset): AliasImportResult {
  let matched = 0;
  let missing = 0;
  let changed = 0;
  for (const entry of dataset.games) {
    const existing = repository.getApp(entry.appId);
    if (!existing) {
      missing += 1;
      continue;
    }
    matched += 1;
    const aliases = [...new Set([...existing.aliases, ...entry.aliases])];
    const localizedName = entry.localizedName ?? existing.localizedName;
    if (localizedName === existing.localizedName && aliases.length === existing.aliases.length) continue;
    repository.upsertApps([{ ...existing, ...(localizedName ? { localizedName } : {}), aliases }]);
    changed += 1;
  }
  return { matched, missing, changed };
}
