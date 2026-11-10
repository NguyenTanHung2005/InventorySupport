import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AuthUser, StoredUser, UserRole } from '../common/types.js';
import { hashPassword } from '../common/password.js';
import {
  optionalString,
  paginate,
  parsePageQuery,
  requiredEmail,
  requiredEnum,
  requiredPassword,
  requiredString,
} from '../common/validation.js';
import { toPublicUser } from '../auth/auth.service.js';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto.js';

const ROLES = Object.values(UserRole);

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  list(admin: AuthUser, query: { page?: string; limit?: string; search?: string; role?: string }) {
    const search = query.search?.trim().toLowerCase();
    const users = this.storeUsers(admin)
      .filter((user) => !query.role || user.role === query.role)
      .filter((user) => !search || `${user.name} ${user.email}`.toLowerCase().includes(search))
      .sort((a, b) => Number(a.active) - Number(b.active) || a.name.localeCompare(b.name, 'vi'));
    return paginate(users.map(toPublicUser), parsePageQuery(query));
  }

  create(admin: AuthUser, dto: CreateUserDto) {
    const email = requiredEmail(dto.email);
    if (this.database.users.some((user) => user.email === email)) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: this.database.createId('user'),
      name: requiredString(dto.name, 'Họ tên', 80),
      email,
      passwordHash: hashPassword(requiredPassword(dto.password)),
      role: requiredEnum(dto.role, ROLES, 'Vai trò'),
      storeId: admin.storeId,
      active: dto.active ?? true,
      pushTokens: [],
      createdAt: now,
      updatedAt: now,
    };
    this.database.users.push(user);
    this.database.save();
    return toPublicUser(user);
  }

  update(admin: AuthUser, id: string, dto: UpdateUserDto) {
    const user = this.find(admin, id);
    const nextRole = dto.role === undefined ? user.role : requiredEnum(dto.role, ROLES, 'Vai trò');
    const nextActive = dto.active === undefined ? user.active : Boolean(dto.active);

    if (user.id === admin.id && (nextRole !== UserRole.ADMIN || !nextActive)) {
      throw new BadRequestException('Không thể tự hạ quyền hoặc khóa tài khoản của chính mình');
    }
    if (user.role === UserRole.ADMIN && (nextRole !== UserRole.ADMIN || !nextActive)) {
      this.ensureAnotherActiveAdmin(admin, user.id);
    }

    const name = optionalString(dto.name, 'Họ tên', 80);
    if (name !== undefined) user.name = requiredString(name, 'Họ tên', 80);
    if (dto.email !== undefined) {
      const email = requiredEmail(dto.email);
      if (this.database.users.some((other) => other.email === email && other.id !== user.id)) {
        throw new ConflictException('Email đã được sử dụng');
      }
      user.email = email;
    }
    if (dto.password) user.passwordHash = hashPassword(requiredPassword(dto.password));
    user.role = nextRole;
    user.active = nextActive;
    user.updatedAt = new Date().toISOString();
    this.database.save();
    return toPublicUser(user);
  }

  remove(admin: AuthUser, id: string) {
    const user = this.find(admin, id);
    if (user.id === admin.id) throw new BadRequestException('Không thể xóa tài khoản của chính mình');
    if (user.role === UserRole.ADMIN) this.ensureAnotherActiveAdmin(admin, user.id);
    this.database.users = this.database.users.filter((candidate) => candidate.id !== user.id);
    this.database.save();
    return { id: user.id, deleted: true };
  }

  private storeUsers(admin: AuthUser) {
    return this.database.users.filter((user) => user.storeId === admin.storeId);
  }

  private find(admin: AuthUser, id: string) {
    const user = this.storeUsers(admin).find((candidate) => candidate.id === id);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }

  private ensureAnotherActiveAdmin(admin: AuthUser, excludingId: string) {
    const others = this.storeUsers(admin).filter(
      (user) => user.role === UserRole.ADMIN && user.active && user.id !== excludingId,
    );
    if (!others.length) throw new BadRequestException('Cửa hàng phải còn ít nhất một quản trị viên');
  }
}
