import type { Logger } from '../../shared/logger';
import type { LibraryGameIndex, LibraryGameSource } from '../../shared/types';
import { persistLibraryCache, readLibraryCache, updateLibraryCache, type KeyValueStorage } from './cache';

export interface LibraryIndexBuild {
  games: LibraryGameIndex[];
  elapsedMs: number;
  cacheLoaded: boolean;
  added: number;
  updated: number;
  removed: number;
  reused: number;
}

export function buildLibraryIndex(
  sources: readonly LibraryGameSource[],
  storage: KeyValueStorage,
  pluginVersion: string,
  logger?: Logger,
): LibraryIndexBuild {
  const startedAt = performance.now();
  const previous = readLibraryCache(storage, pluginVersion);
  const result = updateLibraryCache(sources, previous, pluginVersion);
  const persisted = persistLibraryCache(storage, result.cache);
  const elapsedMs = performance.now() - startedAt;

  logger?.debug('index updated', {
    games: result.games.length,
    elapsedMs,
    cacheLoaded: previous !== null,
    persisted,
    added: result.added,
    updated: result.updated,
    removed: result.removed,
    reused: result.reused,
  });

  return {
    games: result.games,
    elapsedMs,
    cacheLoaded: previous !== null,
    added: result.added,
    updated: result.updated,
    removed: result.removed,
    reused: result.reused,
  };
}
