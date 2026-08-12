import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreSearchClient, StoreSearchTimeoutError } from '../webkit/store/api';
import { LocalStoreSearchClient } from '../webkit/store/local';
import { LruCache } from '../webkit/store/lru';
import { HybridStoreSearchClient, readConfiguredApiBaseUrl, writeConfiguredApiBaseUrl } from '../webkit/store/provider';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('store client', () => {
  it('does not request queries shorter than two normalized characters', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new StoreSearchClient('https://example.test').search('h')).resolves.toEqual({ query: 'h', results: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts a request when its timeout expires', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      ),
    );
    const pending = new StoreSearchClient('https://example.test', 20).search('heishen');
    const rejected = expect(pending).rejects.toBeInstanceOf(StoreSearchTimeoutError);
    await vi.advanceTimersByTimeAsync(20);
    await rejected;
  });

  it('reuses successful cached results', async () => {
    const response = { query: 'heishen', results: [{ appid: 1, name: 'Test', score: 90 }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    const client = new StoreSearchClient('https://example.test');
    await client.search('heishen');
    await client.search('heishen');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('LRU cache', () => {
  it('evicts the least recently used item', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });
});

describe('local store mode', () => {
  it('searches an imported pinyin catalog without network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const local = new LocalStoreSearchClient(memoryStorage());
    local.importCatalog([
      { appid: 1, name: 'Black Myth: Wukong', localizedName: '黑神话：悟空' },
      { appid: 2, name: 'Romance of the Three Kingdoms XIV', localizedName: '三国志14' },
    ]);
    const result = await new HybridStoreSearchClient(null, local).search('hshwk');
    expect(result).toMatchObject({ source: 'local', response: { results: [{ appid: 1 }] } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists remote results for a later local-only session', async () => {
    const storage = memoryStorage();
    const local = new LocalStoreSearchClient(storage);
    local.remember({ query: 'sgz', results: [{ appid: 2, name: 'Three Kingdoms', localizedName: '三国志14', score: 920 }] });
    const reloaded = new LocalStoreSearchClient(storage);
    await expect(reloaded.search('sgz')).resolves.toMatchObject({ results: [{ appid: 2 }] });
  });

  it('falls back to the local catalog when a configured server fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const local = new LocalStoreSearchClient(memoryStorage());
    local.importCatalog([{ appid: 1, name: 'Black Myth: Wukong', localizedName: '黑神话：悟空' }]);
    const result = await new HybridStoreSearchClient('https://example.test', local).search('hshwk');
    expect(result).toMatchObject({ source: 'local-fallback', response: { results: [{ appid: 1 }] } });
  });

  it('falls back locally on timeout while preserving active-query cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      ),
    );
    const local = new LocalStoreSearchClient(memoryStorage());
    local.importCatalog([{ appid: 1, name: 'Black Myth: Wukong', localizedName: '黑神话：悟空' }]);
    const pending = new HybridStoreSearchClient('https://example.test', local, 20).search('hshwk');
    await vi.advanceTimersByTimeAsync(20);
    await expect(pending).resolves.toMatchObject({ source: 'local-fallback', response: { results: [{ appid: 1 }] } });
  });

  it('treats a missing or invalid server setting as local mode', () => {
    const storage = memoryStorage();
    expect(readConfiguredApiBaseUrl(storage)).toBeNull();
    writeConfiguredApiBaseUrl('https://search.example.com/', storage);
    expect(readConfiguredApiBaseUrl(storage)).toBe('https://search.example.com');
    storage.setItem('steam-pinyin-search:api-base-url', 'file:///tmp/search');
    expect(readConfiguredApiBaseUrl(storage)).toBeNull();
    writeConfiguredApiBaseUrl(null, storage);
    expect(readConfiguredApiBaseUrl(storage)).toBeNull();
  });
});
