import { normalizeSearchText } from './normalize.js';
import { createPinyinFields } from './pinyin.js';
import type { LibraryGameIndex, LibraryGameSource, StoreGameIndex } from './types.js';

export function indexLibraryGame(game: LibraryGameSource): LibraryGameIndex {
  return {
    ...game,
    ...createPinyinFields(game.name),
    normalized: normalizeSearchText(game.name),
    normalizedName: normalizeSearchText(game.name),
    aliases: [],
  };
}

export function indexStoreGame(
  game: Pick<StoreGameIndex, 'appId' | 'name' | 'localizedName' | 'aliases' | 'type' | 'lastModified'>,
): StoreGameIndex {
  const searchableName = game.localizedName || game.name;
  return {
    ...game,
    ...createPinyinFields(searchableName),
    normalized: normalizeSearchText(searchableName),
    normalizedName: normalizeSearchText(game.name),
    aliases: game.aliases.map(normalizeSearchText).filter(Boolean),
  };
}
