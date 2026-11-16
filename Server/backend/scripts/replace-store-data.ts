import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { connectDemo } from './connect-demo.js';
import { fromDocument } from '../src/database/database.service.js';
import { uploadRoot } from '../src/uploads/upload-paths.js';
import {
  buildStoreDataset,
  type CatalogProduct,
  type DatasetActor,
} from './store-dataset.js';
import {
  applyStoreReplacement,
  businessTables,
  digest,
  readBusinessSnapshot,
  readUsers,
  replacementFailureMessage,
} from './replace-store-core.js';

let committed = false;
let backupLocation: string | undefined;
async function main() {
  const apply = process.argv.includes('--apply');
  assert(
    process.argv.slice(2).every((a) => a === '--apply'),
    'Only --apply is supported; no flag means preview',
  );
  const root = resolve('fixtures/minimart247');
  const catalog = JSON.parse(
    await readFile(join(root, 'catalog.json'), 'utf8'),
  ) as CatalogProduct[];
  const sources = JSON.parse(
    await readFile(join(root, 'sources.json'), 'utf8'),
  ) as { barcode: string; imageFile: string; imageSha256: string }[];
  assert(catalog.length === 65 && sources.length === 65);
  const sourceByCode = new Map(sources.map((s) => [s.barcode, s]));
  const images = [];
  for (const p of catalog) {
    const source = sourceByCode.get(p.barcode);
    assert(source);
    const file = resolve(root, source.imageFile);
    assert(file.startsWith(root + '\\') || file.startsWith(root + '/'));
    const bytes = await readFile(file);
    assert(bytes.length <= 5 * 1024 * 1024 && bytes.length > 12);
    const hex = bytes.subarray(0, 8).toString('hex');
    assert(
      (bytes[0] === 255 && bytes[1] === 216) ||
        hex === '89504e470d0a1a0a' ||
        (bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP'),
    );
    assert(
      createHash('sha256').update(bytes).digest('hex') === source.imageSha256,
      'Image checksum mismatch',
    );
    images.push({
      barcode: p.barcode,
      file,
      bytes,
      name: `retail-${source.imageSha256.slice(0, 24)}${basename(file).slice(basename(file).lastIndexOf('.'))}`,
    });
  }
  if (apply) {
    let running = false;
    try {
      await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      running = true;
    } catch {}
    assert(!running, 'Stop the backend before applying replacement');
  }
  const { connection } = await connectDemo();
  try {
    const users = await readUsers(connection);
    const actors = users.map((row) => fromDocument<DatasetActor>(row));
    assert(
      actors.length > 0 && actors.every((u) => u.storeId === 'store-1'),
      'This dataset supports store-1 only; other stores require review',
    );
    const data = buildStoreDataset(catalog, actors, '2026-11-15');
    for (const p of data.products) {
      const image = images.find((i) => i.barcode === p.barcode)!;
      p.imageUrl = `/uploads/${p.storeId}/${image.name}`;
    }
    const backup = await readBusinessSnapshot(connection, 'store-1');
    const before = Object.fromEntries(
      businessTables.map((t) => [t, backup[t].length]),
    );
    const report = {
      mode: apply ? 'apply' : 'preview',
      storeId: 'store-1',
      usersPreserved: users.length,
      startDay: data.startDay,
      endDay: data.endDay,
      before,
      after: {
        products: data.products.length,
        transactions: data.transactions.length,
        notifications: data.notifications.length,
        stocktake_sessions: 0,
        stocktake_items: 0,
      },
    };
    await writeFile(
      join(root, 'activity-preview.json'),
      JSON.stringify(data, null, 2) + '\n',
    );
    if (!apply) {
      console.log(JSON.stringify(report, null, 2));
      console.log(
        'Preview only. To replace: stop backend, then run npm run data:replace -- --apply',
      );
      return;
    }
    const backupRoot = resolve('.local-backups');
    await mkdir(backupRoot, { recursive: true });
    const backupFile = join(
      backupRoot,
      `store-1-before-retail-${Date.now()}.json`,
    );
    backupLocation = backupFile;
    const backupBytes =
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          storeId: 'store-1',
          usersDigest: digest(users),
          collections: backup,
        },
        null,
        2,
      ) + '\n';
    await writeFile(backupFile, backupBytes, { flag: 'wx', mode: 0o600 });
    assert(
      (await readFile(backupFile, 'utf8')) === backupBytes,
      'Backup verification failed',
    );
    const folder = join(uploadRoot(), 'store-1');
    await mkdir(folder, { recursive: true });
    for (const image of images) {
      const dest = join(folder, image.name);
      try {
        await copyFile(image.file, dest, constants.COPYFILE_EXCL);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        assert(
          (await readFile(dest)).equals(image.bytes),
          'Existing image differs; refusing overwrite',
        );
      }
    }
    await applyStoreReplacement(connection, data, backup, users);
    committed = true;
    assert(
      digest(await readUsers(connection)) === digest(users),
      'Post-commit: account data differs',
    );
    await writeFile(
      join(backupRoot, 'replacement-report.json'),
      JSON.stringify(
        { ...report, backupFile, appliedAt: new Date().toISOString() },
        null,
        2,
      ) + '\n',
    );
    console.log(JSON.stringify({ ...report, backupFile }, null, 2));
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(replacementFailureMessage(committed, backupLocation));
  process.exitCode = 1;
});
