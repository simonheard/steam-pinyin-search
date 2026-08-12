import { normalizeSearchText } from './normalize';
import { createPinyinFields } from './pinyin';
import type { LibraryGameIndex, LibraryGameSource, StoreGameIndex } from './types';

export function indexLibraryGame(game: LibraryGameSource): LibraryGameIndex {
  return {
    ...game,
    ...createPinyinFields(game.name),
    normalized: normalizeSearchText(game.name),
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
    aliases: game.aliases.map(normalizeSearchText).filter(Boolean),
  };
}
