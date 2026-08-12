import { indexStoreGame } from '../../shared/index-game';
import { normalizeSearchText } from '../../shared/normalize';
import { searchGames } from '../../shared/search';
import type { StoreGameIndex, StoreSearchResponse } from '../../shared/types';

export const LOCAL_STORE_CATALOG_KEY = 'steam-pinyin-search:local-store-catalog:v1';
const LOCAL_STORE_SCHEMA_VERSION = 1;
const MAX_LOCAL_GAMES = 10_000;

export interface LocalStoreCatalogEntry {
  appid: number;
  name: string;
  localizedName?: string;
  aliases?: string[];
}

interface StoredLocalCatalog {
  schemaVersion: number;
  generatedAt: string;
  games: LocalStoreCatalogEntry[];
}

function parseEntry(value: unknown): LocalStoreCatalogEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<LocalStoreCatalogEntry>;
  if (!Number.isSafeInteger(candidate.appid) || typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
  const localizedName = typeof candidate.localizedName === 'string' && candidate.localizedName.trim() ? candidate.localizedName.trim() : undefined;
  const aliases = Array.isArray(candidate.aliases)
    ? candidate.aliases.filter((alias): alias is string => typeof alias === 'string' && Boolean(normalizeSearchText(alias)))
    : undefined;
  return {
    appid: candidate.appid as number,
    name: candidate.name.trim(),
    ...(localizedName ? { localizedName } : {}),
    ...(aliases?.length ? { aliases } : {}),
  };
}

function parseCatalog(value: unknown): LocalStoreCatalogEntry[] {
  let rawGames: unknown[] = [];
  if (Array.isArray(value)) rawGames = value;
  else if (typeof value === 'object' && value !== null) {
    const games = (value as Partial<StoredLocalCatalog>).games;
    if (Array.isArray(games)) rawGames = games;
  }
  return rawGames.flatMap((game) => {
    const parsed = parseEntry(game);
    return parsed ? [parsed] : [];
  });
}

function toIndex(entry: LocalStoreCatalogEntry): StoreGameIndex {
  return indexStoreGame({
    appId: entry.appid,
    name: entry.name,
    localizedName: entry.localizedName,
    aliases: entry.aliases ?? [],
    type: 'game',
  });
}

export class LocalStoreSearchClient {
  readonly #entries = new Map<number, LocalStoreCatalogEntry>();
  #games: StoreGameIndex[] = [];

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
    this.#load();
  }

  get size(): number {
    return this.#games.length;
  }

  async search(rawQuery: string, limit = 10): Promise<StoreSearchResponse> {
    const query = normalizeSearchText(rawQuery);
    if (query.length < 2 || limit <= 0) return { query, results: [] };
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

  remember(response: StoreSearchResponse): number {
    const entries = response.results.map((result) => ({
      appid: result.appid,
      name: result.name,
      ...(result.localizedName ? { localizedName: result.localizedName } : {}),
    }));
    return this.importCatalog(entries);
  }

  importCatalog(input: unknown): number {
    for (const entry of parseCatalog(input)) {
      this.#entries.delete(entry.appid);
      this.#entries.set(entry.appid, entry);
    }
    while (this.#entries.size > MAX_LOCAL_GAMES) {
      const oldest = this.#entries.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
    this.#rebuild();
    this.#persist();
    return this.size;
  }

  clear(): void {
    this.#entries.clear();
    this.#games = [];
    this.storage.removeItem(LOCAL_STORE_CATALOG_KEY);
  }

  #load(): void {
    const stored = this.storage.getItem(LOCAL_STORE_CATALOG_KEY);
    if (!stored) return;
    try {
      for (const entry of parseCatalog(JSON.parse(stored) as unknown)) this.#entries.set(entry.appid, entry);
      this.#rebuild();
    } catch {
      this.storage.removeItem(LOCAL_STORE_CATALOG_KEY);
    }
  }

  #rebuild(): void {
    this.#games = [...this.#entries.values()].map(toIndex);
  }

  #persist(): void {
    const catalog: StoredLocalCatalog = {
      schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      games: [...this.#entries.values()],
    };
    try {
      this.storage.setItem(LOCAL_STORE_CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      // A full browser storage quota must never affect Steam's native search.
    }
  }
}
