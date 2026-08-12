import { describe, expect, it, vi } from 'vitest';

import { LibrarySearchIndex } from '../frontend/library/search';
import { installLibrarySearchInputHook } from '../frontend/steam-integration/library-search-input';
import type { SteamLibraryStoreLike } from '../frontend/steam-integration/types';
import { indexLibraryGame } from '../shared/index-game';
import type { Logger } from '../shared/logger';

const logger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

describe('Library input fallback', () => {
  it('applies suggestions on the original input event and cleans up', () => {
    const listenerState: { current: EventListener | null } = { current: null };
    const input = {
      value: 'hshwk',
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listenerState.current = typeof listener === 'function' ? listener : listener.handleEvent.bind(listener);
      },
      removeEventListener: () => {
        listenerState.current = null;
      },
    } as unknown as HTMLInputElement;
    const setSuggestions = vi.fn();
    const store = {
      currentAppFilter: { searchText: '', SetSearchSuggestions: setSuggestions },
      SetSearchText: vi.fn(),
    } satisfies SteamLibraryStoreLike;
    const index = new LibrarySearchIndex([indexLibraryGame({ appId: 1, name: '黑神话：悟空' })]);

    const handle = installLibrarySearchInputHook(input, store, index, logger);
    if (!listenerState.current) throw new Error('input listener was not installed');
    listenerState.current(new Event('input'));
    expect(setSuggestions).toHaveBeenCalledWith(new Set([1]));

    handle.cleanup();
    expect(listenerState.current).toBeNull();
    expect(setSuggestions).toHaveBeenCalledTimes(1);
  });
});
