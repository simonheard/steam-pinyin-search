# Changelog

All notable changes to this project are documented here.

## 0.1.1 — 2026-08-13

- Worked around Millennium 3.4 config acknowledgement failures so the settings
  UI no longer reports a failed save after the value has already persisted.
- Mirrored the user-configured server URL in the Steam Library frontend so
  online community aliases remain available without uploading Library data.
- Removed the release-machine absolute path from the novice packaging script.
- Made both packaging scripts derive archive names from `plugin.json`.
- Documented Linux and macOS as untested and the current Steam publicbeta as
  blocked by a Millennium 3.4 loader crash.

## 0.1.0 — 2026-08-13

- Added local Steam Library search by Chinese name, full pinyin, compact pinyin,
  initials, digits, mixed text, and aliases.
- Added incremental, schema-versioned local Library cache.
- Added optional online Library community-alias matching without uploading the
  user's Library.
- Added opt-in Store pinyin search with local catalog, remote-first mode, local
  fallback, request cancellation, timeout, debounce, and LRU caching.
- Added the self-hostable Fastify/SQLite catalog service, official Steam catalog
  synchronization, Chinese-title enrichment adapters, and community aliases.
- Added Windows manual and novice installation packages.
- Added tests, benchmark, Docker deployment, documentation, and MIT licensing.
