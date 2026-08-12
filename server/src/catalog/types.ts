import type { StoreGameIndex } from '../../../shared/types.js';

export interface CatalogApp {
  appId: number;
  name: string;
  localizedName?: string;
  type: string;
  aliases: string[];
  lastModified?: number;
}

export interface CatalogPage {
  apps: Array<Pick<CatalogApp, 'appId' | 'name' | 'lastModified'>>;
  lastAppId: number | null;
  hasMore: boolean;
}

export interface CatalogSource {
  fetchPage(options: { lastAppId?: number; ifModifiedSince?: number }): Promise<CatalogPage>;
}

export interface LocalizedDetails {
  localizedName?: string;
  type?: string;
}

export interface CatalogDetailsAdapter {
  getDetails(appId: number): Promise<LocalizedDetails | null>;
}

export interface CatalogRepository {
  close(): void;
  getApp(appId: number): CatalogApp | null;
  listApps(): CatalogApp[];
  upsertApps(apps: readonly CatalogApp[]): void;
  getState(key: string): string | null;
  setState(key: string, value: string): void;
}

export interface CatalogSearchSnapshot {
  generatedAt: string;
  games: StoreGameIndex[];
}
