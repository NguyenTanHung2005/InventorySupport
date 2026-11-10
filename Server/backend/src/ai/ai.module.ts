import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';

@Module({
  imports: [ProductsModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
