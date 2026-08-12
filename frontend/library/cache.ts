import { indexLibraryGame } from '../../shared/index-game';
import type { LibraryGameIndex, LibraryGameSource } from '../../shared/types';

export const CACHE_SCHEMA_VERSION = 1;
export const CACHE_KEY = 'steam-pinyin-search:library-index:v1';

export interface LibraryIndexCache {
  schemaVersion: number;
  pluginVersion: string;
  generatedAt: string;
  games: Record<string, LibraryGameIndex>;
}

export interface CacheUpdateResult {
  cache: LibraryIndexCache;
  games: LibraryGameIndex[];
  added: number;
  updated: number;
  removed: number;
  reused: number;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readLibraryCache(storage: KeyValueStorage, pluginVersion: string): LibraryIndexCache | null {
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LibraryIndexCache>;
    if (
      parsed.schemaVersion !== CACHE_SCHEMA_VERSION ||
      parsed.pluginVersion !== pluginVersion ||
      typeof parsed.games !== 'object' ||
      parsed.games === null
    ) {
      return null;
    }
    return parsed as LibraryIndexCache;
  } catch {
    return null;
  }
}

export function updateLibraryCache(
  sources: readonly LibraryGameSource[],
  previous: LibraryIndexCache | null,
  pluginVersion: string,
): CacheUpdateResult {
  const games: Record<string, LibraryGameIndex> = {};
  let added = 0;
  let updated = 0;
  let reused = 0;

  for (const source of sources) {
    const key = String(source.appId);
    const cached = previous?.games[key];
    if (cached?.name === source.name) {
      games[key] = cached;
      reused += 1;
      continue;
    }
    games[key] = indexLibraryGame(source);
    if (cached) updated += 1;
    else added += 1;
  }

  const removed = previous ? Object.keys(previous.games).filter((key) => !(key in games)).length : 0;
  const cache: LibraryIndexCache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    pluginVersion,
    generatedAt: new Date().toISOString(),
    games,
  };

  return { cache, games: Object.values(games), added, updated, removed, reused };
}

export function persistLibraryCache(storage: KeyValueStorage, cache: LibraryIndexCache): boolean {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}
