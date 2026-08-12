import { searchGames } from '../../shared/search';
import type { LibraryGameIndex, SearchResult } from '../../shared/types';

export class LibrarySearchIndex {
  readonly #games: readonly LibraryGameIndex[];

  constructor(games: readonly LibraryGameIndex[]) {
    this.#games = games;
  }

  get size(): number {
    return this.#games.length;
  }

  search(query: string, limit = 100): SearchResult<LibraryGameIndex>[] {
    return searchGames(this.#games, query, limit);
  }
}
