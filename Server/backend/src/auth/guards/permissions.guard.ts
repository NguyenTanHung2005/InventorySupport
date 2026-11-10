import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../common/types.js';
import { hasPermission, Permission } from '../../common/permissions.js';
import { PERMISSIONS_KEY } from '../permissions.decorator.js';

/** Chạy sau JwtAuthGuard; yêu cầu user có đủ mọi quyền khai báo bằng @RequirePermissions. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !required.every((permission) => hasPermission(user.role, permission))) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
