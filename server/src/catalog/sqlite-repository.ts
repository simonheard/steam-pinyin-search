import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { CatalogApp, CatalogRepository } from './types.js';

interface GameRow {
  appid: number;
  name: string;
  localized_name: string | null;
  type: string;
  aliases_json: string;
  last_modified: number | null;
}

export class SqliteCatalogRepository implements CatalogRepository {
  readonly #db: DatabaseSync;

  constructor(filename: string) {
    mkdirSync(dirname(filename), { recursive: true });
    this.#db = new DatabaseSync(filename);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS games (
        appid INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        localized_name TEXT,
        type TEXT NOT NULL,
        aliases_json TEXT NOT NULL DEFAULT '[]',
        last_modified INTEGER
      ) STRICT;
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;
    `);
  }

  close(): void {
    this.#db.close();
  }

  getApp(appId: number): CatalogApp | null {
    const row = this.#db.prepare('SELECT * FROM games WHERE appid = ?').get(appId) as GameRow | undefined;
    return row ? mapRow(row) : null;
  }

  listApps(): CatalogApp[] {
    return (this.#db.prepare('SELECT * FROM games WHERE type = ? ORDER BY appid').all('game') as unknown as GameRow[]).map(mapRow);
  }

  upsertApps(apps: readonly CatalogApp[]): void {
    const statement = this.#db.prepare(`
      INSERT INTO games (appid, name, localized_name, type, aliases_json, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(appid) DO UPDATE SET
        name = excluded.name,
        localized_name = excluded.localized_name,
        type = excluded.type,
        aliases_json = excluded.aliases_json,
        last_modified = excluded.last_modified
    `);
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      for (const app of apps) {
        statement.run(app.appId, app.name, app.localizedName ?? null, app.type, JSON.stringify(app.aliases), app.lastModified ?? null);
      }
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  getState(key: string): string | null {
    const row = this.#db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setState(key: string, value: string): void {
    this.#db
      .prepare('INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }
}

function mapRow(row: GameRow): CatalogApp {
  let aliases: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.aliases_json);
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) aliases = parsed;
  } catch {
    aliases = [];
  }
  return {
    appId: row.appid,
    name: row.name,
    ...(row.localized_name ? { localizedName: row.localized_name } : {}),
    type: row.type,
    aliases,
    ...(row.last_modified === null ? {} : { lastModified: row.last_modified }),
  };
}
