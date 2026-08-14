import { describe, expect, it } from 'vitest';

import { normalizeServerUrl, readStorePluginSettings } from '../shared/plugin-settings';

describe('plugin Store settings', () => {
  it('defaults Store search to enabled local mode for existing installations', () => {
    expect(readStorePluginSettings(undefined)).toEqual({ enabled: true, remoteServer: null });
  });

  it('reads the master switch and normalized remote server', () => {
    expect(readStorePluginSettings({ storeSearchEnabled: false, storeServerUrl: 'https://search.example.com/api/' })).toEqual({
      enabled: false,
      remoteServer: 'https://search.example.com/api',
    });
  });

  it('rejects non-http server URLs and ignores invalid persisted values', () => {
    expect(() => normalizeServerUrl('file:///tmp/catalog')).toThrow(TypeError);
    expect(readStorePluginSettings({ storeServerUrl: 'not a URL' })).toEqual({ enabled: true, remoteServer: null });
  });

  it('accepts the JSON-string response returned by Millennium 3.4 core config', () => {
    expect(readStorePluginSettings('{"storeSearchEnabled":false,"storeServerUrl":"https://search.example.com/"}')).toEqual({
      enabled: false,
      remoteServer: 'https://search.example.com',
    });
  });
});
