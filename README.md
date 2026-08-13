# Steam Pinyin Search

A Millennium 3.4 plugin that adds full-pinyin, compact-pinyin, and pinyin-initial matching to the Steam desktop Library, plus a failure-isolated Store autocomplete with local and user-configured remote modes.

Library data stays on the user's machine. Store search makes no plugin network request unless the user configures a remote server. Remote requests contain only the normalized query and result limit; there is no Steam ID, library upload, analytics, account system, service, or resident process.

**普通用户请直接看 [中文安装、升级与卸载教程](docs/installation.md)。** 本项目提供手动插件 ZIP 和包含官方 Millennium Installer 的 Windows 裸 Steam 小白包。Millennium 官方商店不接收 ZIP；正式收录前后的流程见 [提交准备清单](docs/submission-checklist.md)。

## Platform compatibility

| Platform | Millennium status | This plugin |
| --- | --- | --- |
| Windows 10/11, x64 | Officially supported | Runtime-validated with Millennium 3.4.0 and Steam Stable; novice bundle available. |
| Native Linux Steam, x86/x86_64 | Officially supported | **Untested:** this plugin has not been run or validated on Linux. Flatpak Steam, Snap Steam, and ARM distributions are not supported by Millennium. |
| macOS | Millennium upstream provides an experimental wrapper/install path | **Untested:** this plugin has not been run or validated on macOS. Millennium's macOS support is experimental, automatic updates are limited, and no novice bundle is provided. |

The plugin contains no native binary and has no Millennium Python backend (`useBackend: false`), but that does **not** constitute Linux or macOS compatibility testing. Steam's internal Library hooks may differ by OS; the native search remains untouched if discovery fails. See [docs/publishing.md](docs/publishing.md) for platform paths and the official publication workflow.

Steam `publicbeta` build `1786491548` was also attempted on Windows on 2026-08-13. Millennium 3.4.0 crashed in `millennium.dll` with `EXCEPTION_ACCESS_VIOLATION` before plugin frontend startup, so Steam Beta compatibility is currently **blocked by the upstream loader and remains unverified for this plugin**. Steam Stable was restored successfully.

## Current scope

- Library: patches Steam's existing `SetSearchText` flow and adds local pinyin matches through `SetSearchSuggestions`; when an online server is configured it also resolves community aliases remotely, then intersects results with locally owned AppIDs.
- Local index: original/normalized name, phrase-aware pinyin, compact pinyin, initials, aliases, schema-versioned cache, and AppID/name diffing.
- Store: local-by-default catalog, optional user-configured remote server, automatic local learning/fallback, 200 ms debounce, minimum two characters, 1.5 second timeout, cancellation, 50-query LRU, separate dropdown, and unchanged native Enter behavior.
- API: Fastify + SQLite + in-memory search index; official `IStoreService/GetAppList` synchronization; game-only results by default.
- Localized title enrichment: optional, rate-limited, cached, isolated adapter for Steam's undocumented `appdetails` endpoint. It is disabled by default.

The implementation decisions and exact 2026 sources are in [docs/research.md](docs/research.md). Performance results are in [docs/benchmark.md](docs/benchmark.md).

## Prerequisites

- Steam desktop client on a Millennium-supported platform.
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

Build it, then link or copy this repository as a directory named `steam-pinyin-search` under the plugin directory. The folder must contain `plugin.json` and `.millennium/Dist/index.js` / `webkit.js`.

- Windows v3.4 runtime used for this project: `%STEAM%\millennium\plugins\steam-pinyin-search`
- Linux: `~/.local/share/millennium/plugins/steam-pinyin-search`
- macOS experimental source build: `~/Library/Application Support/Millennium/plugins/steam-pinyin-search`

For a self-contained archive:

```powershell
npm run package:plugin
```

Extract the resulting versioned `artifacts\steam-pinyin-search-v*.zip` into the platform's Millennium plugin directory. The ZIP is a manual/beta distribution archive; Millennium's **Install a plugin** screen does not accept this local ZIP. In Steam, open **Settings → Millennium → Plugins**, enable **Steam Pinyin Search**, and reload Steam. Enabled plugins load with Steam/Millennium; no separate client process is installed.

## Publish to the Millennium plugin store

