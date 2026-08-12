const PUNCTUATION_OR_SPACE = /[\p{P}\p{Z}\p{S}_]+/gu;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(PUNCTUATION_OR_SPACE, '')
    .trim();
}

export function containsHan(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}
