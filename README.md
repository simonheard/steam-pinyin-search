# Steam Pinyin Search

A Millennium 3.4 plugin that adds full-pinyin, compact-pinyin, and pinyin-initial matching to the Steam desktop Library, plus a failure-isolated Store autocomplete backed by a shared public catalog API.

Library data stays on the user's machine. Store requests contain only the normalized query and result limit; there is no Steam ID, library upload, analytics, account system, service, or resident process.

## Current scope

- Library: patches Steam's existing `SetSearchText` flow and adds matching AppIDs through `SetSearchSuggestions`.
- Local index: original/normalized name, phrase-aware pinyin, compact pinyin, initials, aliases, schema-versioned cache, and AppID/name diffing.
- Store: 200 ms debounce, minimum two characters, 1.5 second timeout, cancellation, 50-query LRU, separate dropdown, and unchanged native Enter behavior.
- API: Fastify + SQLite + in-memory search index; official `IStoreService/GetAppList` synchronization; game-only results by default.
- Localized title enrichment: optional, rate-limited, cached, isolated adapter for Steam's undocumented `appdetails` endpoint. It is disabled by default.

The implementation decisions and exact 2026 sources are in [docs/research.md](docs/research.md). Performance results are in [docs/benchmark.md](docs/benchmark.md).

## Prerequisites

- Windows Steam desktop client.
- [Millennium v3.4.0 or newer](https://github.com/SteamClientHomebrew/Millennium/releases).
- For development: Bun, as used by the official template, or Node.js 22.5+ and npm. This repository's validation uses npm.
- For catalog synchronization: a server-side Steam Web API key. Never put it in the plugin bundle.

## Development setup

```powershell
git clone https://github.com/simonheard/steam-pinyin-search.git
cd steam-pinyin-search
npm install
npm run typecheck
npm test
npm run dev
```

The current Millennium template builds into `.millennium/Dist`. Production builds use:

```powershell
npm run build
```

## Install the plugin locally

Build it, then link or copy this repository as a directory named `steam-pinyin-search` under the current Millennium plugin directory (`%STEAM%\plugins` in current Windows installations). The folder must contain `plugin.json` and `.millennium\Dist\index.js` / `webkit.js`.

For a self-contained archive:

```powershell
npm run package:plugin
```

Extract the resulting `artifacts\steam-pinyin-search-v0.1.0.zip` into the Millennium plugin directory. In Steam, open **Settings → Millennium → Plugins**, enable **Steam Pinyin Search**, and reload Steam. Enabled plugins load with Steam/Millennium; no separate client process is installed.

## Store API setup

Configure environment variables in the shell that starts the server:

```powershell
$env:STEAM_WEB_API_KEY = 'server-side-key'
$env:STEAM_PINYIN_DB = '.\server\data\catalog.sqlite'
$env:STEAM_PINYIN_HOST = '127.0.0.1'
$env:STEAM_PINYIN_PORT = '8787'
$env:STEAM_PINYIN_ALLOWED_ORIGINS = 'https://store.steampowered.com,https://checkout.steampowered.com'
$env:STEAM_PINYIN_ENABLE_LOCALIZED_DETAILS = 'false'

npm run server:sync
npm run server
```

For production, run `npm run build:server`, then start `node dist/server/src/cli.js`; schedule `node dist/server/src/sync-cli.js` separately. The sync cursor advances only after a successful page set. Rebuild the process after synchronization so the RAM index reloads. Put HTTPS and ordinary rate limiting in a reverse proxy when exposing the API publicly.

Point the Store WebKit client at the deployment from the Store DevTools console, then reload the page:

```js
localStorage.setItem('steam-pinyin-search:api-base-url', 'https://search.example.com');
```

The default is `http://127.0.0.1:8787` for development. A public release should ship with the operator's HTTPS URL configured in `webkit/store/integration.ts`.

## Debugging

Enable concise plugin logging in the relevant Steam/Store DevTools context:

```js
localStorage.setItem('steam-pinyin-search:debug', '1');
```

Reload Steam or the Store page. Logs use the `[SteamPinyinSearch]` prefix. Disable with `removeItem(...)` when finished. Use Steam's frontend DevTools for Library globals/patch logs and the Store WebKit DevTools for network/dropdown logs. Server logs are emitted by Fastify when run through `server/src/cli.ts`.

Development rebuilds do not make Steam internals stable: after a Steam update, check the centralized adapters under `frontend/steam-integration` and `webkit/steam-integration`. Hooks and listeners are idempotent and clean themselves up on plugin unload or WebKit navigation.

## Validation

```powershell
npm run typecheck
npm test
npm run benchmark
npm run build
npm audit
```

Tests cover normalization, pinyin, initials, ranking, cache diffs, a 5,000-game Library, API behavior, catalog sync, request timeout/cancellation, and LRU behavior.

## Common issues

- **Plugin is absent:** verify the directory name, `plugin.json`, compiled `.millennium/Dist` files, and that the plugin is enabled in Millennium settings.
- **Library search is unchanged:** enable debug logging. Steam may have changed `appStore`, `LibraryUIStore`, `MatchesImpl`, or `SetSearchSuggestions`; native search remains intact when discovery fails.
- **Store dropdown is absent:** queries shorter than two normalized characters intentionally do nothing. Check the configured API URL, CORS origin, HTTPS/mixed-content policy, and WebKit DevTools.
- **API returns no games:** run catalog sync with a valid server-side Web API key, then restart the API to reload its in-memory index.
- **Chinese Store titles are missing:** the official bulk catalog does not provide a dependable `schinese` title field. Enable the optional details adapter only after accepting the documented unofficial-endpoint risk and synchronization cost.
- **Steam update broke selectors:** update only the centralized semantic selector/fallback lists; do not scatter hashed class names across UI code.

## Privacy and failure behavior

The Library index and cache are localStorage data inside Steam and are never sent to the API. A Store timeout, malformed response, selector failure, or server outage hides only the plugin dropdown. It does not prevent typing, native suggestions, Enter submission, or Steam navigation.

