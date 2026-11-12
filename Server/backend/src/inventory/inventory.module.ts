import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [ProductsModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
