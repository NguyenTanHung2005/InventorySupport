import { UserRole } from '../../common/types.js';

export class CreateUserDto {
  name = '';
  email = '';
  password = '';
  role: UserRole = UserRole.STAFF;
  active?: boolean;
}

export class UpdateUserDto {
  name?: string;
  email?: string;
  /** Để trống nếu không đặt lại mật khẩu. */
  password?: string;
  role?: UserRole;
  active?: boolean;
}
