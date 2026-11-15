import { Global, Module } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { DatabaseService, mongoUri } from './database.service.js';
import { models } from './schemas.js';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: mongoUri(process.env.MONGODB_URI),
        serverSelectionTimeoutMS: 10000,
        retryAttempts: 0,
      }),
    }),
    MongooseModule.forFeature(models),
  ],
  providers: [
    DatabaseService,
    { provide: 'MONGO_CONNECTION', useExisting: getConnectionToken() },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
