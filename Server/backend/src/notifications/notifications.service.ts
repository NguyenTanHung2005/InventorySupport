import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  AppNotification,
  AuthUser,
  NotificationType,
  Product,
  UserRole,
} from '../common/types.js';
import { paginate, parsePageQuery } from '../common/validation.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Vai trò nhận cảnh báo tồn kho. */
const ALERT_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Gọi sau mỗi lần tồn kho thay đổi. Chỉ tạo cảnh báo khi tồn kho vừa
   * "vượt ngưỡng" xuống dưới minStock (hoặc về 0), tránh spam mỗi lần xuất.
   */
  onStockChanged(product: Product, quantityBefore: number): AppNotification | undefined {
    const wasLow = quantityBefore <= product.minStock;
    const isLow = product.quantity <= product.minStock;
    const becameEmpty = quantityBefore > 0 && product.quantity === 0;
    if (!becameEmpty && (wasLow || !isLow)) return undefined;

    const type = product.quantity === 0 ? NotificationType.OUT_OF_STOCK : NotificationType.LOW_STOCK;
    const notification: AppNotification = {
      id: this.database.createId('notification'),
      storeId: product.storeId,
      type,
      productId: product.id,
      title: type === NotificationType.OUT_OF_STOCK ? 'Hết hàng' : 'Sắp hết hàng',
      message:
        type === NotificationType.OUT_OF_STOCK
          ? `${product.name} đã hết hàng. Cần nhập thêm.`
          : `${product.name} chỉ còn ${product.quantity} ${product.unit} (tối thiểu ${product.minStock}).`,
      readBy: [],
      createdAt: new Date().toISOString(),
    };
    this.database.notifications.push(notification);
    void this.sendPush(notification);
    return notification;
  }

  list(user: AuthUser, query: { page?: string; limit?: string; unreadOnly?: string }) {
    const items = this.storeNotifications(user)
      .filter((item) => query.unreadOnly !== 'true' || !item.readBy.includes(user.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => this.present(item, user));
    return { ...paginate(items, parsePageQuery(query)), unreadCount: this.unreadCount(user) };
  }

  unreadCount(user: AuthUser): number {
    return this.storeNotifications(user).filter((item) => !item.readBy.includes(user.id)).length;
  }

  markRead(user: AuthUser, id: string) {
    const notification = this.storeNotifications(user).find((item) => item.id === id);
    if (!notification) throw new NotFoundException('Không tìm thấy thông báo');
    if (!notification.readBy.includes(user.id)) notification.readBy.push(user.id);
    this.database.save();
    return this.present(notification, user);
  }

  markAllRead(user: AuthUser) {
    for (const notification of this.storeNotifications(user)) {
      if (!notification.readBy.includes(user.id)) notification.readBy.push(user.id);
    }
    this.database.save();
    return { unreadCount: 0 };
  }

  registerPushToken(user: AuthUser, token: unknown) {
    if (typeof token !== 'string' || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
      throw new BadRequestException('Expo push token không hợp lệ');
    }
    // Một thiết bị chỉ thuộc về một tài khoản tại một thời điểm.
    for (const other of this.database.users) {
      other.pushTokens = other.pushTokens.filter((existing) => existing !== token);
    }
    const stored = this.database.users.find((candidate) => candidate.id === user.id);
    stored?.pushTokens.push(token);
    this.database.save();
    return { registered: true };
  }

  /** Thông báo chỉ dành cho người có quyền nhận cảnh báo kho. */
  private storeNotifications(user: AuthUser) {
    if (!ALERT_ROLES.includes(user.role)) return [];
    return this.database.notifications.filter((item) => item.storeId === user.storeId);
  }

  private present(notification: AppNotification, user: AuthUser) {
    const { readBy, ...rest } = notification;
    return { ...rest, read: readBy.includes(user.id) };
  }

  private async sendPush(notification: AppNotification) {
    const tokens = this.database.users
      .filter((user) => user.storeId === notification.storeId && user.active && ALERT_ROLES.includes(user.role))
      .flatMap((user) => user.pushTokens);
    if (!tokens.length || process.env.VITEST) return;
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: notification.title,
            body: notification.message,
            sound: 'default',
            data: { productId: notification.productId, notificationId: notification.id },
          })),
        ),
      });
      if (!response.ok) this.logger.warn(`Expo push lỗi ${response.status}: ${await response.text()}`);
    } catch (error) {
      this.logger.warn(`Không gửi được push notification: ${(error as Error).message}`);
    }
  }
}
