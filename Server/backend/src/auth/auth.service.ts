import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../database/database.service.js';
import { AuthUser, PublicUser, StoredUser, UserRole } from '../common/types.js';
import { hashPassword, verifyPassword } from '../common/password.js';
import { ROLE_PERMISSIONS } from '../common/permissions.js';
import {
  requiredEmail,
  requiredPassword,
  requiredString,
} from '../common/validation.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { jwtSecret } from './jwt-secret.js';

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _hash, pushTokens: _tokens, ...rest } = user;
  return rest;
}

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  login(dto: LoginDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const user = this.database.users.find((candidate) => candidate.email === email);
    if (!user || !verifyPassword(String(dto.password ?? ''), user.passwordHash)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.active) {
      throw new UnauthorizedException('Tài khoản đang chờ quản trị viên kích hoạt hoặc đã bị khóa');
    }
    return this.issueToken(user);
  }

  /**
   * Đăng ký công khai luôn tạo tài khoản STAFF ở trạng thái chưa kích hoạt.
   * Quản trị viên phải kích hoạt (và có thể đổi vai trò) trong màn hình quản lý tài khoản,
   * tránh việc người lạ tự đăng ký rồi xem được dữ liệu kinh doanh.
   */
  register(dto: RegisterDto) {
    const name = requiredString(dto.name, 'Họ tên', 80);
    const email = requiredEmail(dto.email);
    const password = requiredPassword(dto.password);
    if (this.database.users.some((user) => user.email === email)) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: this.database.createId('user'),
      name,
      email,
      passwordHash: hashPassword(password),
      role: UserRole.STAFF,
      storeId: 'store-1',
      active: false,
      pushTokens: [],
      createdAt: now,
      updatedAt: now,
    };
    this.database.users.push(user);
    this.database.save();
    return {
      message: 'Đăng ký thành công. Vui lòng chờ quản trị viên kích hoạt tài khoản.',
      user: toPublicUser(user),
    };
  }

  me(authUser: AuthUser) {
    const user = this.findStored(authUser.id);
    return { user: toPublicUser(user), permissions: ROLE_PERMISSIONS[user.role] };
  }

  changePassword(authUser: AuthUser, dto: ChangePasswordDto) {
    const user = this.findStored(authUser.id);
    if (!verifyPassword(String(dto.currentPassword ?? ''), user.passwordHash)) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    user.passwordHash = hashPassword(requiredPassword(dto.newPassword));
    user.updatedAt = new Date().toISOString();
    this.database.save();
    return { message: 'Đã đổi mật khẩu' };
  }

  private findStored(id: string): StoredUser {
    const user = this.database.users.find((candidate) => candidate.id === id);
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    return user;
  }

  private issueToken(user: StoredUser) {
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role, storeId: user.storeId },
      jwtSecret(),
      { expiresIn: '8h' },
    );
    return {
      accessToken,
      user: toPublicUser(user),
      permissions: ROLE_PERMISSIONS[user.role],
    };
  }
}
