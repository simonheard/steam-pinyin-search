# Platform installation and Millennium publication

Verified against the official Millennium documentation and repositories on 2026-08-12.

## Platform support

### Windows

Windows is the only Steam runtime validated platform for Steam Pinyin Search v0.1.0. The repository's novice bundle includes the unmodified, signed official Millennium installer and a PowerShell bootstrap. It is Windows-only.

The tested Millennium 3.4.0 runtime stores plugins at:

```text
%STEAM%\millennium\plugins
```

### Linux

Millennium officially supports native x86 Linux Steam. Its documentation explicitly excludes Flatpak Steam, Snap Steam, and ARM distributions. Arch AUR and Nix packages are documented; other supported distributions can use the official shell installer.

The default plugin path is:

```text
~/.local/share/millennium/plugins
```

Steam Pinyin Search has no native plugin binary and no Python backend, so the same production JavaScript bundle is intended to be used. Linux build and actual Steam/Millennium runtime validation have not yet been completed. Mark Linux support as beta until both tests are complete.

### macOS

Millennium's public README and user installation guide currently advertise Windows and Linux, not macOS. The upstream source tree contains an experimental `scripts/macos/install_macos.sh` wrapper workflow, and the runtime source resolves the plugin path as:

```text
~/Library/Application Support/Millennium/plugins
```

Upstream also states in its current locale/runtime messages that automatic Millennium updates are not yet available on macOS. This is not a novice-user installation path. Steam Pinyin Search has not yet been built or runtime-tested on macOS; macOS support is experimental.

## Manual ZIP distribution

Run on Windows:

```powershell
npm run package:plugin
```

The result is `artifacts/steam-pinyin-search-v0.1.0.zip`. It contains a top-level `steam-pinyin-search` directory. Extract that directory into the platform plugin path, then enable the plugin in Millennium settings and reload Steam.

This ZIP is suitable for testers and GitHub Release attachments. It is not uploaded to, or imported by, Millennium's **Install a plugin** field. That field accepts an approved plugin ID from the official database.

## Official plugin-store submission

The official database consumes a public Git repository, not a release ZIP:

1. Remove secrets and private deployment values, confirm licensing, and make `simonheard/steam-pinyin-search` public.
2. Test Steam Client Stable and Beta as required by the current submission checklist. Arrange third-party Stable/Beta verification during review.
3. Fork and clone `SteamClientHomebrew/PluginDatabase`.
4. Add the plugin repository as a submodule pinned to the reviewed commit:

   ```bash
   git submodule add https://github.com/simonheard/steam-pinyin-search plugins/steam-pinyin-search
   git commit -m "feat: add Steam Pinyin Search"
   ```

5. Push the fork branch and open a pull request using the **Plugin Submission** template. Declare that the plugin does not use a standard Python backend or custom native binaries.
6. Respond to review and third-party testing. Approval makes the plugin available on `steambrew.app`; users then enter its plugin ID in Millennium settings.

For an update, advance the submodule pointer in a new PluginDatabase pull request:

```bash
git submodule update --remote plugins/steam-pinyin-search
git commit -m "chore: update Steam Pinyin Search"
```

The safety model intentionally prevents repository changes from auto-publishing before review.

## Release recommendation

- Use the official PluginDatabase path for ordinary end users and updates.
- Optionally publish `steam-pinyin-search-v0.1.0.zip` as a GitHub Release asset for manual beta testing.
- Publish the Windows easy-install ZIP separately and label it Windows-only.
- Do not bundle an unofficial Linux or macOS Millennium installer. Link to upstream installation instructions instead.
- Do not submit the plugin store PR until the remote Store API has a stable public HTTPS endpoint, or ship Library-only behavior by default and state the Store limitation clearly.

## Sources

- Millennium installation: https://docs.steambrew.app/users/getting-started/installation
- Millennium filesystem structure: https://docs.steambrew.app/users/getting-started/structure
- Installing approved plugins: https://docs.steambrew.app/users/guides/installing-addons
- Submitting addons: https://docs.steambrew.app/developers/submitting
- PluginDatabase submission mechanics and templates: https://github.com/SteamClientHomebrew/PluginDatabase
- Millennium source and experimental macOS scripts: https://github.com/SteamClientHomebrew/Millennium
