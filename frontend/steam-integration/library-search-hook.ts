import { normalizeSearchText } from '../../shared/normalize';
import type { Logger } from '../../shared/logger';
import type { LibrarySearchIndex } from '../library/search';
import type { CleanupHandle, SteamLibraryStoreLike } from './types';

const PATCH_MARKER = Symbol.for('steam-pinyin-search.library-hook');

type PatchableLibraryStore = SteamLibraryStoreLike & {
  [PATCH_MARKER]?: true;
};

export function installLibrarySearchHook(
  store: SteamLibraryStoreLike,
  searchIndex: LibrarySearchIndex,
  logger: Logger,
): CleanupHandle {
  const patchable = store as PatchableLibraryStore;
  if (patchable[PATCH_MARKER]) {
    logger.debug('library search hook already installed');
    return { cleanup: () => undefined };
  }

  const original = store.SetSearchText;
  const patched = function patchedSetSearchText(this: SteamLibraryStoreLike, query: string): Promise<void> | void {
    const result = original.call(this, query);
    const normalized = normalizeSearchText(query);
    if (normalized && this.currentAppFilter?.SetSearchSuggestions) {
      const appIds = searchIndex.search(normalized, searchIndex.size).map(({ item }) => item.appId);
      this.currentAppFilter.SetSearchSuggestions(new Set(appIds));
      logger.debug('library pinyin matches applied', { query: normalized, matches: appIds.length });
    }
    return result;
  };

  store.SetSearchText = patched;
  patchable[PATCH_MARKER] = true;
  logger.info('library search hook mounted');

  return {
    cleanup: () => {
      if (store.SetSearchText === patched) store.SetSearchText = original;
      delete patchable[PATCH_MARKER];
      logger.debug('library search hook removed');
    },
  };
}
