import { resolve } from 'node:path';

export interface ServerConfig {
  aliasesPath: string;
  databasePath: string;
  host: string;
  port: number;
  allowedOrigins: string[];
  steamWebApiKey: string;
  enableLocalizedDetails: boolean;
}

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(environment.STEAM_PINYIN_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('STEAM_PINYIN_PORT must be a valid TCP port');
  return {
    aliasesPath: resolve(environment.STEAM_PINYIN_ALIASES ?? './catalog/aliases.zh-CN.json'),
    databasePath: resolve(environment.STEAM_PINYIN_DB ?? './server/data/catalog.sqlite'),
    host: environment.STEAM_PINYIN_HOST ?? '127.0.0.1',
    port,
    allowedOrigins: (environment.STEAM_PINYIN_ALLOWED_ORIGINS ?? 'https://store.steampowered.com,https://steamloopback.host')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    steamWebApiKey: environment.STEAM_WEB_API_KEY ?? '',
    enableLocalizedDetails: environment.STEAM_PINYIN_ENABLE_LOCALIZED_DETAILS === 'true',
  };
}
