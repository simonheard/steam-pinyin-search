export const STORE_SEARCH_SELECTORS = {
  input: [
    'form[action*="/search"] input[type="search"]',
    'form[action*="/search"] input[name="term"]',
    '#store_nav_search_term',
    'input[name="term"][autocomplete]',
  ],
  form: ['form[action*="/search"]', '#searchform'],
} as const;

export interface StoreSearchElements {
  input: HTMLInputElement;
  anchor: HTMLElement;
}

export function findStoreSearchElements(root: ParentNode = document): StoreSearchElements | null {
  for (const selector of STORE_SEARCH_SELECTORS.input) {
    const input = root.querySelector<HTMLInputElement>(selector);
    if (!input) continue;
    const form = input.closest<HTMLElement>(STORE_SEARCH_SELECTORS.form.join(','));
    return { input, anchor: form ?? input.parentElement ?? input };
  }
  return null;
}

export function navigateToStoreApp(appId: number): void {
  const url = `https://store.steampowered.com/app/${appId}/`;
  window.location.assign(url);
}
