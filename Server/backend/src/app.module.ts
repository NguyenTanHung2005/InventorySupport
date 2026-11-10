import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProductsModule } from './products/products.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { AiModule } from './ai/ai.module.js';
import { UsersModule } from './users/users.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ProductsModule,
    InventoryModule,
    AiModule,
    UsersModule,
    UploadsModule,
    NotificationsModule,
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
