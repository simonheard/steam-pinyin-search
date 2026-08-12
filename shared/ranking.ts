import { normalizeSearchText } from './normalize';
import type { MatchField, SearchableGame } from './types';

export interface ScoreDetails {
  score: number;
  field: MatchField;
}

const NO_MATCH: ScoreDetails = { score: 0, field: 'substring' };

export function scoreGame(game: SearchableGame, rawQuery: string): ScoreDetails {
  const query = normalizeSearchText(rawQuery);
  if (!query) return NO_MATCH;

  const name = normalizeSearchText(game.name);
  const localizedName = normalizeSearchText(game.localizedName ?? '');
  const aliases = game.aliases.map(normalizeSearchText);

  if (query === name || (localizedName && query === localizedName)) return { score: 1000, field: 'name-exact' };
  if (query === game.normalized) return { score: 980, field: 'normalized-exact' };
  if (query === game.pinyinCompact || game.pinyinVariants.includes(query)) return { score: 950, field: 'pinyin-exact' };
  if (query === game.initials) return { score: 920, field: 'initials-exact' };
  if (name.startsWith(query) || localizedName.startsWith(query) || game.normalized.startsWith(query)) return { score: 850, field: 'name-prefix' };
  if (game.pinyinCompact.startsWith(query) || game.pinyinVariants.some((variant) => variant.startsWith(query))) return { score: 820, field: 'pinyin-prefix' };
  if (game.initials.startsWith(query)) return { score: 790, field: 'initials-prefix' };
  if (aliases.some((alias) => alias.startsWith(query))) return { score: 760, field: 'alias-prefix' };

  const fields = [name, localizedName, game.normalized, game.pinyinCompact, game.initials, ...game.pinyinVariants, ...aliases];
  const matchingField = fields.find((field) => field.includes(query));
  if (!matchingField) return NO_MATCH;

  const positionPenalty = Math.min(matchingField.indexOf(query), 40);
  const lengthPenalty = Math.min(Math.max(matchingField.length - query.length, 0), 80) / 10;
  return { score: 600 - positionPenalty - lengthPenalty, field: 'substring' };
}
