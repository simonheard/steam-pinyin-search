import { describe, expect, it } from 'vitest';

import { indexLibraryGame } from '../shared/index-game';

describe('pinyin indexing', () => {
  it('indexes full pinyin, compact pinyin, and initials', () => {
    const game = indexLibraryGame({ appId: 1, name: '黑神话：悟空' });
    expect(game.normalized).toBe('黑神话悟空');
    expect(game.pinyinCompact).toBe('heishenhuawukong');
    expect(game.pinyinFull).toBe('hei shen hua wu kong');
    expect(game.initials).toBe('hshwk');
  });

  it('uses phrase-aware default pronunciation', () => {
    expect(indexLibraryGame({ appId: 2, name: '重庆' }).pinyinCompact).toBe('chongqing');
    expect(indexLibraryGame({ appId: 3, name: '音乐' }).pinyinCompact).toBe('yinyue');
    expect(indexLibraryGame({ appId: 4, name: '银行' }).pinyinCompact).toBe('yinhang');
  });

  it('does not create pinyin fields for English-only names', () => {
    const game = indexLibraryGame({ appId: 5, name: 'Counter-Strike 2' });
    expect(game.pinyinCompact).toBe('');
    expect(game.initials).toBe('');
  });
});
