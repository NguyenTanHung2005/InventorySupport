import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { AuthUser, UserRole } from '../common/types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
  ) {}

  async login(dto: LoginDto) {
    const user = this.database.users.find(
      (candidate) => candidate.email === dto.email.toLowerCase(),
    );
    if (!user || user.passwordHash !== this.hash(dto.password)) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.issueToken(this.toAuthUser(user));
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (!email || !dto.password || !dto.name.trim()) {
      throw new BadRequestException('name, email và password là bắt buộc');
    }
    if (this.database.users.some((user) => user.email === email)) {
      throw new BadRequestException('Email đã được sử dụng');
    }
    if (![UserRole.MANAGER, UserRole.STAFF, UserRole.VIEWER].includes(dto.role)) {
      throw new BadRequestException('Role không hợp lệ khi tạo tài khoản');
    }

    const user = {
      id: this.database.createId('user'),
      name: dto.name.trim(),
      email,
      passwordHash: this.hash(dto.password),
      role: dto.role,
      storeId: dto.storeId,
    };
    this.database.users.push(user);
    return this.issueToken(this.toAuthUser(user));
  }

  private issueToken(user: AuthUser) {
    return {
      accessToken: jwt.sign({
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeId: user.storeId,
      }, process.env.JWT_SECRET ?? 'development-only-secret', { expiresIn: '8h' }),
      user,
    };
  }

  private toAuthUser(user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    storeId: string;
  }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
    };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
