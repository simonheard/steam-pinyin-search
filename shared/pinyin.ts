import { pinyin } from 'pinyin-pro';

import { containsHan, normalizeSearchText } from './normalize';

export interface PinyinFields {
  pinyinFull: string;
  pinyinCompact: string;
  initials: string;
  pinyinVariants: string[];
}

function createInitials(value: string, syllables: readonly string[]): string {
  const tokens = value.match(/\p{Script=Han}|[^\p{Script=Han}]+/gu) ?? [];
  if (tokens.length !== syllables.length) {
    return syllables.map((syllable) => normalizeSearchText(syllable)[0] ?? '').join('');
  }

  return tokens
    .map((token, index) => {
      const normalizedToken = normalizeSearchText(token);
      if (!normalizedToken) return '';
      if (/^\p{Script=Han}$/u.test(token)) return normalizeSearchText(syllables[index] ?? '')[0] ?? '';
      return normalizedToken;
    })
    .join('');
}

export function createPinyinFields(value: string): PinyinFields {
  if (!containsHan(value)) {
    return { pinyinFull: '', pinyinCompact: '', initials: '', pinyinVariants: [] };
  }

  const syllables = pinyin(value, {
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive',
  }).filter((syllable) => normalizeSearchText(syllable).length > 0);

  const normalizedSyllables = syllables.map(normalizeSearchText);
  const pinyinFull = normalizedSyllables.join(' ');
  const pinyinCompact = normalizedSyllables.join('');
  const initials = createInitials(value, syllables);

  return {
    pinyinFull,
    pinyinCompact,
    initials,
    pinyinVariants: pinyinCompact ? [pinyinCompact] : [],
  };
}
