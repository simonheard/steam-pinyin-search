import { BindPluginSettings, DialogBodyText, DialogButton, IconsModule, Millennium, TextField, ToggleField, definePlugin, pluginConfig, routerHook, usePluginConfig, useWindowRef } from '@steambrew/client';
import { useEffect, useState } from 'react';

import { createLogger } from '../shared/logger';
import { normalizeServerUrl, readStorePluginSettings, STORE_SEARCH_ENABLED_KEY, STORE_SERVER_URL_KEY } from '../shared/plugin-settings';
import { buildLibraryIndex } from './library/indexer';
import { LibrarySearchIndex } from './library/search';
import { LibraryRemoteAliasSearchClient, type LibraryRemoteAliasSearch } from './library/remote-alias-search';
import {
  isMillenniumConfigAcknowledgementError,
  persistSettingWithReadback,
  readBoundStoreSettings,
  readMirroredServerUrl,
  writeMirroredServerUrl,
} from './settings-persistence';
import { findLibrarySearchInput, installLibrarySearchInputHook } from './steam-integration/library-search-input';
import { installLibrarySearchHook } from './steam-integration/library-search-hook';
import { extractLibraryGames, waitForSteamGlobals } from './steam-integration/resolve';
import type { CleanupHandle, SteamLibraryStoreLike } from './steam-integration/types';

const PLUGIN_VERSION = '0.1.2';
const BRIDGE_NAME = 'steam-pinyin-search-library-bridge';
const logger = createLogger(localStorage.getItem('steam-pinyin-search:debug') === '1');

interface PluginRuntimeStatus {
  state: 'starting' | 'ready' | 'unavailable' | 'error';
  message: string;
}

let runtimeStatus: PluginRuntimeStatus = { state: 'starting', message: 'Waiting for the Steam Library…' };
let cleanupHandle: CleanupHandle | null = null;
let bridgeRuntime: { store: SteamLibraryStoreLike; searchIndex: LibrarySearchIndex; remoteAliasSearch?: LibraryRemoteAliasSearch } | null = null;
const bridgeRefreshListeners = new Set<() => void>();

async function readRuntimeStoreSettings() {
  const mirroredServer = readMirroredServerUrl(localStorage);
  // Keep explicit plugin-name calls behind aliases so TTC does not inject a
  // duplicate argument. Millennium 3.4 otherwise receives a numeric value in
  // the pluginName slot and rejects the config request before returning data.
  const getAll = pluginConfig.getAll as unknown as (pluginName: string) => Promise<unknown>;
  try {
    const raw = await getAll('steam-pinyin-search');
    const settings = readStorePluginSettings(raw);
    if (settings.remoteServer || !mirroredServer) return settings;
  } catch {
    // Millennium 3.4.0 shipped an older config dispatcher than the current
    // SDK. Fall through to its stable core PluginConfig_GetAll method.
  }
  const callServerMethod = Millennium.callServerMethod as unknown as (
    pluginName: string,
    methodName: string,
    kwargs: Record<string, unknown>,
  ) => Promise<unknown>;
  try {
    const raw = await callServerMethod('core', 'PluginConfig_GetAll', { plugin_name: 'steam-pinyin-search' });
    const settings = readStorePluginSettings(raw);
    if (settings.remoteServer || !mirroredServer) return settings;
  } catch {
    // The bound store is available in windows where config IPC is not ready.
  }
  const bindSettings = BindPluginSettings as unknown as (pluginName: string) => unknown;
  const bound = readBoundStoreSettings(() => bindSettings('steam-pinyin-search'));
  return mirroredServer ? { ...bound, remoteServer: mirroredServer } : bound;
}

function setBridgeRuntime(runtime: typeof bridgeRuntime): void {
  bridgeRuntime = runtime;
  bridgeRefreshListeners.forEach((refresh) => refresh());
}

