# Steam Pinyin Search v0.1.2

This compatibility release fixes online settings and remote search on the released Millennium 3.4.0 runtime.

- Read Millennium 3.4 plugin config through its compatible core route when the newer SDK dispatcher fails.
- Parse the legacy JSON-string config response used by the released runtime.
- Restore the saved server URL and Store switch in the settings page even when the newer React config hook cannot initialize.
- Apply the same compatible config path to Store WebKit injection, enabling remote Store search and Library community aliases.
- Avoid `localStorage` security errors in Steam utility views backed by restricted `data:` URLs.

Validated on Windows Steam Stable with Millennium 3.4.0. Startup logs confirmed `remote=true`, `store=true`, and Library online alias search enabled. The deployed service returned 179,046 indexed entries during validation; `laotouhuan` matched ELDEN RING / 艾尔登法环 and `heishenhua` matched Black Myth: Wukong / 黑神话：悟空.

## Release assets

- `steam-pinyin-search-v0.1.2.zip` — SHA-256 `BA894B8B2E8E4B4DB1EBC4300470CFD6B1C2B9B298245E3E7EAFAF1BC5F778C9`
- `steam-pinyin-search-easy-install-v0.1.2.zip` — SHA-256 `A0520EFDF53B71E4FB26B4F855FBE6FE96ABFA13A8F0F55080F2E2E6E9CA2033`

Published as the latest GitHub Release: https://github.com/simonheard/steam-pinyin-search/releases/tag/v0.1.2
