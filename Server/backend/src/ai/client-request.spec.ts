import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../../App/InventorySupport/src/constants/config', () => ({ API_URL: 'http://test' }));
const apiPath = new URL('../../../../App/InventorySupport/src/services/api.ts', import.meta.url).href;
const { request, setUnauthorizedHandler } = await import(apiPath);

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setUnauthorizedHandler(undefined); });

describe('mobile API deadlines', () => {
  it('identifies the rejected token so a stale 401 cannot sign out a newer login', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ message: 'expired' }), { status: 401 }));
    await expect(request('/products', { token: 'old-token' })).rejects.toThrow('expired');
    expect(handler).toHaveBeenCalledWith('old-token');
  });
  it('aborts a hanging request without retrying writes', async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const pending = request('/ai/normalize-product', { method: 'POST', timeoutMs: 40 });
    const check = expect(pending).rejects.toThrow(/quá lâu/);
    await vi.advanceTimersByTimeAsync(40);
    await check;
    expect(calls).toBe(1);
  });
});
