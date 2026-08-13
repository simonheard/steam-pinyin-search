import { normalizeSearchText } from '../../shared/normalize';
import type { Logger } from '../../shared/logger';
import type { StoreSearchResponse } from '../../shared/types';

const REMOTE_LIMIT = 50;
const DEBOUNCE_MS = 180;
const TIMEOUT_MS = 1_500;

function isSearchResponse(value: unknown): value is StoreSearchResponse {
  if (typeof value !== 'object' || value === null) return false;
  const response = value as Partial<StoreSearchResponse>;
  return (
    typeof response.query === 'string' &&
    Array.isArray(response.results) &&
    response.results.every((result) => typeof result?.appid === 'number' && typeof result.name === 'string' && typeof result.score === 'number')
  );
}

function abortError(): DOMException {
  return new DOMException('Library alias search was superseded', 'AbortError');
}

export interface LibraryRemoteAliasSearch {
  search(query: string): Promise<number[]>;
  cancel(): void;
}

export class LibraryRemoteAliasSearchClient implements LibraryRemoteAliasSearch {
  #activeController: AbortController | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly ownedAppIds: ReadonlySet<number>,
    private readonly logger?: Logger,
    private readonly debounceMs = DEBOUNCE_MS,
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async search(rawQuery: string): Promise<number[]> {
    const query = normalizeSearchText(rawQuery);
    if (query.length < 2) return [];
    this.cancel();
    const controller = new AbortController();
    this.#activeController = controller;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const onAbort = (): void => reject(abortError());
        controller.signal.addEventListener('abort', onAbort, { once: true });
        debounceTimer = setTimeout(() => {
          controller.signal.removeEventListener('abort', onAbort);
          resolve();
        }, this.debounceMs);
      });
      timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);
      const url = new URL('/api/search', this.baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(REMOTE_LIMIT));
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Library alias search returned HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!isSearchResponse(body)) throw new TypeError('Library alias search returned an invalid response');
      const appIds = body.results.map((result) => result.appid).filter((appId) => this.ownedAppIds.has(appId));
      this.logger?.debug('library remote aliases matched', { query, matches: appIds.length });
      return [...new Set(appIds)];
    } finally {
      if (debounceTimer !== undefined) clearTimeout(debounceTimer);
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
      if (this.#activeController === controller) this.#activeController = null;
    }
  }

  cancel(): void {
    this.#activeController?.abort();
    this.#activeController = null;
  }
}
