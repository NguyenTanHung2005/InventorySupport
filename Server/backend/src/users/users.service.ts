import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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

  async list(
    admin: AuthUser,
    query: { page?: string; limit?: string; search?: string; role?: string },
  ) {
    const search = query.search?.trim().toLowerCase();
    const users = (await this.storeUsers(admin))
      .filter((user) => !query.role || user.role === query.role)
      .filter(
        (user) =>
          !search ||
          `${user.name} ${user.email}`.toLowerCase().includes(search),
      )
      .sort(
        (a, b) =>
          Number(a.active) - Number(b.active) ||
          a.name.localeCompare(b.name, 'vi'),
      );
    return paginate(users.map(toPublicUser), parsePageQuery(query));
  }

  async create(admin: AuthUser, dto: CreateUserDto) {
    const email = requiredEmail(dto.email);
    if (await this.database.get('users', { email })) {
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
    await this.database.insert('users', user);
    return toPublicUser(user);
  }

  async update(admin: AuthUser, id: string, dto: UpdateUserDto) {
    return this.database.transaction((db) =>
      new UsersService(db).updateWithin(admin, id, dto),
    );
  }

  private async updateWithin(admin: AuthUser, id: string, dto: UpdateUserDto) {
    await this.lockAdmin(admin);
    const user = await this.find(admin, id);
    const nextRole =
      dto.role === undefined
        ? user.role
        : requiredEnum(dto.role, ROLES, 'Vai trò');
    const nextActive =
      dto.active === undefined ? user.active : Boolean(dto.active);

    if (user.id === admin.id && (nextRole !== UserRole.ADMIN || !nextActive)) {
      throw new BadRequestException(
        'Không thể tự hạ quyền hoặc khóa tài khoản của chính mình',
      );
    }
    if (
      user.role === UserRole.ADMIN &&
      (nextRole !== UserRole.ADMIN || !nextActive)
    ) {
      await this.ensureAnotherActiveAdmin(admin, user.id);
    }

    const name = optionalString(dto.name, 'Họ tên', 80);
    if (name !== undefined) user.name = requiredString(name, 'Họ tên', 80);
    if (dto.email !== undefined) {
      const email = requiredEmail(dto.email);
      if (await this.database.get('users', { email, _id: { $ne: user.id } })) {
        throw new ConflictException('Email đã được sử dụng');
      }
      user.email = email;
    }
    if (dto.password)
      user.passwordHash = hashPassword(requiredPassword(dto.password));
    user.role = nextRole;
    user.active = nextActive;
    user.updatedAt = new Date().toISOString();
    const fields: Partial<StoredUser> = { updatedAt: user.updatedAt };
    if (dto.name !== undefined) fields.name = user.name;
    if (dto.email !== undefined) fields.email = user.email;
    if (dto.password) fields.passwordHash = user.passwordHash;
    if (dto.role !== undefined) fields.role = user.role;
    if (dto.active !== undefined) fields.active = user.active;
    const updated = await this.database.update(
      'users',
      { _id: user.id, storeId: admin.storeId },
      { $set: fields },
    );
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    return toPublicUser(updated);
  }

  async remove(admin: AuthUser, id: string) {
    return this.database.transaction((db) =>
      new UsersService(db).removeWithin(admin, id),
    );
  }

  private async removeWithin(admin: AuthUser, id: string) {
    await this.lockAdmin(admin);
    const user = await this.find(admin, id);
    if (user.id === admin.id)
      throw new BadRequestException('Không thể xóa tài khoản của chính mình');
    if (user.role === UserRole.ADMIN)
      await this.ensureAnotherActiveAdmin(admin, user.id);
    await this.database.delete('users', {
      _id: user.id,
      storeId: admin.storeId,
    });
    return { id: user.id, deleted: true };
  }

  private async lockAdmin(admin: AuthUser) {
    const admins = await this.database.find('users', {
      storeId: admin.storeId,
      role: UserRole.ADMIN,
      active: true,
    });
    if (!admins.some((user) => user.id === admin.id))
      throw new ForbiddenException('Tài khoản không còn quyền quản trị');
    // Serialize admin mutations through one shared document to prevent transaction write skew.
    const anchor = admins.sort((a, b) => a.id.localeCompare(b.id))[0];
    await this.database.update(
      'users',
      { _id: anchor.id, storeId: admin.storeId },
      { $inc: { adminRevision: 1 } },
    );
  }

  private async storeUsers(admin: AuthUser) {
    return this.database.find('users', { storeId: admin.storeId });
  }

  private async find(admin: AuthUser, id: string) {
    const user = (await this.storeUsers(admin)).find(
      (candidate) => candidate.id === id,
    );
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return user;
  }

  private async ensureAnotherActiveAdmin(admin: AuthUser, excludingId: string) {
    const others = (await this.storeUsers(admin)).filter(
      (user) =>
        user.role === UserRole.ADMIN && user.active && user.id !== excludingId,
    );
    if (!others.length)
      throw new BadRequestException(
        'Cửa hàng phải còn ít nhất một quản trị viên',
      );
  }
}
