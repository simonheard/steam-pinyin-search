export interface SteamAppOverviewLike {
  appid: number | string;
  display_name: string;
  app_type?: number;
  visible_in_game_list?: boolean;
  BIsShortcut?: () => boolean;
}

export interface SteamAppStoreLike {
  allApps: SteamAppOverviewLike[];
}

export interface SteamLibraryFilterLike {
  searchText: string;
  SetSearchSuggestions(suggestions: Set<number>): void;
}

export interface SteamLibraryStoreLike {
  currentAppFilter: SteamLibraryFilterLike;
  SetSearchText(query: string): Promise<void> | void;
}

export interface SteamGlobals {
  appStore: SteamAppStoreLike;
  libraryStore: SteamLibraryStoreLike;
}

export interface CleanupHandle {
  cleanup(): void;
}
