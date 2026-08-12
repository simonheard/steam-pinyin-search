import { describe, expect, it } from 'vitest';

import { updateLibraryCache } from '../frontend/library/cache';

describe('library cache diff', () => {
  it('only rebuilds additions and name changes and removes missing apps', () => {
    const first = updateLibraryCache(
      [
        { appId: 1, name: '黑神话：悟空' },
        { appId: 2, name: '三国志14' },
      ],
      null,
      '0.1.0',
    );
    const second = updateLibraryCache(
      [
        { appId: 1, name: '黑神话：悟空' },
        { appId: 3, name: '戴森球计划' },
      ],
      first.cache,
      '0.1.0',
    );

    expect(second).toMatchObject({ added: 1, updated: 0, removed: 1, reused: 1 });
    expect(Object.keys(second.cache.games)).toEqual(['1', '3']);
    expect(second.cache.games['1']).toBe(first.cache.games['1']);
  });

  it('invalidates entries whose localized name changes', () => {
    const first = updateLibraryCache([{ appId: 1, name: '三国志14' }], null, '0.1.0');
    const second = updateLibraryCache([{ appId: 1, name: '三国志 14' }], first.cache, '0.1.0');
    expect(second).toMatchObject({ added: 0, updated: 1, removed: 0, reused: 0 });
  });
});
