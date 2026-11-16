import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../../../App/InventorySupport/src/constants/config', () => ({
  API_URL: 'http://test',
}));
import {
  ApiError,
  request,
} from '../../../../App/InventorySupport/src/services/api';

afterEach(() => vi.unstubAllGlobals());
it('retains the affected products and resume session from API conflicts', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Recount',
            conflicts: ['product-1'],
            sessionId: 's1',
          }),
          { status: 409 },
        ),
      ),
  );
  try {
    await request('/stocktakes/s1/complete', { method: 'POST' });
    expect.fail();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toMatchObject({
      conflicts: ['product-1'],
      sessionId: 's1',
    });
  }
});
