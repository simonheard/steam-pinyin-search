type WebkitStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const memory = new Map<string, string>();
const memoryStorage: WebkitStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => {
    memory.delete(key);
  },
};

/** Some Steam utility views use data: URLs where merely reading localStorage throws. */
export function getWebkitStorage(): WebkitStorage {
  try {
    const storage = window.localStorage;
    storage.getItem('steam-pinyin-search:storage-probe');
    return storage;
  } catch {
    return memoryStorage;
  }
}
