import { describe, expect, it, vi } from 'vitest';

import {
  isMillenniumConfigAcknowledgementError,
  persistSettingWithReadback,
  readBoundStoreSettings,
  readMirroredServerUrl,
  writeMirroredServerUrl,
} from '../frontend/settings-persistence';

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

describe('bound Millennium settings', () => {
  it('reads Store settings without config IPC', () => {
    expect(
      readBoundStoreSettings(() => ({
        storeSearchEnabled: false,
        storeServerUrl: 'https://search.example.com/api/',
      })),
    ).toEqual({ enabled: false, remoteServer: 'https://search.example.com/api' });
  });

  it('fails open before Millennium binds the settings store', () => {
    expect(
      readBoundStoreSettings(() => {
        throw new Error('not ready');
      }),
    ).toEqual({ enabled: true, remoteServer: null });
  });
});

describe('runtime server mirror', () => {
  it('normalizes, reads, and clears the frontend server mirror', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
    writeMirroredServerUrl(storage, 'https://search.example.com/api/');
    expect(readMirroredServerUrl(storage)).toBe('https://search.example.com/api');
    writeMirroredServerUrl(storage, '');
    expect(readMirroredServerUrl(storage)).toBeNull();
  });

  it('recognizes Millennium 3.4 acknowledgement failures only', () => {
    expect(isMillenniumConfigAcknowledgementError(new Error('Millennium Error: [json.exception.type_error.302] type must be string, but is number'))).toBe(true);
    expect(isMillenniumConfigAcknowledgementError(new SyntaxError('Unexpected end of JSON input'))).toBe(true);
    expect(isMillenniumConfigAcknowledgementError(new Error('network failed'))).toBe(false);
  });
});
