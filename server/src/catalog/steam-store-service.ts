import type { CatalogPage, CatalogSource } from './types.js';

interface SteamStoreApp {
  appid?: unknown;
  name?: unknown;
  last_modified?: unknown;
}

interface SteamStoreResponse {
  response?: {
    apps?: unknown;
    have_more_results?: unknown;
    last_appid?: unknown;
  };
}

export class SteamStoreServiceCatalogSource implements CatalogSource {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error('STEAM_WEB_API_KEY is required for catalog synchronization');
  }

  async fetchPage(options: { lastAppId?: number; ifModifiedSince?: number }): Promise<CatalogPage> {
    const input = {
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: 50_000,
      ...(options.lastAppId ? { last_appid: options.lastAppId } : {}),
      ...(options.ifModifiedSince ? { if_modified_since: options.ifModifiedSince } : {}),
    };
    const url = new URL('https://partner.steam-api.com/IStoreService/GetAppList/v1/');
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('input_json', JSON.stringify(input));
    const response = await this.fetchImplementation(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Steam IStoreService/GetAppList returned HTTP ${response.status}`);
    const body = (await response.json()) as SteamStoreResponse;
    const rawApps = Array.isArray(body.response?.apps) ? (body.response.apps as SteamStoreApp[]) : [];
    const apps = rawApps.flatMap((app) => {
      if (!Number.isSafeInteger(app.appid) || typeof app.name !== 'string' || !app.name.trim()) return [];
      return [
        {
          appId: app.appid as number,
          name: app.name.trim(),
          ...(typeof app.last_modified === 'number' ? { lastModified: app.last_modified } : {}),
        },
      ];
    });
    const responseLastAppId = body.response?.last_appid;
    const fallbackLastAppId = apps.at(-1)?.appId ?? null;
    return {
      apps,
      lastAppId: Number.isSafeInteger(responseLastAppId) ? (responseLastAppId as number) : fallbackLastAppId,
      hasMore: body.response?.have_more_results === true,
    };
  }
}
