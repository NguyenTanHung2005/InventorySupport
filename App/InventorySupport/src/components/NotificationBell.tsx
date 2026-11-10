import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../constants/theme';
import type { RootNavigation } from '../navigation/types';
import { useNotifications } from '../store/notification.store';

export function NotificationBell() {
  const navigation = useNavigation<RootNavigation>();
  const { enabled, unreadCount } = useNotifications();
  if (!enabled) return null;
  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      style={styles.button}
      accessibilityLabel={`Thông báo, ${unreadCount} chưa đọc`}
      hitSlop={10}
    >
      <Text style={styles.icon}>🔔</Text>
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: 14, paddingVertical: 4 },
  icon: { fontSize: 20 },
  badge: { position: 'absolute', top: -4, right: 6, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
