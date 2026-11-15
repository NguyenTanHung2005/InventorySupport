import { describe, expect, it, vi } from 'vitest';
import { MemoryDatabase } from '../../test/helpers/memory-database.js';
import { UsersService } from './users.service.js';
describe('account patch isolation', () => {
  it('does not revert a concurrent password change during a name-only edit', async () => {
    const db = new MemoryDatabase(),
      service = new UsersService(db);
    const update = db.update.bind(db);
    vi.spyOn(db, 'update').mockImplementation(async (table, filter, fields) => {
      if (filter._id === 'user-staff-1')
        db.users[2].passwordHash = 'new-password-hash';
      return update(table, filter, fields);
    });
    const user = await service.update(db.users[0], 'user-staff-1', {
      name: 'Tên mới',
    });
    expect(db.users[2].passwordHash).toBe('new-password-hash');
    expect(user.name).toBe('Tên mới');
  });
});
