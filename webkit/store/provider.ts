import type { StoreSearchResponse } from '../../shared/types';
import { StoreSearchClient } from './api';
import { LocalStoreSearchClient } from './local';
import { getWebkitStorage } from '../storage';

export const STORE_API_BASE_URL_KEY = 'steam-pinyin-search:api-base-url';

export type StoreSearchSource = 'local' | 'remote' | 'local-fallback';

export interface StoreSearchResult {
  response: StoreSearchResponse;
  source: StoreSearchSource;
}

export function readConfiguredApiBaseUrl(storage: Pick<Storage, 'getItem'> = getWebkitStorage()): string | null {
  const configured = storage.getItem(STORE_API_BASE_URL_KEY)?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin + url.pathname.replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

export function writeConfiguredApiBaseUrl(
  url: string | null,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = getWebkitStorage(),
): string | null {
  const configured = url?.trim();
  if (!configured) {
    storage.removeItem(STORE_API_BASE_URL_KEY);
    return null;
  }
  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new TypeError('Remote server must use http or https');
  const normalized = parsed.origin + parsed.pathname.replace(/\/$/, '');
  storage.setItem(STORE_API_BASE_URL_KEY, normalized);
  return normalized;
}

export class HybridStoreSearchClient {
  readonly #remote: StoreSearchClient | null;

  constructor(
    baseUrl: string | null,
    readonly local = new LocalStoreSearchClient(),
    timeoutMs?: number,
  ) {
    this.#remote = baseUrl ? new StoreSearchClient(baseUrl, timeoutMs) : null;
  }

  get mode(): 'local' | 'remote' {
    return this.#remote ? 'remote' : 'local';
  }

  async search(rawQuery: string, limit = 10): Promise<StoreSearchResult> {
    if (!this.#remote) return { response: await this.local.search(rawQuery, limit), source: 'local' };
    try {
      const response = await this.#remote.search(rawQuery, limit);
      this.local.remember(response);
      return { response, source: 'remote' };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      return { response: await this.local.search(rawQuery, limit), source: 'local-fallback' };
    }
  }

  cancel(): void {
    this.#remote?.cancel();
  }
}
