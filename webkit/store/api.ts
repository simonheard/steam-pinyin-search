import { normalizeSearchText } from '../../shared/normalize';
import type { StoreSearchResponse } from '../../shared/types';
import { LruCache } from './lru';

const DEFAULT_TIMEOUT_MS = 1_500;

export class StoreSearchTimeoutError extends Error {
  override readonly name = 'StoreSearchTimeoutError';
}

function isStoreSearchResponse(value: unknown): value is StoreSearchResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoreSearchResponse>;
  return (
    typeof candidate.query === 'string' &&
    Array.isArray(candidate.results) &&
    candidate.results.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.appid === 'number' &&
        typeof item.name === 'string' &&
        typeof item.score === 'number',
    )
  );
}

export class StoreSearchClient {
  readonly #cache = new LruCache<string, StoreSearchResponse>(50);
  #activeController: AbortController | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async search(rawQuery: string, limit = 10): Promise<StoreSearchResponse> {
    const query = normalizeSearchText(rawQuery);
    if (query.length < 2) return { query, results: [] };
    const cacheKey = `${query}:${limit}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    this.#activeController?.abort();
    const controller = new AbortController();
    this.#activeController = controller;
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const url = new URL('/api/search', this.baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(limit));
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Store search returned HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!isStoreSearchResponse(body)) throw new TypeError('Store search returned an invalid response');
      this.#cache.set(cacheKey, body);
      return body;
    } catch (error) {
      if (timedOut && error instanceof DOMException && error.name === 'AbortError') {
        throw new StoreSearchTimeoutError(`Store search timed out after ${this.timeoutMs} ms`);
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeout);
      if (this.#activeController === controller) this.#activeController = null;
    }
  }

  cancel(): void {
    this.#activeController?.abort();
    this.#activeController = null;
  }
}
