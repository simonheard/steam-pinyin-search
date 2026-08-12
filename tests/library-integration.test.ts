import { describe, expect, it } from 'vitest';

import { LibrarySearchIndex } from '../frontend/library/search';
import { indexLibraryGame } from '../shared/index-game';

describe('large library search', () => {
  it('finds the expected AppID in a 5,000 game library', () => {
    const generated = Array.from({ length: 4_999 }, (_, index) =>
      indexLibraryGame({ appId: index + 100, name: `Generated Game ${index}` }),
    );
    generated.push(indexLibraryGame({ appId: 2358720, name: '黑神话：悟空' }));
    const index = new LibrarySearchIndex(generated);
    expect(index.search('hshwk', 10)[0]?.item.appId).toBe(2358720);
  });
});
