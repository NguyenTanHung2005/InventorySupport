import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  AppNotification,
  AuthUser,
  NotificationType,
  Product,
  UserRole,
} from '../common/types.js';
import { paginate, parsePageQuery } from '../common/validation.js';
const ALERT_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private readonly database: DatabaseService) {}

  async onStockChanged(
    product: Product,
    before: number,
  ): Promise<AppNotification | undefined> {
    const empty = before > 0 && product.quantity === 0;
    if (
      !empty &&
      (before <= product.minStock || product.quantity > product.minStock)
    )
      return undefined;
    const type =
      product.quantity === 0
        ? NotificationType.OUT_OF_STOCK
        : NotificationType.LOW_STOCK;
    return this.database.insert('notifications', {
      id: this.database.createId('notification'),
      storeId: product.storeId,
      productId: product.id,
      type,
      title:
        type === NotificationType.OUT_OF_STOCK ? 'Hết hàng' : 'Sắp hết hàng',
      message:
        type === NotificationType.OUT_OF_STOCK
          ? `${product.name} đã hết hàng. Cần nhập thêm.`
          : `${product.name} chỉ còn ${product.quantity} ${product.unit} (tối thiểu ${product.minStock}).`,
      readBy: [],
      createdAt: product.updatedAt,
    });
  }
  async list(
    user: AuthUser,
    query: { page?: string; limit?: string; unreadOnly?: string },
  ) {
    const all = await this.storeNotifications(user);
    const items = all
      .filter(
        (item) => query.unreadOnly !== 'true' || !item.readBy.includes(user.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => this.present(item, user));
    return {
      ...paginate(items, parsePageQuery(query)),
      unreadCount: all.filter((item) => !item.readBy.includes(user.id)).length,
    };
  }
  async unreadCount(user: AuthUser): Promise<number> {
    return (await this.storeNotifications(user)).filter(
      (item) => !item.readBy.includes(user.id),
    ).length;
  }
  async markRead(user: AuthUser, id: string) {
    if (!ALERT_ROLES.includes(user.role))
      throw new NotFoundException('Không tìm thấy thông báo');
    const item = await this.database.update(
      'notifications',
      { _id: id, storeId: user.storeId },
      { $addToSet: { readBy: user.id } },
    );
    if (!item) throw new NotFoundException('Không tìm thấy thông báo');
    return this.present(item, user);
  }
  async markAllRead(user: AuthUser) {
    for (const item of await this.storeNotifications(user))
      await this.markRead(user, item.id);
    return { unreadCount: 0 };
  }
  async registerPushToken(user: AuthUser, token: unknown) {
    if (
      typeof token !== 'string' ||
      !/^Expo(nent)?PushToken\[.+\]$/.test(token)
    )
      throw new BadRequestException('Expo push token không hợp lệ');
    await this.database.transaction(async (db) => {
      for (const other of await db.find('users', { pushTokens: token })) {
        await db.update(
          'users',
          { _id: other.id },
          { $pull: { pushTokens: token } },
        );
      }
      await db.update(
        'users',
        { _id: user.id },
        { $addToSet: { pushTokens: token } },
      );
    });
    return { registered: true };
  }
  private async storeNotifications(user: AuthUser) {
    return ALERT_ROLES.includes(user.role)
      ? this.database.find('notifications', { storeId: user.storeId })
      : [];
  }
  private present(item: AppNotification, user: AuthUser) {
    const { readBy, ...rest } = item;
    return { ...rest, read: readBy.includes(user.id) };
  }
  async sendPush(notification: AppNotification): Promise<void> {
    try {
      const users = await this.database.find('users', {
        storeId: notification.storeId,
        active: true,
        role: { $in: ALERT_ROLES },
      });
      const tokens = users.flatMap((user) => user.pushTokens);
      if (!tokens.length || process.env.VITEST) return;
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: notification.title,
            body: notification.message,
            sound: 'default',
            data: {
              productId: notification.productId,
              notificationId: notification.id,
            },
          })),
        ),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) this.logger.warn(`Expo push lỗi ${response.status}`);
    } catch {
      this.logger.warn('Không gửi được push notification; giao dịch đã lưu');
    }
  }
}
