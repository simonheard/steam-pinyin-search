import type { CatalogApp, CatalogRepository } from './types.js';

const WDQS_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'SteamPinyinSearch/0.1 (https://github.com/simonheard/steam-pinyin-search)';
const LAST_SUCCESSFUL_SYNC_KEY = 'catalog.wikidata_last_successful_sync';
const LEGACY_CHECKPOINT_KEY = 'catalog.wikidata_checkpoint_entity';
const LANGUAGES = ['zh-cn', 'zh-hans', 'zh'] as const;

interface SparqlValue {
  value: string;
  'xml:lang'?: string;
}

interface SparqlBinding {
  item?: SparqlValue;
  appid?: SparqlValue;
  label?: SparqlValue;
  alias?: SparqlValue;
}

interface SparqlResponse {
  results?: { bindings?: SparqlBinding[] };
}

interface ChineseEntityData {
  appIds: Set<number>;
  labels: Map<string, string>;
  aliases: Set<string>;
}

export interface WikidataAliasSyncResult {
  mappings: number;
  entities: number;
  matched: number;
  changed: number;
  localizedAdded: number;
  aliasesAdded: number;
  staleLocalizedRemoved: number;
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

async function loadChineseEntities(fetchImpl: typeof fetch): Promise<Map<string, ChineseEntityData>> {
  const resultLimit = 200_000;
  const languages = LANGUAGES.map((language) => `"${language}"`).join(', ');
  const query = `SELECT ?item ?appid ?label ?alias WHERE { ?item wdt:P1733 ?appid. { ?item rdfs:label ?label. FILTER(LANG(?label) IN (${languages})) } UNION { ?item skos:altLabel ?alias. FILTER(LANG(?alias) IN (${languages})) } } LIMIT ${resultLimit}`;
  const url = new URL(WDQS_ENDPOINT);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);
  const response = await fetchJson<SparqlResponse>(url, fetchImpl);
  const rows = response.results?.bindings ?? [];
  if (rows.length >= resultLimit) throw new Error(`Wikidata Chinese Steam metadata reached its safety limit of ${resultLimit}`);
  const entities = new Map<string, ChineseEntityData>();
  for (const row of rows) {
    const entityId = row.item?.value.match(/\/entity\/(Q\d+)$/)?.[1];
    const appId = Number(row.appid?.value);
    if (!entityId || !Number.isSafeInteger(appId) || appId <= 0) continue;
    const entity = entities.get(entityId) ?? { appIds: new Set<number>(), labels: new Map<string, string>(), aliases: new Set<string>() };
    entity.appIds.add(appId);
    if (row.label?.value.trim()) entity.labels.set(row.label['xml:lang'] ?? '', row.label.value.trim());
    if (row.alias?.value.trim()) entity.aliases.add(row.alias.value.trim());
    entities.set(entityId, entity);
  }
  return entities;
}

function preferredLabel(entity: ChineseEntityData): string | undefined {
  return LANGUAGES.map((language) => entity.labels.get(language)).find(Boolean);
}

export async function syncWikidataAliases(
  repository: CatalogRepository,
  options: WikidataAliasSyncOptions = {},
): Promise<WikidataAliasSyncResult> {
  const entities = await loadChineseEntities(options.fetchImpl ?? fetch);
  let matched = 0;
  let changed = 0;
  let localizedAdded = 0;
  let aliasesAdded = 0;
  let staleLocalizedRemoved = 0;
  let processed = 0;
  let pendingUpdates: CatalogApp[] = [];

  for (const app of repository.listApps()) {
    if (!app.localizedName || /\p{Script=Han}/u.test(app.localizedName)) continue;
    const withoutLocalizedName = { ...app };
    delete withoutLocalizedName.localizedName;
    pendingUpdates.push(withoutLocalizedName);
    staleLocalizedRemoved += 1;
    if (pendingUpdates.length >= 500) {
      repository.upsertApps(pendingUpdates);
      pendingUpdates = [];
    }
  }
  if (pendingUpdates.length) {
    repository.upsertApps(pendingUpdates);
    pendingUpdates = [];
  }

  for (const entity of entities.values()) {
    const label = preferredLabel(entity);
    for (const appId of entity.appIds) {
      const existing = repository.getApp(appId);
      if (!existing) continue;
      matched += 1;
      const localizedName = existing.localizedName ?? label;
      const additions = [...(label ? [label] : []), ...entity.aliases].filter(
        (value) => value !== existing.name && value !== localizedName,
      );
      const aliases = [...new Set([...existing.aliases, ...additions])];
      if (localizedName === existing.localizedName && aliases.length === existing.aliases.length) continue;
      if (!existing.localizedName && localizedName) localizedAdded += 1;
      aliasesAdded += aliases.length - existing.aliases.length;
      changed += 1;
      pendingUpdates.push({ ...existing, ...(localizedName ? { localizedName } : {}), aliases });
    }
    processed += 1;
    if (pendingUpdates.length >= 500) {
      repository.upsertApps(pendingUpdates);
      pendingUpdates = [];
    }
    if (processed % 500 === 0) options.onProgress?.(processed, entities.size);
  }
  if (pendingUpdates.length) repository.upsertApps(pendingUpdates);
  options.onProgress?.(processed, entities.size);
  repository.setState(LAST_SUCCESSFUL_SYNC_KEY, String(Math.floor(Date.now() / 1000)));
  repository.setState(LEGACY_CHECKPOINT_KEY, '');
  return {
    mappings: [...entities.values()].reduce((sum, entity) => sum + entity.appIds.size, 0),
    entities: entities.size,
    matched,
    changed,
    localizedAdded,
    aliasesAdded,
    staleLocalizedRemoved,
  };
}
