import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: { page?: string; limit?: string; unreadOnly?: string },
  ) {
    return this.notificationsService.list(request.user, query);
  }

  @Get('unread-count')
  unreadCount(@Req() request: AuthenticatedRequest) {
    return { unreadCount: this.notificationsService.unreadCount(request.user) };
  }

  @Post('read-all')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(request.user);
  }

  @Post('push-token')
  registerPushToken(@Req() request: AuthenticatedRequest, @Body() body: { token?: string }) {
    return this.notificationsService.registerPushToken(request.user, body.token);
  }

  @Post(':id/read')
  markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.markRead(request.user, id);
  }
}
