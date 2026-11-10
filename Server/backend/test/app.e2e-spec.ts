import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// 1x1 PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('Inventory Support API (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const as = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    for (const role of ['admin', 'manager', 'staff']) {
      const response = await api()
        .post('/auth/login')
        .send({ email: `${role}@example.com`, password: 'demo123' })
        .expect(201);
      tokens[role] = response.body.accessToken;
    }
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return api().get('/').expect(200).expect('Hello World!');
  });

  it('rejects requests without token', async () => {
    await api().get('/products').expect(401);
  });

  it('paginates and searches products without Vietnamese accents', async () => {
    const page = await api().get('/products?page=1&limit=2').set(as('staff')).expect(200);
    expect(page.body).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page.body.items).toHaveLength(2);

    const search = await api().get('/products?search=mi hao hao').set(as('staff')).expect(200);
    expect(search.body.items[0].name).toBe('Mì Hảo Hảo tôm chua cay');
  });

  describe('permissions', () => {
    it('STAFF can only export stock', async () => {
      await api()
        .post('/inventory/movement')
        .set(as('staff'))
        .send({ productId: 'product-1', type: 'EXPORT', quantity: 2 })
        .expect(201);
      await api()
        .post('/inventory/movement')
        .set(as('staff'))
        .send({ productId: 'product-1', type: 'IMPORT', quantity: 2 })
        .expect(403);
      await api().post('/products').set(as('staff')).send({ name: 'Bánh' }).expect(403);
      await api().patch('/products/product-1').set(as('staff')).send({ price: 1 }).expect(403);
      await api().delete('/products/product-1').set(as('staff')).expect(403);
      await api().get('/users').set(as('staff')).expect(403);
    });

    it('MANAGER manages products and stock but not accounts', async () => {
      const created = await api()
        .post('/products')
        .set(as('manager'))
        .send({ name: 'Bánh Oreo', price: 15000, costPrice: 11000, minStock: 5, supplier: 'Mondelez' })
        .expect(201);
      expect(created.body.barcode).toMatch(/^SP/);

      await api()
        .post('/inventory/movement')
        .set(as('manager'))
        .send({ productId: created.body.id, type: 'IMPORT', quantity: 10 })
        .expect(201);
      const updated = await api()
        .patch(`/products/${created.body.id}`)
        .set(as('manager'))
        .send({ price: 16000, description: 'Bánh quy kem' })
        .expect(200);
      expect(updated.body).toMatchObject({ price: 16000, quantity: 10 });

      await api().delete(`/products/${created.body.id}`).set(as('manager')).expect(200);
      await api().get(`/products/${created.body.id}`).set(as('manager')).expect(404);
      // Lịch sử vẫn còn sau khi xóa mềm.
      const history = await api()
        .get(`/inventory/transactions?productId=${created.body.id}`)
        .set(as('manager'))
        .expect(200);
      expect(history.body.total).toBe(1);

      await api().get('/users').set(as('manager')).expect(403);
    });

    it('ADMIN manages accounts and changes take effect immediately', async () => {
      const users = await api().get('/users').set(as('admin')).expect(200);
      expect(users.body.items.every((user: Record<string, unknown>) => !('passwordHash' in user))).toBe(true);

      await api()
        .patch('/users/user-staff-1')
        .set(as('admin'))
        .send({ role: 'MANAGER' })
        .expect(200);
      // Token cũ của staff giờ mang quyền MANAGER.
      await api().post('/products').set(as('staff')).send({ name: 'Kẹo' }).expect(201);

      await api().patch('/users/user-staff-1').set(as('admin')).send({ active: false }).expect(200);
      await api().get('/products').set(as('staff')).expect(401);

      await api().patch('/users/user-admin-1').set(as('admin')).send({ role: 'STAFF' }).expect(400);
    });

    it('self registration requires admin activation', async () => {
      await api()
        .post('/auth/register')
        .send({ name: 'Người mới', email: 'new@example.com', password: 'secret1' })
        .expect(201);
      await api()
        .post('/auth/login')
        .send({ email: 'new@example.com', password: 'secret1' })
        .expect(401);

      const list = await api().get('/users?search=new@example.com').set(as('admin')).expect(200);
      await api().patch(`/users/${list.body.items[0].id}`).set(as('admin')).send({ active: true }).expect(200);
      const login = await api()
        .post('/auth/login')
        .send({ email: 'new@example.com', password: 'secret1' })
        .expect(201);
      expect(login.body.user.role).toBe('STAFF');
    });
  });

  describe('inventory', () => {
    it('blocks exporting more than in stock', async () => {
      await api()
        .post('/inventory/movement')
        .set(as('staff'))
        .send({ productId: 'product-1', type: 'EXPORT', quantity: 999 })
        .expect(400);
    });

    it('creates one low-stock notification when crossing the threshold', async () => {
      // product-1: tồn 24, tối thiểu 10
      const first = await api()
        .post('/inventory/movement')
        .set(as('staff'))
        .send({ productId: 'product-1', type: 'EXPORT', quantity: 15 })
        .expect(201);
      expect(first.body.alert).toMatchObject({ type: 'LOW_STOCK' });

      const second = await api()
        .post('/inventory/movement')
        .set(as('staff'))
        .send({ productId: 'product-1', type: 'EXPORT', quantity: 1 })
        .expect(201);
      expect(second.body.alert).toBeUndefined();

      const notifications = await api().get('/notifications').set(as('manager')).expect(200);
      expect(notifications.body.unreadCount).toBe(1);
      await api().post('/notifications/read-all').set(as('manager')).expect(201);
      const after = await api().get('/notifications/unread-count').set(as('manager')).expect(200);
      expect(after.body.unreadCount).toBe(0);
    });

    it('adjustment sets the counted quantity and requires a reason', async () => {
      await api()
        .post('/inventory/movement')
        .set(as('manager'))
        .send({ productId: 'product-2', type: 'ADJUSTMENT', quantity: 4 })
        .expect(400);
      const result = await api()
        .post('/inventory/movement')
        .set(as('manager'))
        .send({ productId: 'product-2', type: 'ADJUSTMENT', quantity: 4, reason: 'Hàng hỏng 2 gói' })
        .expect(201);
      expect(result.body.transaction).toMatchObject({ quantity: -2, quantityBefore: 6, quantityAfter: 4 });
    });

    it('returns a stock summary', async () => {
      const summary = await api().get('/inventory/summary').set(as('manager')).expect(200);
      expect(summary.body).toMatchObject({ productCount: 3, outOfStockCount: 1, lowStockCount: 1 });
    });
  });

  describe('uploads', () => {
    it('stores a valid image and rejects fake content', async () => {
      const ok = await api()
        .post('/uploads/image')
        .set(as('manager'))
        .send({ base64: PNG_BASE64, mimeType: 'image/png' })
        .expect(201);
      expect(ok.body.url).toMatch(/^\/uploads\/store-1\/.+\.png$/);

      await api()
        .post('/uploads/image')
        .set(as('manager'))
        .send({ base64: Buffer.from('not an image').toString('base64'), mimeType: 'image/png' })
        .expect(400);

      await api()
        .post('/products')
        .set(as('manager'))
        .send({ name: 'Ảnh ngoài', imageUrl: 'https://evil.example/x.png' })
        .expect(400);
    });
  });
});
