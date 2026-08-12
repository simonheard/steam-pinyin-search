import type { CatalogApp, CatalogRepository } from './types.js';

export class MemoryCatalogRepository implements CatalogRepository {
  readonly #apps = new Map<number, CatalogApp>();
  readonly #state = new Map<string, string>();

  constructor(apps: readonly CatalogApp[] = []) {
    this.upsertApps(apps);
  }

  close(): void {}

  getApp(appId: number): CatalogApp | null {
    return this.#apps.get(appId) ?? null;
  }

  listApps(): CatalogApp[] {
    return [...this.#apps.values()].filter((app) => app.type === 'game').sort((left, right) => left.appId - right.appId);
  }

  upsertApps(apps: readonly CatalogApp[]): void {
    for (const app of apps) this.#apps.set(app.appId, { ...app, aliases: [...app.aliases] });
  }

  getState(key: string): string | null {
    return this.#state.get(key) ?? null;
  }

  setState(key: string, value: string): void {
    this.#state.set(key, value);
  }
}
