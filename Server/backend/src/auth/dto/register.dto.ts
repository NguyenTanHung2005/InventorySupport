import { UserRole } from '../../common/types.js';

export class RegisterDto {
  name = '';
  email = '';
  password = '';
  storeId = 'store-1';
  role: UserRole = UserRole.STAFF;
}