Do **not** upload the ZIP to Millennium. The current official process is to make the plugin repository public, fork [SteamClientHomebrew/PluginDatabase](https://github.com/SteamClientHomebrew/PluginDatabase), add this repository under `plugins/steam-pinyin-search` as a Git submodule, and open a plugin-submission pull request. The database pins an audited commit; each future plugin update requires another pull request advancing that pointer.

After approval, users install with the plugin ID shown on [steambrew.app/plugins](https://steambrew.app/plugins) from **Millennium Settings → Plugins → Install a plugin**. GitHub Release ZIP assets remain optional and are useful for manual testers. The exact commands, review checklist, uncompleted human tests, and release choices are in [docs/submission-checklist.md](docs/submission-checklist.md) and [docs/publishing.md](docs/publishing.md).

## Windows novice bundle（裸 Steam 小白整合包）

Users who have ordinary Windows Steam but no Millennium can use the novice bundle:

```powershell
npm run package:easy
```

This creates a versioned `artifacts\steam-pinyin-search-easy-install-v*.zip`. After fully extracting it, the user double-clicks `install.cmd`, approves the administrator prompt, and completes the visible official Millennium installer. The bootstrap then installs the plugin, adds it to `enabledPlugins`, and restarts Steam.

The bundle does **not** modify or re-sign Millennium. It carries the unmodified SteamClientHomebrew Installer v1.12.1 release, verifies its published SHA-256 and valid SignPath Authenticode signature, and lets that official installer download the current stable runtime. This preserves upstream trust and update handling. It is therefore a network bootstrap bundle, not a frozen offline repack. The upstream installer and Millennium are MIT licensed; attribution and source URLs are included in `THIRD_PARTY_NOTICES.txt`.

Current v3.4 runtime validation found that Steam exposes `SetSearchText` as a non-configurable read-only MobX action. The plugin first attempts the official method patch and then safely falls back to a capture listener on the original `.SearchInput` field. Steam's own search handler remains unchanged, and the fallback is cleaned up on route replacement/unload.

## Store API setup

The complete self-hostable Store service is included under `server/`, with a production multi-stage `Dockerfile`, `compose.yaml`, persistent SQLite volume, health check, startup/incremental catalog sync, CORS allowlist, and failure-safe startup. See [server/README.md](server/README.md) for Docker, HTTPS reverse proxy, updates, scheduling, and non-Docker instructions.

Quick Docker start:

```bash
cp .env.docker.example .env
# Edit .env and set STEAM_WEB_API_KEY.
docker compose up -d --build api
```

For development without Docker, configure environment variables in the shell that starts the server:

```powershell
$env:STEAM_WEB_API_KEY = 'server-side-key'
$env:STEAM_PINYIN_DB = '.\server\data\catalog.sqlite'
$env:STEAM_PINYIN_HOST = '127.0.0.1'
$env:STEAM_PINYIN_PORT = '8787'
$env:STEAM_PINYIN_ALLOWED_ORIGINS = 'https://store.steampowered.com,https://checkout.steampowered.com,https://steamloopback.host'
$env:STEAM_PINYIN_ENABLE_LOCALIZED_DETAILS = 'false'

npm run server:sync
npm run server
```

For production, run `npm run build:server`, then start `node dist/server/src/cli.js`; schedule `node dist/server/src/sync-cli.js` separately. The sync cursor advances only after a successful page set. Rebuild the process after synchronization so the RAM index reloads. Put HTTPS and ordinary rate limiting in a reverse proxy when exposing the API publicly.

Store mode defaults to local and makes no plugin API request. Successful remote Store results are retained in the local pinyin catalog (up to 10,000 games), so they remain searchable after the server is removed or unavailable. When a server is configured, Library alias search also uses it: only the typed query is sent, and returned AppIDs are intersected with the Library entirely on-device. The game list, SteamID, and account data are never sent.

Configure it through **Steam → Settings → Millennium → Plugins → Steam Pinyin Search**:

- **Enable Store pinyin search** is the master switch. Disable it and reload Steam to skip Store injection and delete the plugin's local Store catalog.
- Leave **Online search server (optional)** empty for local-only mode, enter your own HTTPS deployment, or use the maintained public instance `https://steam-search.hede.wang`.
- Enter the self-hosted HTTPS base URL for remote-first Store search and online Library community aliases. Store failures fall back locally; Library failures leave the original local search untouched.
- Save, then reload Steam to apply the settings across Store WebKit views.

The Store DevTools API remains available for diagnostics and catalog management:

```js
SteamPinyinSearch.status();
SteamPinyinSearch.clearLocalCatalog();
```

The local catalog can also be populated from a trusted JSON array without configuring a server:

```js
SteamPinyinSearch.importLocalCatalog([
  { appid: 123, name: 'English title', localizedName: '中文标题', aliases: ['optional alias'] }
]);
```

The example AppID is only a schema placeholder. A fresh local catalog is empty, so until entries are learned or imported only Steam's native search results appear. The plugin deliberately does not use Valve's deprecated keyless full AppList endpoint (currently unavailable), and it never places an `IStoreService` Web API key in the client.

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
- **Store dropdown is absent:** confirm Store search is enabled and Steam was reloaded after the settings change. Queries shorter than two normalized characters intentionally do nothing. Check the configured API URL, CORS origin, HTTPS/mixed-content policy, and WebKit DevTools.
- **API returns no games:** run catalog sync with a valid server-side Web API key, then restart the API to reload its in-memory index.
- **Chinese Store titles are missing:** the official bulk catalog does not provide a dependable `schinese` title field. Enable the optional details adapter only after accepting the documented unofficial-endpoint risk and synchronization cost.
- **Steam update broke selectors:** update only the centralized semantic selector/fallback lists; do not scatter hashed class names across UI code.

## Privacy and failure behavior

The Library index and cache are localStorage data inside Steam and are never sent to the API. Online Library alias lookup sends only the normalized query, requests at most 50 public results, and filters those results against owned AppIDs locally. A timeout, malformed response, selector failure, or server outage leaves local Library search and native Steam behavior intact.

## License

[MIT](LICENSE) © 2026 Simon Heard. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Steam and the Steam logo are trademarks of Valve Corporation; this community project is not affiliated with or endorsed by Valve.
