import { describe, expect, it, vi } from 'vitest';

import { persistSettingWithReadback } from '../frontend/settings-persistence';

describe('Millennium setting persistence', () => {
  it('accepts a normal successful write', async () => {
    const write = vi.fn(async () => undefined);
    const read = vi.fn(async () => 'unused');
    await expect(persistSettingWithReadback(write, read, 'saved')).resolves.toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts a rejected acknowledgement when readback confirms persistence', async () => {
    const write = vi.fn(async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    });
    await expect(persistSettingWithReadback(write, async () => 'saved', 'saved')).resolves.toBeUndefined();
  });

  it('preserves the write error when readback differs', async () => {
    const error = new Error('write failed');
    await expect(
      persistSettingWithReadback(
        async () => {
          throw error;
        },
        async () => 'old',
        'new',
      ),
    ).rejects.toBe(error);
  });
});
