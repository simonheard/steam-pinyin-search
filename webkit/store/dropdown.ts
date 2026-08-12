import type { StoreSearchResponse } from '../../shared/types';
import { navigateToStoreApp } from '../steam-integration/store-search-elements';
import type { StoreSearchSource } from './provider';

const ROOT_ATTRIBUTE = 'data-steam-pinyin-search-dropdown';

export class StoreSearchDropdown {
  readonly #root: HTMLDivElement;

  constructor(private readonly anchor: HTMLElement) {
    document.querySelector(`[${ROOT_ATTRIBUTE}]`)?.remove();
    this.#root = document.createElement('div');
    this.#root.setAttribute(ROOT_ATTRIBUTE, '');
    this.#root.setAttribute('role', 'listbox');
    Object.assign(this.#root.style, {
      position: 'fixed',
      zIndex: '2147483000',
      display: 'none',
      maxHeight: '420px',
      overflowY: 'auto',
      background: '#171d25',
      border: '1px solid #3d4450',
      borderRadius: '3px',
      boxShadow: '0 8px 24px rgba(0,0,0,.45)',
      color: '#dcdedf',
      fontFamily: 'Motiva Sans, Arial, sans-serif',
    });
    document.body.append(this.#root);
    this.reposition();
  }

  reposition = (): void => {
    const rect = this.anchor.getBoundingClientRect();
    this.#root.style.left = `${rect.left}px`;
    this.#root.style.top = `${rect.bottom + 4}px`;
    this.#root.style.width = `${Math.max(rect.width, 300)}px`;
  };

  render(response: StoreSearchResponse, source: StoreSearchSource = 'remote'): void {
    this.#root.replaceChildren();
    if (response.results.length === 0) {
      this.hide();
      return;
    }

    const heading = document.createElement('div');
    heading.textContent = source === 'remote' ? 'Pinyin Search · Remote' : 'Pinyin Search · Local';
    Object.assign(heading.style, {
      padding: '8px 12px',
      color: '#66c0f4',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '.08em',
      textTransform: 'uppercase',
    });
    this.#root.append(heading);

    for (const result of response.results) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      Object.assign(button.style, {
        display: 'block',
        width: '100%',
        padding: '9px 12px',
        border: '0',
        borderTop: '1px solid rgba(255,255,255,.06)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      });

      const primary = document.createElement('div');
      primary.textContent = result.localizedName || result.name;
      primary.style.fontSize = '14px';
      button.append(primary);

      if (result.localizedName && result.localizedName !== result.name) {
        const secondary = document.createElement('div');
        secondary.textContent = result.name;
        Object.assign(secondary.style, { color: '#8f98a0', fontSize: '12px', marginTop: '2px' });
        button.append(secondary);
      }

      button.addEventListener('mouseenter', () => {
        button.style.background = '#2a475e';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
      });
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        navigateToStoreApp(result.appid);
      });
      this.#root.append(button);
    }

    this.reposition();
    this.#root.style.display = 'block';
  }

  hide(): void {
    this.#root.style.display = 'none';
  }

  contains(target: Node): boolean {
    return this.#root.contains(target);
  }

  destroy(): void {
    this.#root.remove();
  }
}
