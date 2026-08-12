import type { LibraryGameSource } from '../../shared/types';
import type { SteamAppStoreLike, SteamGlobals, SteamLibraryStoreLike } from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isAppStore(value: unknown): value is SteamAppStoreLike {
  return isRecord(value) && Array.isArray(value.allApps);
}

function isLibraryStore(value: unknown): value is SteamLibraryStoreLike {
  return (
    isRecord(value) &&
    typeof value.SetSearchText === 'function' &&
    isRecord(value.currentAppFilter) &&
    typeof value.currentAppFilter.SetSearchSuggestions === 'function'
  );
}

export function resolveSteamGlobals(scope: UnknownRecord = globalThis as unknown as UnknownRecord): SteamGlobals | null {
  const appStore = scope.appStore;
  const libraryCandidates = [scope.uiStore, scope.LibraryUIStore, scope.libraryUIStore];
  const libraryStore = libraryCandidates.find(isLibraryStore);
  if (!isAppStore(appStore) || !libraryStore) return null;
  return { appStore, libraryStore };
}

export async function waitForSteamGlobals(timeoutMs = 15_000): Promise<SteamGlobals | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const globals = resolveSteamGlobals();
    if (globals) return globals;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

export function extractLibraryGames(appStore: SteamAppStoreLike): LibraryGameSource[] {
  const unique = new Map<number, LibraryGameSource>();
  for (const app of appStore.allApps) {
    const appId = typeof app.appid === 'string' ? Number.parseInt(app.appid, 10) : app.appid;
    const name = typeof app.display_name === 'string' ? app.display_name.trim() : '';
    if (!Number.isSafeInteger(appId) || appId <= 0 || !name || app.visible_in_game_list === false) continue;
    unique.set(appId, { appId, name });
  }
  return [...unique.values()];
}
