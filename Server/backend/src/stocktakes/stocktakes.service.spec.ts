import { describe, it, expect, vi } from 'vitest';
import { MemoryDatabase } from '../../test/helpers/memory-database.js';
import { StocktakesService } from './stocktakes.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

describe('stocktake sessions', () => {
  it('saves zero without movements and completes once', async () => {
    const db = new MemoryDatabase();
    const user = db.users[0];
    const service = new StocktakesService(db, new NotificationsService(db));
    const session = await service.create(user);
    const identified = await service.identify(
      session.id,
      { productId: 'product-1' },
      user,
    );
    await service.save(
      session.id,
      'product-1',
      {
        countedQuantity: 0,
        baselineStockVersion: identified.baselineStockVersion,
        expectedUnit: identified.product.unit,
        expectedRevision: 0,
      },
      user,
    );
    expect(db.products[0].quantity).toBe(24);
    expect(db.transactions).toHaveLength(0);
    const detail = await service.detail(session.id, user);
    const result = await service.complete(
      session.id,
      { reason: 'Count', expectedRevision: detail.revision },
      user,
    );
    expect(db.products[0].quantity).toBe(0);
    expect(db.transactions).toHaveLength(1);
    expect(
      await service.complete(
        session.id,
        { reason: 'Count', expectedRevision: 0 },
        user,
      ),
    ).toEqual(result);
    expect(db.transactions).toHaveLength(1);
  });
});

