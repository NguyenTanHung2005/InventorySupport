import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Badge, Button, Chip, EmptyState, ErrorBanner } from '../../components/ui';
import { ROLE_LABELS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import { usePaginated } from '../../hooks/usePaginated';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/user.service';
import { useAuth, useToken } from '../../store/auth.store';
import { UserRole } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Users'>;
const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'];

export function UsersScreen({ navigation }: Props) {
  const token = useToken();
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole>();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const list = usePaginated((page, limit) => userService.list(token, { page, limit, search, role }), [token, search, role]);
  useRefreshOnFocus(() => void list.reload());

  const pending = list.items.filter((user) => !user.active).length;

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable style={[styles.item, !item.active && styles.inactive]} onPress={() => navigation.navigate('UserForm', { user: item })}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{item.name}{item.id === me?.id ? ' (bạn)' : ''}</Text>
            <Text style={styles.meta}>{item.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={ROLE_LABELS[item.role]} tone={item.role === 'ADMIN' ? 'danger' : item.role === 'MANAGER' ? 'primary' : 'muted'} />
            {!item.active ? <Badge label="Chưa kích hoạt / khóa" tone="warning" /> : null}
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Button title="Thêm tài khoản" icon="＋" onPress={() => navigation.navigate('UserForm')} />
          <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Tìm tên hoặc email" placeholderTextColor="#9aa5b5" autoCapitalize="none" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Tất cả" active={!role} onPress={() => setRole(undefined)} />
            {ROLES.map((value) => <Chip key={value} label={ROLE_LABELS[value]} active={role === value} onPress={() => setRole(value)} />)}
          </ScrollView>
          {pending ? <Text style={styles.pending}>{pending} tài khoản đang chờ kích hoạt hoặc bị khóa.</Text> : null}
          <ErrorBanner message={list.error} onRetry={list.reload} />
        </View>
      }
      ListEmptyComponent={list.loading ? null : <EmptyState text="Không có tài khoản phù hợp." />}
      ListFooterComponent={list.loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 12 },
  search: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text },
  pending: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 10, borderRadius: 10, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  inactive: { opacity: 0.75, borderStyle: 'dashed' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 17 },
  name: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
});
