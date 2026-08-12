import { BindPluginSettings } from '@steambrew/webkit';

import { readStorePluginSettings, type StorePluginSettings } from '../../shared/plugin-settings';

export function readWebkitStoreSettings(): StorePluginSettings {
  try {
    // TTC 3.3.7 does not inject the plugin name into this WebKit call even
    // though it does so in the main frontend bundle. Millennium 3.4 accepts
    // the explicit name, keeping this view on the same persistent config.
    const bindSettings = BindPluginSettings as unknown as (pluginName: string) => unknown;
    return readStorePluginSettings(bindSettings('steam-pinyin-search'));
  } catch {
    return { enabled: true, remoteServer: null };
  }
}
