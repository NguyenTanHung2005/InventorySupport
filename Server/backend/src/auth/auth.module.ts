import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  imports: [
  ],
  controllers: [AuthController],
  providers: [AuthService, RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
