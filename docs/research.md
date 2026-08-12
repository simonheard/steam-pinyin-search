# Steam Pinyin Search — 2026 technical research

## Research metadata

- Research date: 2026-08-12 (America/New_York)
- Target Steam surface: current Windows desktop client installed on the development machine
- Current stable Millennium release: **v3.4.0**, published 2026-08-10
- Current official plugin template commit inspected: `fbe04927f622cbb60909f269f687434574987ff3` (2026-06-08)
- Current Millennium source commit inspected: `816514f939ce8696ae8262b4e0c2123f593db08c` (2026-08-10)
- Current official Plugin Database commit inspected: `6943f52a591942f50c78e37537861dd6a72499f2` (2026-07-29)

This document distinguishes public/stable APIs from Steam internals. Steam internals are not treated as contracts even when Millennium exposes TypeScript types for them.

## Millennium 3.4 plugin architecture

The official 2026 template has three plugin surfaces:

| Directory | Runtime | Purpose |
| --- | --- | --- |
| `frontend/` | Steam UI JavaScript context | TypeScript/React code for the desktop Library and other Steam UI routes |
| `webkit/` | Store/community browser views | Plain TypeScript/DOM code; Steam's React instance is not available here |
| `backend/` | Millennium-managed LuaJIT runtime | Optional native/network/filesystem work; new plugins must use Lua, not Python |

The current template builds with Bun and `millennium-ttc` (`@steambrew/ttc`). It uses `@steambrew/client` for the Steam UI context and `@steambrew/webkit` for browser views. The template currently pins the 5.8.x SDK line and outputs compiled files under `.millennium/Dist`.

The root manifest is `plugin.json`. The fields used by the current template and documentation are:

- `name` (required, stable internal identifier)
- `common_name`, `description`, `version`
- `backendType: "lua"` for a backend
- `useBackend`, `backend`, `frontend` where non-default behavior is needed
- `webkitApiVersion: "2.0.0"` in the current official template
- `include` for packaged extra files

There is a documentation/schema mismatch worth tracking: the schema in the Millennium repository does not currently enumerate every field present in the official template (`backendType`, `webkitApiVersion`). The template is the implementation baseline for those fields.

## Loading, development, and lifecycle

Millennium is loaded with Steam and enabled plugins are loaded as part of that lifecycle. A plugin does not need a Windows service, Electron application, or independent daemon.

On Windows, current runtime source (`src/system/environment.cc`) sets `MILLENNIUM__PLUGINS_PATH` to `<installPath>/plugins`. In the official v3.4.0 binary, `installPath` resolves to `%STEAM%/millennium`, so the verified runtime directory is `%STEAM%/millennium/plugins`. The current quick start says `%STEAM%/plugins` and the filesystem reference says `%STEAM%/plugin`; both documentation paths are stale for the installed v3.4.0 Windows binary. Runtime source plus an actual signed v3.4.0 installation is the implementation authority.

1. Install current stable Millennium.
2. Put or link the plugin under `%STEAM%/millennium/plugins/<plugin-name>` on current Windows v3.4.0.
3. Run `bun install` and `bun run dev` (development build) or `bun run build` (production build).
4. Enable the plugin in Steam Settings → Millennium → Plugins.
5. Reload/restart Steam after structural or backend changes. Frontend development builds are rebuilt by the TTC workflow; Steam DevTools and Millennium logs are the authoritative debugging surfaces.

The Lua backend must call `millennium.ready()` promptly (documentation says within 10 seconds and recommends within 1 second). The current template exposes `on_load`, `on_frontend_loaded`, and `on_unload`. Frontend plugins may return `onDismount()` from `definePlugin()`; every patch, observer, timer, listener, and React root added by this project must be released there. WebKit code must be idempotent because browser navigation/recreation can execute it again.

The development machine currently has Steam installed at `C:\Program Files (x86)\Steam` but does not currently have Millennium installed, so an end-to-end Steam runtime check cannot be claimed until Millennium is installed.

## Hooking and patching Steam React UI

Millennium 3.4 exposes two complementary mechanisms:

1. The `@steambrew/client` runtime patcher (`findModule*`, `afterPatch`, `beforePatch`, `replacePatch`, `createReactTreePatcher`, `wrapReactType`, `injectFCTrampoline`) and `routerHook` for Steam React routes/global components.
2. Lua `patches`, which use constrained RE2 `find`/`file`/`transforms` rules to rewrite a Steam JavaScript response and call explicitly exposed frontend functions through the `#{{self}}` macro.

