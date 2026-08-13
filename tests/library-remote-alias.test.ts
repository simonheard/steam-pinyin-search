import { afterEach, describe, expect, it, vi } from 'vitest';

import { LibraryRemoteAliasSearchClient } from '../frontend/library/remote-alias-search';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Library remote alias search', () => {
  it('sends only the query and keeps only locally owned AppIDs', async () => {
    const fetchMock = vi.fn<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>(async () => Response.json({
      query: 'laotouhuan',
      results: [
        { appid: 1245620, name: 'ELDEN RING', score: 930 },
        { appid: 999, name: 'Not owned', score: 500 },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new LibraryRemoteAliasSearchClient('https://search.example.test', new Set([1245620]), undefined, 0, 500);

    await expect(client.search('老头环')).resolves.toEqual([1245620]);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/api/search');
    expect(url.searchParams.get('q')).toBe('老头环');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.has('appids')).toBe(false);
    expect(init).toMatchObject({ credentials: 'omit' });
  });

  it('does not request one-character or empty queries', async () => {
    const fetchMock = vi.fn<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(Response.json({})));
    vi.stubGlobal('fetch', fetchMock);
    const client = new LibraryRemoteAliasSearchClient('https://search.example.test', new Set([1]), undefined, 0, 500);
    await expect(client.search('环')).resolves.toEqual([]);
    await expect(client.search('')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
