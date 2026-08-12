import { scoreGame } from './ranking';
import type { SearchableGame, SearchResult } from './types';

export function searchGames<T extends SearchableGame>(games: readonly T[], query: string, limit = 50): SearchResult<T>[] {
  if (limit <= 0) return [];

  return games
    .map((item) => {
      const match = scoreGame(item, query);
      return { item, score: match.score, matchedField: match.field } satisfies SearchResult<T>;
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, 'zh-CN'))
    .slice(0, limit);
}
