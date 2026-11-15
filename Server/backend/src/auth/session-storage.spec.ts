import { afterEach, describe, expect, it, vi } from 'vitest';
const path = new URL('../../../../App/InventorySupport/src/services/session-storage.web.ts', import.meta.url).href;
const { tokenStorage } = await import(path);

afterEach(() => vi.unstubAllGlobals());
describe('web token persistence', () => {
  it('retains the token for a new reader and clears it on logout', async () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    await tokenStorage.set('jwt-only');
    expect(await tokenStorage.get()).toBe('jwt-only');
    expect([...data.values()]).toEqual(['jwt-only']);
    await tokenStorage.clear();
    expect(await tokenStorage.get()).toBeNull();
  });
  it('reports blocked storage instead of silently losing a session', async () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('blocked'); } });
    await expect(tokenStorage.set('token')).rejects.toThrow('blocked');
  });
});
