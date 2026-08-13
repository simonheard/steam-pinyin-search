import { normalizeSearchText } from '../../shared/normalize';
import type { Logger } from '../../shared/logger';
import type { LibrarySearchIndex } from '../library/search';
import type { LibraryRemoteAliasSearch } from '../library/remote-alias-search';
import type { CleanupHandle, SteamLibraryStoreLike } from './types';

export const LIBRARY_SEARCH_SELECTORS = [
  '.SearchInput input.DialogInput[type="text"]',
  '.LeftListSizableContainer .SearchInput input[type="text"]',
] as const;

export function findLibrarySearchInput(document: Document): HTMLInputElement | null {
  for (const selector of LIBRARY_SEARCH_SELECTORS) {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (input) return input;
  }
  return null;
}

export function installLibrarySearchInputHook(
  input: HTMLInputElement,
  store: SteamLibraryStoreLike,
  searchIndex: LibrarySearchIndex,
  logger: Logger,
  remoteAliasSearch?: LibraryRemoteAliasSearch,
): CleanupHandle {
  let searchGeneration = 0;
  const onInput = (): void => {
    const query = normalizeSearchText(input.value);
    const appIds = query ? searchIndex.search(query, searchIndex.size).map(({ item }) => item.appId) : [];
    store.currentAppFilter.SetSearchSuggestions(new Set(appIds));
    logger.debug('library pinyin matches applied', { query, matches: appIds.length });
    const generation = ++searchGeneration;
    if (!query) {
      remoteAliasSearch?.cancel();
      return;
    }
    void remoteAliasSearch?.search(query).then((remoteAppIds) => {
      if (generation !== searchGeneration) return;
      store.currentAppFilter.SetSearchSuggestions(new Set([...appIds, ...remoteAppIds]));
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) logger.debug('library remote alias search failed', error);
    });
  };

  // Capture runs before Steam's delegated React onChange. Steam then executes its
  // unmodified SetSearchText path with our suggestion IDs already available.
  input.addEventListener('input', onInput, true);
  logger.info('library search input fallback mounted');
  return {
    cleanup: () => {
      input.removeEventListener('input', onInput, true);
      searchGeneration += 1;
      remoteAliasSearch?.cancel();
      logger.debug('library search input fallback removed');
    },
  };
}
