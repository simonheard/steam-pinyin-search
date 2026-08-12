import { DialogBodyText, IconsModule, definePlugin } from '@steambrew/client';
import { useEffect, useState } from 'react';

import { createLogger } from '../shared/logger';
import { buildLibraryIndex } from './library/indexer';
import { LibrarySearchIndex } from './library/search';
import { installLibrarySearchHook } from './steam-integration/library-search-hook';
import { extractLibraryGames, waitForSteamGlobals } from './steam-integration/resolve';
import type { CleanupHandle } from './steam-integration/types';

const PLUGIN_VERSION = '0.1.0';
const logger = createLogger(localStorage.getItem('steam-pinyin-search:debug') === '1');

interface PluginRuntimeStatus {
  state: 'starting' | 'ready' | 'unavailable' | 'error';
  message: string;
}

let runtimeStatus: PluginRuntimeStatus = { state: 'starting', message: 'Waiting for the Steam Library…' };
let cleanupHandle: CleanupHandle | null = null;

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
    cleanupHandle = installLibrarySearchHook(steam.libraryStore, searchIndex, logger);
    runtimeStatus = {
      state: 'ready',
      message: `${searchIndex.size.toLocaleString()} games indexed locally in ${build.elapsedMs.toFixed(1)} ms.`,
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
      <strong>Privacy:</strong> Library names never leave this device. Store search sends only the typed query.
    </DialogBodyText>
  );
}

export default definePlugin(async () => {
  void startLibraryIntegration();
  return {
    title: 'Steam Pinyin Search',
    icon: <IconsModule.Search />,
    content: <SettingsContent />,
    onDismount() {
      cleanupHandle?.cleanup();
      cleanupHandle = null;
    },
  };
});
