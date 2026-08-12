import type { CatalogDetailsAdapter, LocalizedDetails } from './types.js';

interface AppDetailsEnvelope {
  success?: boolean;
  data?: {
    name?: unknown;
    type?: unknown;
  };
}

export class SteamUnofficialLocalizedDetailsAdapter implements CatalogDetailsAdapter {
  #lastRequestAt = 0;

  constructor(
    private readonly minimumDelayMs = 300,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async getDetails(appId: number): Promise<LocalizedDetails | null> {
    const waitMs = Math.max(0, this.#lastRequestAt + this.minimumDelayMs - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.#lastRequestAt = Date.now();

    const url = new URL('https://store.steampowered.com/api/appdetails');
    url.searchParams.set('appids', String(appId));
    url.searchParams.set('l', 'schinese');
    const response = await this.fetchImplementation(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'SteamPinyinSearch/0.1 (+https://github.com/simonheard/steam-pinyin-search)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Record<string, AppDetailsEnvelope>;
    const details = body[String(appId)];
    if (!details?.success || !details.data) return null;
    return {
      ...(typeof details.data.name === 'string' && details.data.name.trim() ? { localizedName: details.data.name.trim() } : {}),
      ...(typeof details.data.type === 'string' ? { type: details.data.type } : {}),
    };
  }
}