The official template demonstrates the second mechanism and includes a no-op fallback when the frontend has not initialized. Millennium itself uses semantic properties and function-source fingerprints rather than a single hashed CSS class. Its router hook also stores patch handles and unregisters them during teardown.

Compatibility rules adopted here:

- Prefer stable object behavior and semantic properties over minified export names.
- Keep all Steam coupling in `frontend/steam-integration/` or `webkit/steam-integration/`.
- Use multiple capability checks and fail open.
- Never block or replace Steam's original search request/Enter behavior.
- Store original functions/patch handles and restore them in `onDismount()`.
- Make DOM injection idempotent with a plugin-owned data attribute and disconnect observers on teardown/page unload.
- Log a single diagnostic when an integration point is unavailable; do not repeatedly throw.

## Current Library model and search behavior

The current Steam desktop Library remains a React UI. The installed Steam bundle inspected on 2026-08-12 contains:

- a global `appStore.allApps` collection used by currently curated Millennium plugins;
- `appStore.GetAppOverviewByAppID(appid)` and app overview objects with `appid`, `display_name`, `sort_as`, `app_type`, and visibility fields;
- navigation to `/library/app/{appid}` (current plugins use `SteamUIStore.Navigate`; Millennium's current SDK recommends `Navigation.Navigate`);
- a Library filter object whose `MatchesImpl` checks Steam's server/client suggestion ID sets and its own `setSuggestions` set before falling back to `display_name`, `sort_as`, AppID, and fuzzy text matching;
- `SetSearchSuggestions(Set<number>)` on that filter object;
- `LibraryUIStore.SetSearchText()` creating/updating the current filter while Steam asynchronously fetches its own suggestions.

This gives a materially safer primary integration than replacing the input or matching implementation: patch/observe the Library search update, compute local pinyin matches, and merge their AppIDs into the current filter's plugin-owned suggestion set. Steam continues to own the original input, view, keyboard behavior, result list, and its own remote/client suggestions.

Implementation plan:

1. Read `appStore.allApps` locally after the frontend is ready.
2. Build/diff the pinyin index without transmitting it.
3. Wrap `LibraryUIStore.SetSearchText` (resolved by capabilities, not a minified module name).
4. After the original method runs, call `currentAppFilter.SetSearchSuggestions()` with the locally matched AppIDs.
5. Restore the original method during dismount.
6. If the capability cannot be resolved on a future Steam build, use an adjacent overlay only as a fallback; the MVP must otherwise leave Steam search untouched.

`appStore.allApps`, `LibraryUIStore`, and route details are Steam internals, not stable public APIs. The SDK types only partially cover them. This is the principal compatibility risk.

## Store browser and dropdown integration

Steam Store pages in the desktop client are browser/WebKit views, separate from the Steam Library React tree. Millennium's current supported mechanism is a `webkit/` entry using `@steambrew/webkit`; the Lua API also exposes URL-scoped `millennium.add_browser_js` and `add_browser_css` when explicit modules are needed.

The Store enhancement will therefore be plain DOM code:

- observe for the Store global search input/form through a centralized adapter;
- mount one plugin-owned dropdown adjacent to the search form;
- debounce 200 ms and do nothing below two normalized characters;
- cancel superseded requests with `AbortController` and enforce a 1.5 second timeout;
- retain a small in-memory LRU cache;
- stop event propagation only for interactions inside plugin results;
- never intercept ordinary Enter submission to Steam;
- navigate a selected result using the current client navigation bridge if exposed, otherwise set `window.location.href` to the canonical `https://store.steampowered.com/app/{appid}/` URL. `steam://store/{appid}` remains only a last-resort fallback.

The selector adapter will prefer semantic attributes (`role=search`, form action containing `/search`, named search input) and keep legacy IDs/classes only as fallbacks. Store markup is not a public API and is expected to change.

## Local Library APIs and privacy

There is no documented, stable Millennium-specific public API that promises a complete Library list. The viable current client integration is Steam's in-process `appStore.allApps`, corroborated by the current Steam bundle and current curated plugins. It exposes AppID and the localized display name already selected by the user's Steam language.

The project will not call `IPlayerService/GetOwnedGames`, request a Steam Web API key from the user, read a SteamID, or upload any Library entry. Library indexing and caching remain entirely in the Steam UI origin's local storage. The cache includes `schemaVersion`, `pluginVersion`, `generatedAt`, and an AppID-keyed game map; only additions, deletions, and name changes are regenerated.

Opening a Library game will use `Navigation.Navigate('/library/app/{appid}')` where needed. The primary integration displays results in Steam's existing result list, so normal Steam selection already navigates correctly.

## Public Store catalog APIs

Valve's official documentation now explicitly deprecates:

`GET https://api.steampowered.com/ISteamApps/GetAppList/v2/`

because it no longer scales to Steam's catalog. The documented replacement is:

`GET https://partner.steam-api.com/IStoreService/GetAppList/v1/`

It requires any Steam Web API key and is a Service interface called using `input_json`. It supports:

- pagination by `last_appid` (default 10,000, maximum 50,000 results);
- `include_games`, `include_dlc`, `include_software`, `include_videos`, and `include_hardware` filters;
- `if_modified_since` incremental refreshes;
- `last_modified` and `price_change_number` fields.

The server adapter will use this official endpoint with games enabled and other types disabled. The key is server-only. Synchronization is paged, rate-limited, cached in SQLite, and incremental after the first complete pass.

On 2026-08-12 the deprecated keyless endpoint also returned HTTP 404 to a direct GET check. It therefore cannot safely bootstrap an on-device catalog. The Store plugin now defaults to a persistent local catalog that can be imported and that learns successful results from an explicitly configured remote server. With no server configured it performs no plugin network request; with a configured server it searches remotely first and falls back to the local catalog on network/HTTP/timeout failure. A fresh local catalog is intentionally empty rather than silently using an undocumented endpoint or embedding a user Web API key.

Store enhancement is user-controllable through the plugin's Millennium settings page. The master switch and optional server URL use Millennium 3.4's persistent `usePluginConfig`/`BindPluginSettings` API so the main Steam frontend and Store WebKit views read the same configuration. Turning Store search off skips the observer/UI hook and clears this plugin's local Store catalog on the next Store view load. TTC 3.3.7 currently fails to inject the plugin name into the WebKit `BindPluginSettings` call, so the WebKit adapter passes the stable manifest plugin ID explicitly; the generated production bundle is checked for that binding.

### Localized Chinese names

Steam officially supports localized application names and documents `schinese`/`zh-CN` and `tchinese`/`zh-TW`. However, the documented `IStoreService/GetAppList` response does not promise all localized titles. `have_description_language` is a filter, not a localized-name projection.

Consequently, there is no verified official bulk endpoint in the public documentation that provides every app's Simplified Chinese title. The design uses a separate `CatalogDetailsAdapter`:

1. Ingest AppID/type/base name and modification metadata from official `IStoreService/GetAppList`.
2. Enrich only new/changed game records through a separately configurable details adapter.
3. The default MVP adapter may call the Store's JSON `api/appdetails?appids=...&l=schinese` endpoint, which is widely used but **not documented as a supported Steam Web API**.
4. Apply a low request rate, retry/backoff, durable SQLite cache, and incremental updates; never scrape HTML selectors.
5. If enrichment is disabled or fails, retain the base name and omit pinyin fields rather than inventing a Chinese title.

This limitation means the code and tests can be complete, but a production catalog requires a Steam Web API key and a deliberate decision to enable the unofficial localized-details adapter.

## Pinyin library choice

`pinyin-pro` remains the best fit for the TypeScript frontend/server shared logic:

- current npm version checked on 2026-08-12: **3.28.2**;
- MIT license;
- ESM/TypeScript-friendly and supports tone-free output, arrays, initials, and multiple-pronunciation modes;
- published unpacked package size reported by npm: about 931 KB;
- handles phrase-aware default pronunciation better than a hand-written character map.

The package contains the pronunciation data, so it is not tiny, but it is acceptable for a desktop plugin and avoids shipping a bespoke incomplete database. Only named imports will be used and the production bundle size will be recorded. MVP indexing uses the default phrase-aware pronunciation. Types retain `pinyinVariants: string[]` for a future opt-in heteronym expansion without multiplying the initial index.

## Similar projects checked

- No current Millennium/SteamBrew plugin dedicated to Steam-wide pinyin Library + Store search was found in the official Plugin Database or web/GitHub searches on 2026-08-12.
- Current curated Library plugins (`steam-librarian`, `steam-collections-plus`) confirm `appStore.allApps` and `/library/app/{appid}` navigation, but they use broad `any` declarations and DOM selectors that this project should not copy wholesale.
- Extendium confirms that Store/community features live in the WebKit/browser surface and demonstrates idempotent DOM insertion/observers, but its extension-hosting scope differs from this plugin.
- Search results include game-specific Workshop pinyin mods and third-party Steam metadata modifications; none implements this Millennium architecture, and modifying `appinfo.vdf` is explicitly rejected for this project.

## Adopted MVP architecture

### Plugin

- Official Millennium PluginTemplate layout and TTC/Bun build.
- React/TypeScript frontend for Library integration and settings/status only.
- Local Library index generated with `pinyin-pro`, incrementally cached in `localStorage`.
- Original Library filter enhanced through its existing suggestion-ID set.
- Plain TypeScript WebKit Store adapter and dropdown.
- Local-by-default Store catalog, bounded to 10,000 learned/imported public entries, with the same shared pinyin ranking code.
- Optional user-configured remote Store API with strict timeout, cancellation, local fallback, and fail-open behavior.
- No native plugin backend is needed for the MVP. A Lua backend would add complexity without improving Library privacy or Store reliability.

### Server

- Node.js/TypeScript, matching the shared normalization/ranking types used by the plugin.
- Fastify for a small HTTP API and SQLite for durable catalog/cache state.
- In-memory array index for initial search; benchmark before adding any search engine.
- Official IStoreService adapter for catalog identity/type/incremental metadata.
- Optional isolated Store-details enrichment adapter for Simplified Chinese names.
- `/api/search?q=...&limit=...` returns only public catalog data.

Node/TypeScript was selected over FastAPI so normalization, pinyin conversion, ranking fixtures, and types can be shared exactly between Library and Store code.

## Known risks

1. **Steam Library internals:** `appStore.allApps`, `LibraryUIStore`, and filter methods can change without notice. Capability-based resolution and fail-open behavior are mandatory.
2. **Store DOM:** the global search markup can change independently from the client. All selectors live in one adapter with semantic-first fallbacks.
3. **Localized catalog gap:** Valve does not document a bulk localized-title projection. The optional app-details endpoint is unofficial and must remain isolated, cached, rate-limited, and replaceable.
4. **CORS:** a deployed API must explicitly allow the Steam Store origins used by the desktop browser while avoiding `*` if credentials are ever added (the MVP sends no credentials).
5. **No local Millennium installation:** compilation and automated tests can run here, but actual Steam injection/log verification requires installing Millennium 3.4.0 and enabling the built plugin.
6. **Very recent framework release:** v3.4.0 became stable on 2026-08-10. Minor SDK/template inconsistencies are possible; package versions are pinned and CI should detect drift.
7. **Multi-pronunciation:** default phrase pronunciation is deliberately used for the MVP. Variant expansion is represented in the schema but not enabled broadly due to index growth and ranking noise.
8. **Documentation path mismatch:** the filesystem reference says `%STEAM%/plugin` and quick start says `%STEAM%/plugins`, while the signed v3.4.0 runtime uses `%STEAM%/millennium/plugins`. Packaging follows the verified runtime.

## Key sources

### Millennium / SteamBrew

- Millennium repository and v3.4.0 release: https://github.com/SteamClientHomebrew/Millennium and https://github.com/SteamClientHomebrew/Millennium/releases/tag/v3.4.0
- Official PluginTemplate: https://github.com/SteamClientHomebrew/PluginTemplate
- Official Plugin Database: https://github.com/SteamClientHomebrew/PluginDatabase
- Plugin quick start: https://docs.steambrew.app/plugins/introduction/quick-start
- Plugin structure: https://docs.steambrew.app/plugins/structure/file-structure
- Plugin manifest: https://docs.steambrew.app/plugins/structure/config
- TypeScript API index: https://docs.steambrew.app/plugins/ts/client/src/README
- Lua Millennium module: https://docs.steambrew.app/plugins/lua/millennium
- Filesystem/install layout: https://docs.steambrew.app/users/getting-started/structure
- Runtime plugin path: https://github.com/SteamClientHomebrew/Millennium/blob/816514f939ce8696ae8262b4e0c2123f593db08c/src/system/environment.cc
- Current example plugins: https://github.com/luthor112/steam-librarian, https://github.com/luthor112/steam-collections-plus, https://github.com/BossSloth/Extendium

### Steam official documentation

- `ISteamApps` deprecation notice: https://partner.steamgames.com/doc/webapi/ISteamApps
- `IStoreService/GetAppList`: https://partner.steamgames.com/doc/webapi/IStoreService#GetAppList
- Store/app-name localization: https://partner.steamgames.com/doc/store/localization
- Supported language codes: https://partner.steamgames.com/doc/store/localization/languages
- Steam Web API overview/key requirements: https://steamcommunity.com/dev

### Pinyin

- pinyin-pro source: https://github.com/zh-lx/pinyin-pro
- npm package: https://www.npmjs.com/package/pinyin-pro