function setup() {
  const db = new MemoryDatabase(),
    user = db.users[0];
  const notifications = new NotificationsService(db);
  return {
    db,
    user,
    notifications,
    service: new StocktakesService(db, notifications),
  };
}
async function saveFirst(ctx: ReturnType<typeof setup>, quantity = 24) {
  const session = await ctx.service.create(ctx.user);
  const identified = await ctx.service.identify(
    session.id,
    { productId: 'product-1' },
    ctx.user,
  );
  const input = {
    countedQuantity: quantity,
    baselineStockVersion: identified.baselineStockVersion,
    expectedUnit: identified.product.unit,
    expectedRevision: 0,
  };
  await ctx.service.save(session.id, 'product-1', input, ctx.user);
  return { session: await ctx.service.detail(session.id, ctx.user), input };
}
describe('stocktake boundaries', () => {
  it('rejects a 201st distinct product without changing the session', async () => {
    const ctx = setup(),
      { session } = await saveFirst(ctx);
    const original = ctx.db.stocktake_items[0];
    ctx.db.stocktake_items = Array.from({ length: 200 }, (_, i) => ({
      ...original,
      id: `item-${i}`,
      productId: `existing-${i}`,
    }));
    await expect(
      ctx.service.save(
        session.id,
        'product-2',
        {
          countedQuantity: 0,
          expectedRevision: 0,
          baselineStockVersion: 0,
          expectedUnit: ctx.db.products[1].unit,
        },
        ctx.user,
      ),
    ).rejects.toThrow('200');
    expect(ctx.db.stocktake_items).toHaveLength(200);
    expect((await ctx.service.detail(session.id, ctx.user)).revision).toBe(
      session.revision,
    );
  });
  it('only sends push after completion and does not repeat it on retry', async () => {
    const ctx = setup(),
      { session } = await saveFirst(ctx, 0);
    const push = vi
      .spyOn(ctx.notifications, 'sendPush')
      .mockImplementation(async () => {
        expect((await ctx.service.detail(session.id, ctx.user)).status).toBe(
          'COMPLETED',
        );
      });
    await ctx.service.complete(
      session.id,
      { reason: 'count', expectedRevision: session.revision },
      ctx.user,
    );
    await ctx.service.complete(session.id, { expectedRevision: 0 }, ctx.user);
    expect(push).toHaveBeenCalledTimes(1);
  });
  it.each(['unit', 'deletedAt'])(
    'returns affected lines for %s conflicts without movements',
    async (field) => {
      const ctx = setup(),
        { session } = await saveFirst(ctx, 0);
      if (field === 'unit') ctx.db.products[0].unit = 'box';
      else ctx.db.products[0].deletedAt = new Date().toISOString();
      try {
        await ctx.service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          ctx.user,
        );
        expect.fail();
      } catch (e) {
        expect((e as { getResponse(): unknown }).getResponse()).toMatchObject({
          conflicts: ['product-1'],
        });
      }
      expect(ctx.db.transactions).toHaveLength(0);
    },
  );
  it('rejects an old revision after a line was deleted and recreated', async () => {
    const ctx = setup(),
      { session, input } = await saveFirst(ctx);
    await ctx.service.remove(
      session.id,
      'product-1',
      { expectedRevision: 1 },
      ctx.user,
    );
    await ctx.service.save(session.id, 'product-1', input, ctx.user);
    await expect(
      ctx.service.save(
        session.id,
        'product-1',
        { ...input, expectedRevision: 1, countedQuantity: 9 },
        ctx.user,
      ),
    ).rejects.toThrow();
  });
  it.each([
    '',
    null,
    undefined,
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    true,
  ])('rejects invalid count %s without saving', async (value) => {
    const ctx = setup(),
      session = await ctx.service.create(ctx.user);
    await expect(
      ctx.service.save(
        session.id,
        'product-1',
        {
          countedQuantity: value,
          baselineStockVersion: 0,
          expectedUnit: 'chai',
          expectedRevision: 0,
        },
        ctx.user,
      ),
    ).rejects.toThrow();
    expect((await ctx.service.detail(session.id, ctx.user)).items).toHaveLength(
      0,
    );
    expect(ctx.db.products[0].quantity).toBe(24);
  });
  it('rejects another owner/store and staff', async () => {
    const { service, user, db } = setup(),
      session = await service.create(user);
    await expect(service.detail(session.id, db.users[1])).rejects.toThrow();
    await expect(
      service.detail(session.id, { ...user, storeId: 'other' }),
    ).rejects.toThrow();
    await expect(service.create(db.users[2])).rejects.toThrow();
  });
  it('rejects duplicate open session with a resumable ID', async () => {
    const { service, user } = setup(),
      session = await service.create(user);
    try {
      await service.create(user);
      expect.fail();
    } catch (e) {
      expect((e as { getResponse(): unknown }).getResponse()).toMatchObject({
        sessionId: session.id,
      });
    }
  });
  it('updates one line and rejects stale revision, then removes it', async () => {
    const ctx = setup(),
      { session, input } = await saveFirst(ctx);
    await expect(
      ctx.service.save(session.id, 'product-1', input, ctx.user),
    ).rejects.toThrow();
    await ctx.service.save(
      session.id,
      'product-1',
      { ...input, expectedRevision: 1, countedQuantity: 5 },
      ctx.user,
    );
    expect((await ctx.service.detail(session.id, ctx.user)).items).toHaveLength(
      1,
    );
    await expect(
      ctx.service.remove(
        session.id,
        'product-1',
        { expectedRevision: 1 },
        ctx.user,
      ),
    ).rejects.toThrow();
    await ctx.service.remove(
      session.id,
      'product-1',
      { expectedRevision: 2 },
      ctx.user,
    );
    expect((await ctx.service.detail(session.id, ctx.user)).items).toHaveLength(
      0,
    );
  });
  it('blocks stale unit and stock on save', async () => {
    const ctx = setup(),
      session = await ctx.service.create(ctx.user);
    const input = {
      countedQuantity: 1,
      baselineStockVersion: 0,
      expectedUnit: 'box',
      expectedRevision: 0,
    };
    await expect(
      ctx.service.save(session.id, 'product-1', input, ctx.user),
    ).rejects.toThrow();
    ctx.db.products[0].stockVersion = 2;
    await expect(
      ctx.service.save(
        session.id,
        'product-1',
        { ...input, expectedUnit: 'chai' },
        ctx.user,
      ),
    ).rejects.toThrow();
  });
  it('blocks completion when stock returns to its old value with a newer version', async () => {
    const ctx = setup(),
      { session } = await saveFirst(ctx, 1);
    ctx.db.products[0].stockVersion = 2;
    await expect(
      ctx.service.complete(
        session.id,
        { reason: 'count', expectedRevision: session.revision },
        ctx.user,
      ),
    ).rejects.toThrow();
    expect(ctx.db.transactions).toHaveLength(0);
    expect((await ctx.service.detail(session.id, ctx.user)).status).toBe(
      'IN_PROGRESS',
    );
  });
  it('writes protection for matching legacy stock without zero history', async () => {
    const ctx = setup(),
      { session } = await saveFirst(ctx);
    await ctx.service.complete(
      session.id,
      { reason: 'count', expectedRevision: session.revision },
      ctx.user,
    );
    expect(ctx.db.products[0].stockVersion).toBe(1);
    expect(ctx.db.transactions).toHaveLength(0);
    expect(ctx.db.products[1].quantity).toBe(6);
  });
  it('rolls back session and stock when history fails', async () => {
    const ctx = setup(),
      { session } = await saveFirst(ctx, 0);
    const insert = ctx.db.insert.bind(ctx.db);
    vi.spyOn(ctx.db, 'insert').mockImplementation(async (table, value) => {
      if (table === 'transactions') throw Error('history failed');
      return insert(table, value);
    });
    await expect(
      ctx.service.complete(
        session.id,
        { reason: 'count', expectedRevision: session.revision },
        ctx.user,
      ),
    ).rejects.toThrow('history failed');
    expect(ctx.db.products[0].quantity).toBe(24);
    expect((await ctx.service.detail(session.id, ctx.user)).revision).toBe(
      session.revision,
    );
  });
  it('cancel never changes stock and rejects later writes', async () => {
    const ctx = setup(),
      { session, input } = await saveFirst(ctx, 0);
    await ctx.service.cancel(
      session.id,
      { expectedRevision: session.revision },
      ctx.user,
    );
    await expect(
      ctx.service.save(
        session.id,
        'product-1',
        { ...input, expectedRevision: 1 },
        ctx.user,
      ),
    ).rejects.toThrow();
    expect(ctx.db.products[0].quantity).toBe(24);
    expect(ctx.db.transactions).toHaveLength(0);
  });
  it('blocks completion with empty reason, stale revision or no lines', async () => {
    const ctx = setup(),
      session = await ctx.service.create(ctx.user);
    for (const input of [
      { reason: '', expectedRevision: 0 },
      { reason: 'count', expectedRevision: 9 },
      { reason: 'count', expectedRevision: 0 },
    ])
      await expect(
        ctx.service.complete(session.id, input, ctx.user),
      ).rejects.toThrow();
  });
});
