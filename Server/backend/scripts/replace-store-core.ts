import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Connection } from 'mongoose';
import type { StoreDataset } from './store-dataset.js';

export const businessTables = [
  'products',
  'transactions',
  'notifications',
  'stocktake_sessions',
  'stocktake_items',
] as const;
export function replacementFailureMessage(
  committed: boolean,
  backupFile?: string,
) {
  return committed
    ? `Replacement COMMITTED; reporting or cleanup failed. Do not blindly rerun. Backup: ${backupFile ?? 'see .local-backups'}`
    : `Replacement commit not confirmed. Inspect database and backup before retrying. Backup: ${backupFile ?? 'not created'}. Check local Mongo configuration; credentials are not printed.`;
}
export type BusinessSnapshot = Record<
  (typeof businessTables)[number],
  Record<string, unknown>[]
>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
export async function readBusinessSnapshot(
  connection: Connection,
  storeId: string,
): Promise<BusinessSnapshot> {
  const snapshot = {} as BusinessSnapshot;
  for (const table of businessTables)
    snapshot[table] = await connection
      .model(table)
      .find({ storeId })
      .sort({ _id: 1 })
      .lean<Record<string, unknown>[]>()
      .exec();
  return snapshot;
}
export async function readUsers(connection: Connection) {
  return connection
    .model('users')
    .find({})
    .select('+adminRevision')
    .sort({ _id: 1 })
    .lean<Record<string, unknown>[]>()
    .exec();
}
export async function applyStoreReplacement(
  connection: Connection,
  data: StoreDataset,
  backup: BusinessSnapshot,
  usersBefore: Record<string, unknown>[],
) {
  const storeId = data.products[0]?.storeId;
  assert(
    storeId && data.products.length === 65,
    'Replacement requires exactly 65 products',
  );
  assert(data.products.every((p) => p.storeId === storeId));
  assert(
    data.transactions.every((t) => t.storeId === storeId) &&
      data.notifications.every((n) => n.storeId === storeId),
  );
  await connection.transaction(async (session) => {
    const users = await connection
      .model('users')
      .find({})
      .select('+adminRevision')
      .sort({ _id: 1 })
      .session(session)
      .lean()
      .exec();
    assert(
      digest(users) === digest(usersBefore),
      'Accounts changed after preview; aborting',
    );
    for (const table of businessTables) {
      const rows = await connection
        .model(table)
        .find({ storeId })
        .sort({ _id: 1 })
        .session(session)
        .lean()
        .exec();
      assert(
        digest(rows) === digest(backup[table]),
        'Business data changed after backup; aborting',
      );
    }
    for (const table of businessTables)
      await connection.model(table).deleteMany({ storeId }, { session });
    for (const table of [
      'products',
      'transactions',
      'notifications',
    ] as const) {
      const rows = data[table].map(({ id, ...fields }) => ({
        _id: id,
        ...fields,
      }));
      if (rows.length)
        await connection
          .model(table)
          .insertMany(rows, { session, ordered: true });
    }
    assert(
      (await connection
        .model('products')
        .countDocuments({ storeId })
        .session(session)) === 65,
    );
    assert(
      (await connection
        .model('transactions')
        .countDocuments({ storeId })
        .session(session)) === data.transactions.length,
    );
    assert(
      (await connection
        .model('notifications')
        .countDocuments({ storeId })
        .session(session)) === data.notifications.length,
    );
  });
}
