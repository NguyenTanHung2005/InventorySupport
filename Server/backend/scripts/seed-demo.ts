import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectDemo } from './connect-demo.js';
import { buildDemo, fixtureRoot, type DemoData } from './demo-data.js';
import { seedDemo } from './seed-core.js';
import { uploadRoot } from '../src/uploads/upload-paths.js';
async function main() {
  const data: DemoData = process.env.DEMO_END_DATE
    ? buildDemo(process.env.DEMO_END_DATE)
    : JSON.parse(
        (await readFile(join(fixtureRoot(), 'dataset.json'), 'utf8')).replace(
          /^\uFEFF/,
          '',
        ),
      );
  const { connection, db } = await connectDemo();
  try {
    const counts = await seedDemo(
      db,
      data,
      join(fixtureRoot(), 'images'),
      uploadRoot(),
    );
    await writeFile(
      'demo-seed-report.json',
      JSON.stringify(
        { seededAt: new Date().toISOString(), ...counts },
        null,
        2,
      ),
    );
    console.log('Đã seed và lưu ảnh:', counts);
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(
    'Seed thất bại. Kiểm tra URI/quyền, database demo trống, ảnh và kết nối. Không có thao tác xóa tự động.',
  );
  process.exitCode = 1;
});
