const PREFIX = '[SteamPinyinSearch]';

export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

export function createLogger(debugEnabled: boolean): Logger {
  return {
    debug: (message, ...details) => {
      if (debugEnabled) console.debug(PREFIX, message, ...details);
    },
    info: (message, ...details) => console.info(PREFIX, message, ...details),
    warn: (message, ...details) => console.warn(PREFIX, message, ...details),
    error: (message, ...details) => console.error(PREFIX, message, ...details),
  };
}
