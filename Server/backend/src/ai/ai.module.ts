import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ProductsModule } from '../products/products.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AssistantController } from './assistant/assistant.controller.js';
import { AssistantSessionStore } from './assistant/assistant-session.store.js';
import { AssistantService } from './assistant/assistant.service.js';

@Module({
  imports: [ProductsModule, InventoryModule],
  controllers: [AiController, AssistantController],
  providers: [AiService, AssistantService, AssistantSessionStore],
  exports: [AiService],
})
export class AiModule {}
