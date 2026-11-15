import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import type {
  DatabaseService,
  Table,
} from '../src/database/database.service.js';
import { isOwnUploadPath } from '../src/uploads/upload-paths.js';
import { checkDemo, type DemoData } from './demo-data.js';
export const tables: Table[] = [
  'users',
  'products',
  'transactions',
  'notifications',
];

export async function checkImages(data: DemoData, imageFolder: string) {
  for (const product of data.products) {
    assert(
      product.imageUrl && isOwnUploadPath(product.imageUrl, product.storeId),
      'Đường dẫn ảnh không hợp lệ',
    );
    const bytes = await readFile(join(imageFolder, basename(product.imageUrl)));
    assert(
      bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
      'Ảnh mẫu phải là PNG',
    );
    assert(
      bytes.readUInt32BE(16) === 512 && bytes.readUInt32BE(20) === 512,
      'Ảnh mẫu phải là 512x512',
    );
  }
}
export async function seedDemo(
  db: DatabaseService,
  data: DemoData,
  sourceImages: string,
  destination: string,
) {
  const counts = checkDemo(data);
  await checkImages(data, sourceImages);
  for (const table of tables)
    assert(
      !(await db.get(table, {})),
      'Database demo đã có dữ liệu; seed dừng và không xóa dữ liệu',
    );
  await mkdir(join(destination, 'store-1'), { recursive: true });
  for (const product of data.products) {
    const file = basename(product.imageUrl!);
    const source = join(sourceImages, file),
      target = join(destination, 'store-1', file);
    try {
      await copyFile(source, target, constants.COPYFILE_EXCL);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const digest = (bytes: Buffer) =>
        createHash('sha256').update(bytes).digest('hex');
      assert.equal(
        digest(await readFile(source)),
        digest(await readFile(target)),
        'Ảnh đích đã có nội dung khác; không ghi đè',
      );
    }
  }
  await db.transaction(async (scoped) => {
    for (const table of tables)
      assert(!(await scoped.get(table, {})), 'Database demo đã có dữ liệu');
    for (const user of data.users) await scoped.insert('users', user);
    for (const product of data.products)
      await scoped.insert('products', product);
    for (const row of data.transactions)
      await scoped.insert('transactions', row);
    for (const row of data.notifications)
      await scoped.insert('notifications', row);
  });
  return counts;
}
