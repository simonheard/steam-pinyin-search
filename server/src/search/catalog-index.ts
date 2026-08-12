import { indexStoreGame } from '../../../shared/index-game.js';
import { searchGames } from '../../../shared/search.js';
import type { StoreSearchResponse } from '../../../shared/types.js';
import type { CatalogRepository } from '../catalog/types.js';

export class CatalogSearchIndex {
  #games;

  constructor(private readonly repository: CatalogRepository) {
    this.#games = this.#load();
  }

  #load() {
    return this.repository.listApps().map(indexStoreGame);
  }

  refresh(): number {
    this.#games = this.#load();
    return this.#games.length;
  }

  search(query: string, limit: number): StoreSearchResponse {
    return {
      query,
      results: searchGames(this.#games, query, limit).map(({ item, score }) => ({
        appid: item.appId,
        name: item.name,
        ...(item.localizedName ? { localizedName: item.localizedName } : {}),
        score,
      })),
    };
  }
}
