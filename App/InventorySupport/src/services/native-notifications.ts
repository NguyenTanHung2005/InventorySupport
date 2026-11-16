import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';

export async function loadNativeNotifications() {
  // shortcut: Expo Go uses in-app polling; enable local alerts after channel support is verified.
  if (Platform.OS === 'web' || isRunningInExpoGo()) return;
  const notifications = await import('expo-notifications');
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  return notifications;
}
