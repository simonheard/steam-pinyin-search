# Steam Pinyin Search v0.1.2

This compatibility release fixes online settings and remote search on the released Millennium 3.4.0 runtime.

- Read Millennium 3.4 plugin config through its compatible core route when the newer SDK dispatcher fails.
- Parse the legacy JSON-string config response used by the released runtime.
- Restore the saved server URL and Store switch in the settings page even when the newer React config hook cannot initialize.
- Apply the same compatible config path to Store WebKit injection, enabling remote Store search and Library community aliases.
- Avoid `localStorage` security errors in Steam utility views backed by restricted `data:` URLs.

Validated on Windows Steam Stable with Millennium 3.4.0. Startup logs confirmed `remote=true`, `store=true`, and Library online alias search enabled. The deployed service returned 179,046 indexed entries during validation; `laotouhuan` matched ELDEN RING / 艾尔登法环 and `heishenhua` matched Black Myth: Wukong / 黑神话：悟空.
