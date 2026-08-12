import { describe, expect, it } from 'vitest';

import { indexLibraryGame } from '../shared/index-game';
import { searchGames } from '../shared/search';

const games = [
  indexLibraryGame({ appId: 1, name: '黑神话：悟空' }),
  indexLibraryGame({ appId: 2, name: '三国志14' }),
  indexLibraryGame({ appId: 3, name: '戴森球计划' }),
  indexLibraryGame({ appId: 4, name: '潜水员戴夫' }),
  indexLibraryGame({ appId: 5, name: 'Counter-Strike 2' }),
  indexLibraryGame({ appId: 6, name: 'Cyberpunk 2077' }),
];

describe('ranking', () => {
  it.each([
    ['heishenhuawukong', 1],
    ['hshwk', 1],
    ['sanguozhi', 2],
    ['sgz14', 2],
    ['daisenqiu', 3],
    ['dsq', 3],
    ['qianshuiyuan', 4],
    ['qsy', 4],
    ['counter strike 2', 5],
    ['2077', 6],
  ])('ranks %s first', (query, expectedAppId) => {
    expect(searchGames(games, query, 10)[0]?.item.appId).toBe(expectedAppId);
  });

  it('prioritizes an exact match over a substring match', () => {
    const results = searchGames(games, '黑神话', 10);
    expect(results[0]?.item.appId).toBe(1);
    expect(results[0]?.score).toBeGreaterThan(0);
  });
});
