import { describe, expect, it, vi } from 'vitest';

vi.mock('@steambrew/client', () => ({
  afterPatch(
    object: Record<PropertyKey, unknown>,
    property: PropertyKey,
    handler: (args: unknown[], result: unknown) => unknown,
  ) {
    const original = object[property] as (...args: unknown[]) => unknown;
    const patched = function (this: unknown, ...args: unknown[]): unknown {
      return handler.call(this, args, original.apply(this, args));
    };
    object[property] = patched;
    return {
      hasUnpatched: false,
      unpatch() {
        object[property] = original;
        this.hasUnpatched = true;
      },
    };
  },
}));

import { LibrarySearchIndex } from '../frontend/library/search';
import { installLibrarySearchHook } from '../frontend/steam-integration/library-search-hook';
import type { SteamLibraryStoreLike } from '../frontend/steam-integration/types';
import { indexLibraryGame } from '../shared/index-game';
import type { Logger } from '../shared/logger';

const logger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('Library search hook', () => {
  it('patches and restores Steam current configurable read-only accessor', () => {
    const setSuggestions = vi.fn();
    const original = vi.fn();
    const store = {
      currentAppFilter: { searchText: '', SetSearchSuggestions: setSuggestions },
    } as unknown as SteamLibraryStoreLike;
    Object.defineProperty(store, 'SetSearchText', {
      configurable: true,
      enumerable: false,
      get: () => original,
    });
    const before = Object.getOwnPropertyDescriptor(store, 'SetSearchText');
    const index = new LibrarySearchIndex([indexLibraryGame({ appId: 1, name: '黑神话：悟空' })]);

    const handle = installLibrarySearchHook(store, index, logger);
    store.SetSearchText('hshwk');
    expect(original).toHaveBeenCalledWith('hshwk');
    expect(setSuggestions).toHaveBeenCalledWith(new Set([1]));

    handle.cleanup();
    expect(Object.getOwnPropertyDescriptor(store, 'SetSearchText')).toEqual(before);
    store.SetSearchText('hshwk');
    expect(setSuggestions).toHaveBeenCalledTimes(1);
  });
});
