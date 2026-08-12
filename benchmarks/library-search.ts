import { performance } from 'node:perf_hooks';
import {
  CACHE_KEY,
  persistLibraryCache,
  readLibraryCache,
  updateLibraryCache,
  type KeyValueStorage,
} from '../frontend/library/cache';
import { LibrarySearchIndex } from '../frontend/library/search';
import type { LibraryGameSource } from '../shared/types';

const VERSION = '0.1.0-benchmark';
const QUERIES = ['hshwk', 'sgz14', 'daisenqiu', 'qianshuiyuan', 'counterstrike2', '2077'];
const NAMES = [
  '黑神话：悟空',
  '三国志14',
  '戴森球计划',
  '潜水员戴夫',
  'Counter-Strike 2',
  'Cyberpunk 2077',
];

class MemoryStorage implements KeyValueStorage {
  #value: string | null = null;
  getItem(key: string): string | null {
    return key === CACHE_KEY ? this.#value : null;
  }
  setItem(key: string, value: string): void {
    if (key === CACHE_KEY) this.#value = value;
  }
}

function makeLibrary(size: number): LibraryGameSource[] {
  return Array.from({ length: size }, (_, index) => ({
    appId: 100_000 + index,
    name: `${NAMES[index % NAMES.length]} ${Math.floor(index / NAMES.length)}`,
  }));
}

function milliseconds(value: number): number {
  return Number(value.toFixed(3));
}

function benchmark(size: number) {
  const source = makeLibrary(size);
  const started = performance.now();
  const built = updateLibraryCache(source, null, VERSION);
  const firstIndexMs = performance.now() - started;

  const storage = new MemoryStorage();
  persistLibraryCache(storage, built.cache);
  const cacheJson = JSON.stringify(built.cache);
  const cacheRuns = 20;
  const cacheStarted = performance.now();
  for (let index = 0; index < cacheRuns; index += 1) readLibraryCache(storage, VERSION);
  const cacheLoadMs = (performance.now() - cacheStarted) / cacheRuns;

  const search = new LibrarySearchIndex(built.games);
  const queryRuns = 50;
  const queryStarted = performance.now();
  for (let index = 0; index < queryRuns; index += 1) {
    search.search(QUERIES[index % QUERIES.length]!, 20);
  }
  const queryMs = (performance.now() - queryStarted) / queryRuns;

  return {
    games: size,
    firstIndexMs: milliseconds(firstIndexMs),
    cacheLoadMs: milliseconds(cacheLoadMs),
    meanQueryMs: milliseconds(queryMs),
    serializedIndexMiB: milliseconds(new TextEncoder().encode(cacheJson).byteLength / 1024 / 1024),
  };
}

console.table([1_000, 5_000, 10_000].map(benchmark));
