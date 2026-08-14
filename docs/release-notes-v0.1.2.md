# Steam Pinyin Search v0.1.2

This compatibility release fixes online settings and remote search on the released Millennium 3.4.0 runtime.

- Read Millennium 3.4 plugin config through its compatible core route when the newer SDK dispatcher fails.
- Parse the legacy JSON-string config response used by the released runtime.
- Restore the saved server URL and Store switch in the settings page even when the newer React config hook cannot initialize.
- Apply the same compatible config path to Store WebKit injection, enabling remote Store search and Library community aliases.
- Avoid `localStorage` security errors in Steam utility views backed by restricted `data:` URLs.

Validated on Windows Steam Stable with Millennium 3.4.0. Startup logs confirmed `remote=true`, `store=true`, and Library online alias search enabled. The deployed service returned 179,046 indexed entries during validation; `laotouhuan` matched ELDEN RING / 艾尔登法环 and `heishenhua` matched Black Myth: Wukong / 黑神话：悟空.

## Release assets

- `steam-pinyin-search-v0.1.2.zip` — SHA-256 `A3BB3F8B8BB288303CE35F1AD15FD0A3062FB649096E60134F196FDC9728C4F2`
- `steam-pinyin-search-easy-install-v0.1.2.zip` — SHA-256 `B64B46916BA46F0D643171705A44A9F1687482CCC7FAD70F5364CB3943B83713`

The v0.1.2 assets were repackaged after release to remove a private test endpoint from the bundled documentation; plugin code and runtime behavior are unchanged.

Published as the latest GitHub Release: https://github.com/simonheard/steam-pinyin-search/releases/tag/v0.1.2
