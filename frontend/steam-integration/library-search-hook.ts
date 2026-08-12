import { afterPatch } from '@steambrew/client';

import { normalizeSearchText } from '../../shared/normalize';
import type { Logger } from '../../shared/logger';
import type { LibrarySearchIndex } from '../library/search';
import type { CleanupHandle, SteamLibraryStoreLike } from './types';

type SearchTextMethod = SteamLibraryStoreLike['SetSearchText'];
type PatchTarget = Record<PropertyKey, unknown> & { SetSearchText: SearchTextMethod };

const activeHooks = new WeakMap<SteamLibraryStoreLike, CleanupHandle>();

interface PreparedTarget {
  target: PatchTarget;
  restoreDescriptor(): void;
}

function preparePatchTarget(store: SteamLibraryStoreLike): PreparedTarget {
  const descriptor = Object.getOwnPropertyDescriptor(store, 'SetSearchText');
  if (descriptor && 'value' in descriptor && typeof descriptor.value === 'function') {
    if (descriptor.writable) return { target: store as unknown as PatchTarget, restoreDescriptor: () => undefined };
  }
  if ((!descriptor || descriptor.configurable) && Object.isExtensible(store)) {
    // Steam 2026 resolves this MobX action through a read-only inherited/accessor slot.
    // Shadow it with a temporary writable own property so Millennium's official patcher
    // can compose safely, then restore the exact pre-patch shape during cleanup.
    Object.defineProperty(store, 'SetSearchText', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? false,
      writable: true,
      value: store.SetSearchText,
    });
    return {
      target: store as unknown as PatchTarget,
      restoreDescriptor: () => {
        if (descriptor) Object.defineProperty(store, 'SetSearchText', descriptor);
        else delete (store as unknown as Record<PropertyKey, unknown>).SetSearchText;
      },
    };
  }
  throw new TypeError('Steam SetSearchText is not safely patchable');
}

export function installLibrarySearchHook(
  store: SteamLibraryStoreLike,
  searchIndex: LibrarySearchIndex,
  logger: Logger,
): CleanupHandle {
  const existing = activeHooks.get(store);
  if (existing) {
    logger.debug('library search hook already installed');
    return existing;
  }

  const prepared = preparePatchTarget(store);
  const patch = afterPatch(prepared.target, 'SetSearchText', function (this: SteamLibraryStoreLike, [query], result) {
    const currentStore = this as SteamLibraryStoreLike;
    const normalized = normalizeSearchText(query);
    if (normalized && currentStore.currentAppFilter?.SetSearchSuggestions) {
      const appIds = searchIndex.search(normalized, searchIndex.size).map(({ item }) => item.appId);
      currentStore.currentAppFilter.SetSearchSuggestions(new Set(appIds));
      logger.debug('library pinyin matches applied', { query: normalized, matches: appIds.length });
    }
    return result;
  });

  logger.info('library search hook mounted');

  let cleaned = false;
  const handle: CleanupHandle = {
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      if (!patch.hasUnpatched) patch.unpatch();
      prepared.restoreDescriptor();
      activeHooks.delete(store);
      logger.debug('library search hook removed');
    },
  };
  activeHooks.set(store, handle);
  return handle;
}
