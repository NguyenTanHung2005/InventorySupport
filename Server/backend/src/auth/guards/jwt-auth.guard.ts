import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser, UserRole } from '../../common/types.js';

type AuthenticatedRequest = Request & { user?: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!token) throw new UnauthorizedException('Thiếu Bearer token');

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET ?? 'development-only-secret',
      );
      if (typeof payload === 'string' || !payload.sub) {
        throw new UnauthorizedException('Token không hợp lệ');
      }
      request.user = {
        id: payload.sub,
        name: String(payload.name),
        email: String(payload.email),
        role: payload.role as UserRole,
        storeId: String(payload.storeId),
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
