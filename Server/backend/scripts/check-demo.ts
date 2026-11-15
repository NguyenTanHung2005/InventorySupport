import assert from 'node:assert/strict';
import { join } from 'node:path';
import { connectDemo } from './connect-demo.js';
import { checkDemo } from './demo-data.js';
import { checkImages } from './seed-core.js';
import { uploadRoot } from '../src/uploads/upload-paths.js';
async function main() {
  const { connection, db } = await connectDemo();
  try {
    const data = {
      users: await db.find('users'),
      products: await db.find('products'),
      transactions: await db.find('transactions'),
      notifications: await db.find('notifications'),
    };
    const counts = checkDemo(data);
    assert.equal(counts.products, 60);
    assert.equal(counts.users, 6);
    await checkImages(data, join(uploadRoot(), 'store-1'));
    console.log('Đối chiếu database và ảnh thành công:', counts);
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(
    'Kiểm tra thất bại. Kiểm tra dữ liệu demo, chuỗi tồn, tham chiếu và ảnh local.',
  );
  process.exitCode = 1;
});
