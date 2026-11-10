import { Alert, Platform } from 'react-native';

/**
 * Hộp thoại xác nhận chạy được cả trên web (react-native-web không hỗ trợ nút trong Alert)
 * lẫn Android/iOS.
 */
export function confirmAction(title: string, message: string, confirmText = 'Đồng ý'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
