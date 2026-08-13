import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildServer } from '../server/src/app';
import { MemoryCatalogRepository } from '../server/src/catalog/memory-repository';
import type { CatalogDetailsAdapter, CatalogSource } from '../server/src/catalog/types';
import { syncCatalog } from '../server/src/catalog/sync';
import { SteamStoreServiceCatalogSource } from '../server/src/catalog/steam-store-service';
import { applyAliasDataset } from '../server/src/catalog/curated-aliases';
import { syncPicsLocalizedNames, type PicsClient } from '../server/src/catalog/pics-localized-sync';
import { syncWikidataAliases } from '../server/src/catalog/wikidata-alias-sync';

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
  it('imports Simplified Chinese names from PICS in resumable batches', async () => {
    const repository = new MemoryCatalogRepository([
      { appId: 1, name: 'One', type: 'game', aliases: [], lastModified: 10 },
      { appId: 2, name: 'Two', type: 'game', aliases: [], lastModified: 11 },
      { appId: 3, name: 'Three', type: 'game', aliases: [], lastModified: 12 },
    ]);
    const requested: number[][] = [];
    const client: PicsClient = {
      async connect() {},
      async getSimplifiedChineseNames(appIds) {
        requested.push([...appIds]);
        return new Map(appIds.map((appId) => [appId, `中文${appId}`]));
      },
      close() {},
    };
    const result = await syncPicsLocalizedNames(repository, { batchSize: 2, full: true }, client);
    expect(requested).toEqual([[1, 2], [3]]);
    expect(result).toMatchObject({ candidates: 3, scanned: 3, localized: 3, changed: 3 });
    expect(repository.getApp(2)?.localizedName).toBe('中文2');
    expect(repository.getState('catalog.pics_checkpoint_appid')).toBe('0');
    expect(repository.getState('catalog.pics_last_successful_sync')).not.toBeNull();
  });

  it('keeps its checkpoint when a bounded PICS session has more work', async () => {
    const repository = new MemoryCatalogRepository(
      Array.from({ length: 5 }, (_, index) => ({ appId: index + 1, name: `Game ${index + 1}`, type: 'game', aliases: [] })),
    );
    const client: PicsClient = {
      async connect() {},
      async getSimplifiedChineseNames() {
        return new Map();
      },
      close() {},
    };
    const result = await syncPicsLocalizedNames(repository, { batchSize: 2, maxAppsPerSession: 2, full: true }, client);
    expect(result).toMatchObject({ candidates: 5, scanned: 2, complete: false, remaining: 3, lastAppId: 2 });
    expect(repository.getState('catalog.pics_checkpoint_appid')).toBe('2');
    expect(repository.getState('catalog.pics_last_successful_sync')).toBeNull();
  });

  it('adds CC0 Wikidata labels and aliases without replacing a Steam localized title', async () => {
    const repository = new MemoryCatalogRepository([
      { appId: 1, name: 'One', localizedName: 'Steam 中文名', type: 'game', aliases: [] },
      { appId: 2, name: 'Two', type: 'game', aliases: [] },
    ]);
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.hostname === 'query.wikidata.org') {
        return Response.json({
          results: {
            bindings: [
              { item: { value: 'http://www.wikidata.org/entity/Q1' }, appid: { value: '1' } },
              { item: { value: 'http://www.wikidata.org/entity/Q2' }, appid: { value: '2' } },
            ],
          },
        });
      }
      return Response.json({
        entities: {
          Q1: { labels: { 'zh-cn': { value: '社区中文名' } }, aliases: { zh: [{ value: '俗名' }] } },
          Q2: { labels: { zh: { value: '游戏二' } }, aliases: {} },
        },
      });
    });
    const result = await syncWikidataAliases(repository, { fetchImpl: fetchMock as unknown as typeof fetch });
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('query')).toContain('LIMIT 200000');
    expect(result).toMatchObject({ mappings: 2, entities: 2, matched: 2, changed: 2, localizedAdded: 1, aliasesAdded: 2 });
    expect(repository.getApp(1)).toMatchObject({ localizedName: 'Steam 中文名', aliases: ['社区中文名', '俗名'] });
    expect(repository.getApp(2)).toMatchObject({ localizedName: '游戏二', aliases: [] });
    expect(repository.getState('catalog.wikidata_checkpoint_entity')).toBe('');
  });

  it('merges curated names and aliases without creating missing catalog rows', () => {
    const repository = new MemoryCatalogRepository([{ appId: 1245620, name: 'ELDEN RING', type: 'game', aliases: ['ER'] }]);
    const result = applyAliasDataset(repository, {
      schemaVersion: 1,
      games: [
        { appId: 1245620, localizedName: '艾尔登法环', aliases: ['老头环', '法环'] },
        { appId: 999999, localizedName: 'Missing', aliases: [] },
      ],
    });
    expect(result).toEqual({ matched: 1, missing: 1, changed: 1 });
    expect(repository.getApp(1245620)).toMatchObject({ localizedName: '艾尔登法环', aliases: ['ER', '老头环', '法环'] });
    expect(repository.getApp(999999)).toBeNull();
  });

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
