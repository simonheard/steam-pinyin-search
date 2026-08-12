import { describe, expect, it } from 'vitest';

import { normalizeSearchText } from '../shared/normalize';

describe('normalizeSearchText', () => {
  it.each([
    ['三国志：14', '三国志14'],
    ['三国志 14', '三国志14'],
    ['Counter-Strike 2', 'counterstrike2'],
    ['counter_strike２', 'counterstrike2'],
    ['  CYBERPUNK: 2077  ', 'cyberpunk2077'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });
});
