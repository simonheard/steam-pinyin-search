import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoreSearchClient } from '../webkit/store/api';
import { LruCache } from '../webkit/store/lru';

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
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
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
