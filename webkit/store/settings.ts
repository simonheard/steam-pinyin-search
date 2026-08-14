import { BindPluginSettings, Millennium } from '@steambrew/webkit';

import { readStorePluginSettings, type StorePluginSettings } from '../../shared/plugin-settings';

export async function readWebkitStoreSettings(): Promise<StorePluginSettings> {
  try {
    // TTC 3.3.7 does not inject the plugin name into this WebKit call even
    // though it does so in the main frontend bundle. Millennium 3.4 accepts
    // the explicit name, keeping this view on the same persistent config.
    const bindSettings = BindPluginSettings as unknown as (pluginName: string) => unknown;
    const raw = bindSettings('steam-pinyin-search');
    const settings = readStorePluginSettings(raw);
    if (settings.remoteServer || !settings.enabled) return settings;
  } catch {
    // Fall through to the Millennium 3.4 compatible core config route.
  }
  try {
    const callServerMethod = Millennium.callServerMethod as unknown as (
      pluginName: string,
      methodName: string,
      kwargs: Record<string, unknown>,
    ) => Promise<unknown>;
    const raw = await callServerMethod('core', 'PluginConfig_GetAll', { plugin_name: 'steam-pinyin-search' });
    return readStorePluginSettings(raw);
  } catch {
    return { enabled: true, remoteServer: null };
  }
}
