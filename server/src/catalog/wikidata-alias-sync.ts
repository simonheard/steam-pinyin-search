import type { CatalogRepository } from './types.js';

const WDQS_ENDPOINT = 'https://query.wikidata.org/sparql';
const ENTITY_ENDPOINT = 'https://www.wikidata.org/w/api.php';
const USER_AGENT = 'SteamPinyinSearch/0.1 (https://github.com/simonheard/steam-pinyin-search)';
const LAST_SUCCESSFUL_SYNC_KEY = 'catalog.wikidata_last_successful_sync';
const CHECKPOINT_KEY = 'catalog.wikidata_checkpoint_entity';
const LANGUAGES = ['zh-cn', 'zh-hans', 'zh'] as const;

interface SparqlValue {
  value: string;
}

interface SparqlResponse {
  results?: { bindings?: Array<{ item?: SparqlValue; appid?: SparqlValue }> };
}

interface WikidataText {
  value: string;
}

interface WikidataEntity {
  labels?: Record<string, WikidataText>;
  aliases?: Record<string, WikidataText[]>;
}

interface EntityResponse {
  entities?: Record<string, WikidataEntity>;
}

export interface WikidataAliasSyncResult {
  mappings: number;
  entities: number;
  matched: number;
  changed: number;
  localizedAdded: number;
  aliasesAdded: number;
}

export interface WikidataAliasSyncOptions {
  fetchImpl?: typeof fetch;
  onProgress?: (processed: number, total: number) => void;
}

async function fetchJson<T>(url: URL, fetchImpl: typeof fetch): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delaySeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : Math.min(60, 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1_000));
        continue;
      }
      if (!response.ok) throw new Error(`Wikidata request failed with HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, 1_000 * 2 ** attempt)));
    }
  }
  throw lastError;
}

async function loadSteamMappings(fetchImpl: typeof fetch): Promise<Map<string, number[]>> {
  const mappings = new Map<string, number[]>();
  const resultLimit = 200_000;
  const query = `SELECT ?item ?appid WHERE { ?item wdt:P1733 ?appid. } LIMIT ${resultLimit}`;
  const url = new URL(WDQS_ENDPOINT);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);
  const response = await fetchJson<SparqlResponse>(url, fetchImpl);
  const rows = response.results?.bindings ?? [];
  if (rows.length >= resultLimit) throw new Error(`Wikidata Steam AppID mapping reached its safety limit of ${resultLimit}`);
  for (const row of rows) {
    const entityId = row.item?.value.match(/\/entity\/(Q\d+)$/)?.[1];
    const appId = Number(row.appid?.value);
    if (!entityId || !Number.isSafeInteger(appId) || appId <= 0) continue;
    const ids = mappings.get(entityId) ?? [];
    if (!ids.includes(appId)) ids.push(appId);
    mappings.set(entityId, ids);
  }
  return mappings;
}

function chineseTexts(entity: WikidataEntity): { label?: string; aliases: string[] } {
  const label = LANGUAGES.map((language) => entity.labels?.[language]?.value.trim()).find(Boolean);
  const aliases = LANGUAGES.flatMap((language) => entity.aliases?.[language] ?? [])
    .map(({ value }) => value.trim())
    .filter(Boolean);
  return { ...(label ? { label } : {}), aliases: [...new Set(aliases)] };
}

export async function syncWikidataAliases(
  repository: CatalogRepository,
  options: WikidataAliasSyncOptions = {},
): Promise<WikidataAliasSyncResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mappings = await loadSteamMappings(fetchImpl);
  const entityIds = [...mappings.keys()];
  const checkpoint = repository.getState(CHECKPOINT_KEY);
  const checkpointIndex = checkpoint ? entityIds.indexOf(checkpoint) : -1;
  const pendingEntityIds = checkpointIndex >= 0 ? entityIds.slice(checkpointIndex + 1) : entityIds;
  let matched = 0;
  let changed = 0;
  let localizedAdded = 0;
  let aliasesAdded = 0;

  const entityBatchSize = 50;
  for (let offset = 0; offset < pendingEntityIds.length; offset += entityBatchSize) {
    const batch = pendingEntityIds.slice(offset, offset + entityBatchSize);
    const url = new URL(ENTITY_ENDPOINT);
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', batch.join('|'));
    url.searchParams.set('props', 'labels|aliases');
    url.searchParams.set('languages', LANGUAGES.join('|'));
    url.searchParams.set('languagefallback', '1');
    url.searchParams.set('format', 'json');
    const response = await fetchJson<EntityResponse>(url, fetchImpl);
    {
      const updates = [];
      for (const entityId of batch) {
        const entity = response.entities?.[entityId];
        if (!entity) continue;
        const texts = chineseTexts(entity);
        for (const appId of mappings.get(entityId) ?? []) {
          const existing = repository.getApp(appId);
          if (!existing) continue;
          matched += 1;
          const localizedName = existing.localizedName ?? texts.label;
          const additions = [...(texts.label ? [texts.label] : []), ...texts.aliases].filter(
            (value) => value !== existing.name && value !== localizedName,
          );
          const aliases = [...new Set([...existing.aliases, ...additions])];
          const didChange = localizedName !== existing.localizedName || aliases.length !== existing.aliases.length;
          if (!didChange) continue;
          if (!existing.localizedName && localizedName) localizedAdded += 1;
          aliasesAdded += aliases.length - existing.aliases.length;
          changed += 1;
          updates.push({ ...existing, ...(localizedName ? { localizedName } : {}), aliases });
        }
      }
      if (updates.length) repository.upsertApps(updates);
    }
    repository.setState(CHECKPOINT_KEY, batch.at(-1) ?? '');
    const processed = checkpointIndex + 1 + Math.min(offset + batch.length, pendingEntityIds.length);
    options.onProgress?.(processed, entityIds.length);
    if (offset + batch.length < pendingEntityIds.length) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  repository.setState(LAST_SUCCESSFUL_SYNC_KEY, String(Math.floor(Date.now() / 1000)));
  repository.setState(CHECKPOINT_KEY, '');
  return { mappings: [...mappings.values()].reduce((sum, ids) => sum + ids.length, 0), entities: entityIds.length, matched, changed, localizedAdded, aliasesAdded };
}
