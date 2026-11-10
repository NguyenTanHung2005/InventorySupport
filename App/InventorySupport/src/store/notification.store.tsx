import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { NOTIFICATION_POLL_MS } from '../constants/config';
import { notificationService } from '../services/notification.service';
import { useAuth } from './auth.store';

/** Vai trò nhận cảnh báo tồn kho (khớp backend). */
const ALERT_ROLES = ['ADMIN', 'MANAGER'];

interface NotificationStore {
  enabled: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  setUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationStore>({
  enabled: false,
  unreadCount: 0,
  refresh: async () => {},
  setUnreadCount: () => {},
});

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Cảnh báo tồn kho chạy theo 2 đường:
 * 1. Push notification từ server (cần development build + EAS projectId) - hoạt động cả khi đóng app.
 * 2. Polling mỗi 30 giây khi app đang mở; có cảnh báo mới thì hiện local notification.
 *    Đường này chạy được cả trong Expo Go và trên web (hiển thị badge).
 */
export function NotificationProvider({ children }: PropsWithChildren) {
  const { token, user } = useAuth();
  const enabled = Boolean(token && user && ALERT_ROLES.includes(user.role));
  const [unreadCount, setUnreadCount] = useState(0);
  const lastCount = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!token || !enabled) return;
    try {
      const { unreadCount: count } = await notificationService.unreadCount(token);
      const previous = lastCount.current;
      lastCount.current = count;
      setUnreadCount(count);
      if (previous !== undefined && count > previous) await showLatestAsLocalNotification(token);
    } catch {
      // Bỏ qua lỗi mạng tạm thời; lần poll sau sẽ thử lại.
    }
  }, [token, enabled]);

  useEffect(() => {
    lastCount.current = undefined;
    if (!enabled) return;
    // refresh() chỉ setState sau `await` (gọi API đếm thông báo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), NOTIFICATION_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, refresh]);

  useEffect(() => {
    if (enabled && token) void registerForPush(token);
  }, [enabled, token]);

  const value = useMemo(
    () => ({
      enabled,
      // Tài khoản không nhận cảnh báo (hoặc vừa đăng xuất) luôn hiển thị 0.
      unreadCount: enabled ? unreadCount : 0,
      refresh,
      setUnreadCount: (count: number) => {
        lastCount.current = count;
        setUnreadCount(count);
      },
    }),
    [enabled, unreadCount, refresh],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}

async function showLatestAsLocalNotification(token: string) {
  if (Platform.OS === 'web') return;
  const { items } = await notificationService.list(token, { limit: 1, unreadOnly: true });
  const latest = items[0];
  if (!latest) return;
  await Notifications.scheduleNotificationAsync({
    content: { title: latest.title, body: latest.message, data: { productId: latest.productId } },
    trigger: null,
  });
}

async function registerForPush(token: string) {
  if (Platform.OS === 'web') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Cảnh báo tồn kho',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!status.granted) return;

    // Push từ xa cần projectId của EAS; thiếu thì vẫn dùng polling + local notification.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await notificationService.registerPushToken(token, data);
  } catch (error) {
    console.warn('Không đăng ký được push notification', error);
  }
}
