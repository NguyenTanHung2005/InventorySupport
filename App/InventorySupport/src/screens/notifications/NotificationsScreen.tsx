import { useLayoutEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EmptyState, ErrorBanner } from '../../components/ui';
import { colors } from '../../constants/theme';
import { usePaginated } from '../../hooks/usePaginated';
import type { RootStackParamList } from '../../navigation/types';
import { notificationService } from '../../services/notification.service';
import { useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { AppNotification } from '../../types';
import { formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const token = useToken();
  const { setUnreadCount, unreadCount } = useNotifications();
  const list = usePaginated(async (page, limit) => {
    const result = await notificationService.list(token, { page, limit });
    setUnreadCount(result.unreadCount);
    return result;
  }, [token]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unreadCount > 0 ? (
          <Text style={styles.headerAction} onPress={readAll}>Đọc hết</Text>
        ) : null,
    });
  });

  async function readAll() {
    await notificationService.markAllRead(token);
    setUnreadCount(0);
    list.setItems((items) => items.map((item) => ({ ...item, read: true })));
  }

  async function open(item: AppNotification) {
    if (!item.read) {
      list.setItems((items) => items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
      setUnreadCount(Math.max(0, unreadCount - 1));
      void notificationService.markRead(token, item.id).catch(() => undefined);
    }
    navigation.navigate('ProductDetail', { productId: item.productId });
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => open(item)} style={[styles.item, !item.read && styles.unread]}>
          <Text style={styles.icon}>{item.type === 'OUT_OF_STOCK' ? '⛔' : '⚠️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
          </View>
          {!item.read ? <View style={styles.dot} /> : null}
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      ListHeaderComponent={<ErrorBanner message={list.error} onRetry={list.reload} />}
      ListEmptyComponent={list.loading ? null : <EmptyState text="Chưa có cảnh báo tồn kho nào." />}
      ListFooterComponent={list.loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  headerAction: { color: colors.primary, fontWeight: '800', paddingHorizontal: 8 },
  item: { flexDirection: 'row', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'flex-start' },
  unread: { backgroundColor: '#fffaf0', borderColor: '#f3d9a4' },
  icon: { fontSize: 20 },
  title: { color: colors.text, fontWeight: '800' },
  message: { color: colors.text, marginTop: 2 },
  time: { color: colors.muted, fontSize: 12, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginTop: 4 },
});
