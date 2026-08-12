import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildServer } from '../server/src/app';
import { MemoryCatalogRepository } from '../server/src/catalog/memory-repository';
import type { CatalogDetailsAdapter, CatalogSource } from '../server/src/catalog/types';
import { syncCatalog } from '../server/src/catalog/sync';
import { SteamStoreServiceCatalogSource } from '../server/src/catalog/steam-store-service';

const openApps: Array<ReturnType<typeof buildServer> extends Promise<infer T> ? T : never> = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function testServer() {
  const repository = new MemoryCatalogRepository([
    { appId: 1, name: 'Black Myth: Wukong', localizedName: '黑神话：悟空', type: 'game', aliases: [] },
    { appId: 2, name: 'Romance of the Three Kingdoms XIV', localizedName: '三国志14', type: 'game', aliases: [] },
    { appId: 3, name: 'Cyberpunk 2077', type: 'game', aliases: ['2077'] },
    { appId: 4, name: 'A Soundtrack', type: 'soundtrack', aliases: [] },
  ]);
  const app = await buildServer(repository);
  openApps.push(app);
  return app;
}

describe('store search API', () => {
  it('returns ranked pinyin results', async () => {
    const app = await testServer();
    const response = await app.inject({ method: 'GET', url: '/api/search?q=hshwk&limit=10' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ query: 'hshwk', results: [{ appid: 1, localizedName: '黑神话：悟空' }] });
  });

  it('supports unicode and limit', async () => {
    const app = await testServer();
    const response = await app.inject({ method: 'GET', url: `/api/search?q=${encodeURIComponent('三国')}&limit=1` });
    expect(response.statusCode).toBe(200);
    expect(response.json().results).toHaveLength(1);
    expect(response.json().results[0].appid).toBe(2);
  });

  it.each(['/api/search', '/api/search?q=', '/api/search?q=test&limit=0', '/api/search?q=test&limit=51', '/api/search?q=test&limit=nope'])(
    'rejects invalid request %s',
    async (url) => {
      const app = await testServer();
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(400);
    },
  );

  it('filters non-game catalog rows', async () => {
    const app = await testServer();
    const response = await app.inject({ method: 'GET', url: '/api/search?q=soundtrack' });
    expect(response.json().results).toEqual([]);
  });
});

describe('catalog sync', () => {
  it('uses the public Steam Web API host for community API keys', async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      void input;
      return new Response(JSON.stringify({ response: { apps: [], have_more_results: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const source = new SteamStoreServiceCatalogSource('test-key', fetchMock as unknown as typeof fetch);

    await source.fetchPage({});

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(new URL(requestedUrl).host).toBe('api.steampowered.com');
  });

  it('paginates, enriches, and records a successful sync', async () => {
    const repository = new MemoryCatalogRepository();
    const source: CatalogSource = {
      async fetchPage({ lastAppId }) {
        if (!lastAppId) return { apps: [{ appId: 1, name: 'Black Myth: Wukong', lastModified: 10 }], lastAppId: 1, hasMore: true };
        return { apps: [{ appId: 2, name: 'Cyberpunk 2077', lastModified: 11 }], lastAppId: 2, hasMore: false };
      },
    };
    const details: CatalogDetailsAdapter = {
      async getDetails(appId) {
        return appId === 1 ? { localizedName: '黑神话：悟空', type: 'game' } : { type: 'game' };
      },
    };
    const result = await syncCatalog(repository, source, details);
    expect(result).toMatchObject({ fetched: 2, written: 2, enriched: 2 });
    expect(repository.listApps()).toHaveLength(2);
    expect(repository.getApp(1)?.localizedName).toBe('黑神话：悟空');
    expect(repository.getState('catalog.last_successful_sync')).not.toBeNull();
  });
});