function LibraryInputBridge() {
  const [windowRef, ownerWindow] = useWindowRef();
  useEffect(() => {
    if (!ownerWindow) return;
    let inputHandle: CleanupHandle | null = null;
    let activeInput: HTMLInputElement | null = null;
    const refresh = (): void => {
      if (activeInput && !activeInput.isConnected) {
        inputHandle?.cleanup();
        inputHandle = null;
        activeInput = null;
      }
      if (inputHandle || !bridgeRuntime) return;
      const input = findLibrarySearchInput(ownerWindow.document);
      if (!input) return;
      activeInput = input;
      inputHandle = installLibrarySearchInputHook(input, bridgeRuntime.store, bridgeRuntime.searchIndex, logger, bridgeRuntime.remoteAliasSearch);
    };
    bridgeRefreshListeners.add(refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(ownerWindow.document.documentElement, { childList: true, subtree: true });
    refresh();
    return () => {
      bridgeRefreshListeners.delete(refresh);
      observer.disconnect();
      inputHandle?.cleanup();
    };
  }, [ownerWindow]);
  return <span ref={windowRef} hidden />;
}

async function startLibraryIntegration(): Promise<void> {
  logger.info('plugin loaded');
  try {
    const steam = await waitForSteamGlobals();
    if (!steam) {
      runtimeStatus = { state: 'unavailable', message: 'Steam Library integration was not found. Steam search is unchanged.' };
      logger.warn('library integration unavailable');
      return;
    }

    const sources = extractLibraryGames(steam.appStore);
    logger.info('library detected', { games: sources.length });
    const build = buildLibraryIndex(sources, localStorage, PLUGIN_VERSION, logger);
    const searchIndex = new LibrarySearchIndex(build.games);
    let remoteAliasSearch: LibraryRemoteAliasSearch | undefined;
    try {
      const runtimeSettings = await readRuntimeStoreSettings();
      const remoteServer = runtimeSettings.remoteServer;
      logger.info(`plugin settings detected: remote=${Boolean(remoteServer)}, store=${runtimeSettings.enabled}`);
      if (remoteServer) {
        remoteAliasSearch = new LibraryRemoteAliasSearchClient(remoteServer, new Set(sources.map((game) => game.appId)), logger);
        logger.info('library online alias search enabled');
      }
    } catch (error) {
      logger.warn('library online alias search unavailable', error);
    }
    let integrationMode = 'original search patch';
    try {
      cleanupHandle = installLibrarySearchHook(steam.libraryStore, searchIndex, logger, remoteAliasSearch);
    } catch (error) {
      integrationMode = 'original input fallback';
      setBridgeRuntime({ store: steam.libraryStore, searchIndex, ...(remoteAliasSearch ? { remoteAliasSearch } : {}) });
      logger.warn('library method patch unavailable; using input fallback', error);
    }
    runtimeStatus = {
      state: 'ready',
      message: `${searchIndex.size.toLocaleString()} games indexed locally in ${build.elapsedMs.toFixed(1)} ms (${integrationMode}).`,
    };
  } catch (error) {
    runtimeStatus = { state: 'error', message: 'The enhancement failed to load. Steam search is unchanged.' };
    logger.error('library integration failed', error);
  }
}

function SettingsContent() {
  const [status, setStatus] = useState(runtimeStatus);
  const [storeEnabledValue, setStoreEnabled] = usePluginConfig<boolean>(STORE_SEARCH_ENABLED_KEY);
  const [storedServerUrl, setStoredServerUrl] = usePluginConfig<string>(STORE_SERVER_URL_KEY);
  const [fallbackStoreEnabled, setFallbackStoreEnabled] = useState(true);
  const [serverDraft, setServerDraft] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const storeEnabled = storeEnabledValue ?? fallbackStoreEnabled;

  useEffect(() => {
    const timer = window.setInterval(() => setStatus({ ...runtimeStatus }), 500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setServerDraft(storedServerUrl ?? ''), [storedServerUrl]);
  useEffect(() => {
    let cancelled = false;
    void readRuntimeStoreSettings().then((settings) => {
      if (cancelled) return;
      setFallbackStoreEnabled(settings.enabled);
      if (storedServerUrl === undefined) setServerDraft(settings.remoteServer ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [storedServerUrl]);
  useEffect(() => {
    if (typeof storedServerUrl === 'string') writeMirroredServerUrl(localStorage, storedServerUrl);
  }, [storedServerUrl]);

  const saveServer = (): void => {
    try {
      const normalized = normalizeServerUrl(serverDraft) ?? '';
      void persistSettingWithReadback(setStoredServerUrl, async () => (await readRuntimeStoreSettings()).remoteServer ?? '', normalized)
        .then(() => {
          writeMirroredServerUrl(localStorage, normalized);
          setServerDraft(normalized);
          setServerMessage(normalized ? 'Online search server saved. Reload Steam to apply it.' : 'Local-only mode saved. Reload Steam to apply it.');
        })
        .catch((error) => {
          if (isMillenniumConfigAcknowledgementError(error)) {
            // Millennium 3.4 persisted the value before rejecting its malformed
            // acknowledgement. Mirror it for the Library window and ask for the
            // same reload that normal saves require.
            writeMirroredServerUrl(localStorage, normalized);
            setServerDraft(normalized);
            setServerMessage(normalized ? 'Online search server saved. Reload Steam to apply it.' : 'Local-only mode saved. Reload Steam to apply it.');
            return;
          }
          setServerMessage('Could not save the server setting. Check the Millennium logs.');
        });
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Invalid server URL.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <DialogBodyText>
        <strong>Library:</strong> {status.message}
        <br />
        <strong>Privacy:</strong> Library names never leave this device. With a server configured, Store and Library alias search send only the typed query; Library results are intersected with owned AppIDs locally.
      </DialogBodyText>
      <ToggleField
        label="Enable Store pinyin search"
        description="When disabled, the plugin does not inject Store search, keep local Store data, or send Store requests. Reload Steam after changing this option."
        checked={storeEnabled}
        onChange={(checked) => {
          void persistSettingWithReadback(setStoreEnabled, async () => (await readRuntimeStoreSettings()).enabled, checked)
            .then(() => {
              setFallbackStoreEnabled(checked);
              setServerMessage('Setting saved. Reload Steam to apply it.');
            })
            .catch((error) => {
              if (isMillenniumConfigAcknowledgementError(error)) {
                setFallbackStoreEnabled(checked);
                setServerMessage('Setting saved. Reload Steam to apply it.');
              } else {
                setServerMessage('Could not save the Store switch. Check the Millennium logs.');
              }
            });
        }}
      />
      <TextField
        label="Online search server (optional)"
        description="Enables Store search and Library community aliases. Only the typed query is sent; your Library list is never uploaded."
        value={serverDraft}
        onChange={(event) => {
          setServerDraft(event.currentTarget.value);
          setServerMessage('');
        }}
      />
      <DialogButton onClick={saveServer}>Save online settings</DialogButton>
      {serverMessage ? <DialogBodyText>{serverMessage}</DialogBodyText> : null}
    </div>
  );
}

export default definePlugin(async () => {
  routerHook.addGlobalComponent(BRIDGE_NAME, LibraryInputBridge);
  void startLibraryIntegration();
  return {
    title: 'Steam Pinyin Search',
    icon: <IconsModule.Search />,
    content: <SettingsContent />,
    onDismount() {
      routerHook.removeGlobalComponent(BRIDGE_NAME);
      cleanupHandle?.cleanup();
      cleanupHandle = null;
      setBridgeRuntime(null);
    },
  };
});
