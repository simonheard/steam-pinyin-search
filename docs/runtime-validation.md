# Windows Steam runtime validation

Validation date: 2026-08-12. Steam desktop build `1785799196`, Simplified Chinese UI, Millennium v3.4.0 stable.

## Installation

- Official Installer release checked: v1.12.1, published 2026-04-05.
- Installer SHA-256: `1a3baf49f20c321bdcc9421f5b7aab8c1e8a33792c93086463d148b502c1be3d` (matches its GitHub release asset digest).
- Installer Authenticode: valid SignPath Foundation signature.
- Millennium runtime ZIP SHA-256: `fe3213feeefcc2e6bfd02ab2030291f50bf251a681cad91f060acfdcfaaf0357` (matches the v3.4.0 GitHub asset digest).
- All five Windows runtime executable/DLL files reported valid Authenticode signatures before installation.
- Actual Windows plugin directory: `%STEAM%/millennium/plugins`.

## Plugin results

- Millennium frontend SDK loaded in Steam.
- Plugin manifest discovered and `steam-pinyin-search` persisted in `plugins.enabledPlugins`.
- Library games were detected and locally indexed.
- Direct instance replacement failed because current Steam exposes `LibraryUIStore.SetSearchText` through a non-configurable read-only MobX property. The plugin now attempts the official patch API and fails open to the documented input fallback.
- The semantic fallback selector was verified against the current client as `.SearchInput input.DialogInput[type="text"]`; the hashed companion class is deliberately not stored.
- `library search input fallback mounted` appeared in Steam's `logs/webhelper_js.txt`.
- Navigating to Steam Store produced `store hook mounted` from the packaged WebKit bundle.
- No Windows service, external Electron app, or independent plugin process was installed.

The runtime check confirms loading and hook mounting. Automated search/ranking coverage remains responsible for exact result sets; a public release should still be checked after every Steam/Millennium update.

