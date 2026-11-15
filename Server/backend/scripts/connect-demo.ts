import { createConnection } from 'mongoose';
import { DatabaseService, mongoUri } from '../src/database/database.service.js';
import { models } from '../src/database/schemas.js';

export async function connectDemo() {
  const uri = mongoUri(process.env.MONGODB_URI);
  // Keep demo tools away from any other database, including an omitted database name.
  const name = new URL(uri).pathname.slice(1);
  if (!/^inventory_support(?:_[a-z0-9]+)?$/.test(name))
    throw new Error(
      'Công cụ demo chỉ cho phép database inventory_support hoặc inventory_support_<suffix>',
    );
  const connection = await createConnection(uri, {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try {
    for (const { name, schema, collection } of models)
      await connection.model(name, schema, collection).init();
    return { connection, db: new DatabaseService(connection) };
  } catch (error) {
    await connection.close();
    throw error;
  }
}
