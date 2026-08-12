export interface LibraryGameSource {
  appId: number;
  name: string;
}

export interface SearchableGame {
  appId: number;
  name: string;
  localizedName?: string;
  normalized: string;
  normalizedName: string;
  pinyinFull: string;
  pinyinCompact: string;
  initials: string;
  pinyinVariants: string[];
  aliases: string[];
}

export type LibraryGameIndex = SearchableGame;

export interface StoreGameIndex extends SearchableGame {
  type: string;
  lastModified?: number;
}

export interface SearchResult<T extends SearchableGame = SearchableGame> {
  item: T;
  score: number;
  matchedField: MatchField;
}

export type MatchField =
  | 'name-exact'
  | 'normalized-exact'
  | 'pinyin-exact'
  | 'initials-exact'
  | 'name-prefix'
  | 'pinyin-prefix'
  | 'initials-prefix'
  | 'alias-prefix'
  | 'substring';

export interface StoreSearchResponse {
  query: string;
  results: Array<{
    appid: number;
    name: string;
    localizedName?: string;
    score: number;
  }>;
}
