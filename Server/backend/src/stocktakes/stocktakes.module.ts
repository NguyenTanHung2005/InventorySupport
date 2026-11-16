import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { StocktakesController } from './stocktakes.controller.js';
import { StocktakesService } from './stocktakes.service.js';
@Module({
  imports: [NotificationsModule],
  controllers: [StocktakesController],
  providers: [StocktakesService],
})
export class StocktakesModule {}
