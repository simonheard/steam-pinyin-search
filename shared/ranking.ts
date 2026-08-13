import { normalizeSearchText } from './normalize.js';
import type { MatchField, SearchableGame } from './types.js';

export interface ScoreDetails {
  score: number;
  field: MatchField;
}

const NO_MATCH: ScoreDetails = { score: 0, field: 'substring' };

export function scoreGame(game: SearchableGame, rawQuery: string): ScoreDetails {
  const query = normalizeSearchText(rawQuery);
  return scoreNormalizedGame(game, query);
}

export function scoreNormalizedGame(game: SearchableGame, query: string): ScoreDetails {
  if (!query) return NO_MATCH;

  const name = game.normalizedName;
  const localizedName = game.localizedName ? game.normalized : '';
  const aliases = game.aliases;
  const aliasPinyin = game.aliasPinyin ?? [];
  const aliasInitials = game.aliasInitials ?? [];

  if (query === name || (localizedName && query === localizedName)) return { score: 1000, field: 'name-exact' };
  if (query === game.normalized) return { score: 980, field: 'normalized-exact' };
  if (query === game.pinyinCompact || game.pinyinVariants.includes(query)) return { score: 950, field: 'pinyin-exact' };
  if (aliases.includes(query)) return { score: 940, field: 'alias-exact' };
  if (aliasPinyin.some((alias) => alias === query) || aliasInitials.some((alias) => alias === query)) return { score: 930, field: 'alias-pinyin' };
  if (query === game.initials) return { score: 920, field: 'initials-exact' };
  if (name.startsWith(query) || localizedName.startsWith(query) || game.normalized.startsWith(query)) return { score: 850, field: 'name-prefix' };
  if (game.pinyinCompact.startsWith(query) || game.pinyinVariants.some((variant) => variant.startsWith(query))) return { score: 820, field: 'pinyin-prefix' };
  if (game.initials.startsWith(query)) return { score: 790, field: 'initials-prefix' };
  if (aliases.some((alias) => alias.startsWith(query))) return { score: 760, field: 'alias-prefix' };
  if (aliasPinyin.some((alias) => alias.startsWith(query)) || aliasInitials.some((alias) => alias.startsWith(query))) {
    return { score: 740, field: 'alias-pinyin' };
  }

  const fields = [name, localizedName, game.normalized, game.pinyinCompact, game.initials, ...game.pinyinVariants, ...aliases, ...aliasPinyin, ...aliasInitials];
  const matchingField = fields.find((field) => field.includes(query));
  if (!matchingField) return NO_MATCH;

  const positionPenalty = Math.min(matchingField.indexOf(query), 40);
  const lengthPenalty = Math.min(Math.max(matchingField.length - query.length, 0), 80) / 10;
  return { score: 600 - positionPenalty - lengthPenalty, field: 'substring' };
}
