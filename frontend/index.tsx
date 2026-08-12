import { DialogBodyText, IconsModule, definePlugin, routerHook, useWindowRef } from '@steambrew/client';
import { useEffect, useState } from 'react';

import { createLogger } from '../shared/logger';
import { buildLibraryIndex } from './library/indexer';
import { LibrarySearchIndex } from './library/search';
import { findLibrarySearchInput, installLibrarySearchInputHook } from './steam-integration/library-search-input';
import { installLibrarySearchHook } from './steam-integration/library-search-hook';
import { extractLibraryGames, waitForSteamGlobals } from './steam-integration/resolve';
import type { CleanupHandle, SteamLibraryStoreLike } from './steam-integration/types';

const PLUGIN_VERSION = '0.1.0';
const BRIDGE_NAME = 'steam-pinyin-search-library-bridge';
const logger = createLogger(localStorage.getItem('steam-pinyin-search:debug') === '1');

interface PluginRuntimeStatus {
  state: 'starting' | 'ready' | 'unavailable' | 'error';
  message: string;
}

let runtimeStatus: PluginRuntimeStatus = { state: 'starting', message: 'Waiting for the Steam Library…' };
let cleanupHandle: CleanupHandle | null = null;
let bridgeRuntime: { store: SteamLibraryStoreLike; searchIndex: LibrarySearchIndex } | null = null;
const bridgeRefreshListeners = new Set<() => void>();

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
      inputHandle = installLibrarySearchInputHook(input, bridgeRuntime.store, bridgeRuntime.searchIndex, logger);
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
    let integrationMode = 'original search patch';
    try {
      cleanupHandle = installLibrarySearchHook(steam.libraryStore, searchIndex, logger);
    } catch (error) {
      integrationMode = 'original input fallback';
      setBridgeRuntime({ store: steam.libraryStore, searchIndex });
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
  useEffect(() => {
    const timer = window.setInterval(() => setStatus({ ...runtimeStatus }), 500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <DialogBodyText>
      <strong>Library:</strong> {status.message}
      <br />
      <strong>Privacy:</strong> Library names never leave this device. Store search is local unless you configure a server; remote mode sends only the typed query.
    </DialogBodyText>
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
