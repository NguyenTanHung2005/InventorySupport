import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser } from '../../common/types.js';
import { DatabaseService } from '../../database/database.service.js';
import { jwtSecret } from '../jwt-secret.js';

type MaybeAuthenticatedRequest = Request & { user?: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MaybeAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!token) throw new UnauthorizedException('Thiếu Bearer token');

    let subject: string;
    try {
      const payload = jwt.verify(token, jwtSecret());
      if (typeof payload === 'string' || !payload.sub) throw new Error('invalid');
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    // Luôn đọc lại tài khoản để role/trạng thái khóa có hiệu lực ngay lập tức.
    const user = this.database.users.find((candidate) => candidate.id === subject);
    if (!user || !user.active) {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc không còn tồn tại');
    }
    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };
    return true;
  }
}
