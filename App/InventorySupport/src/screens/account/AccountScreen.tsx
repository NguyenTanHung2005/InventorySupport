import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '../../components/ui';
import { API_URL } from '../../constants/config';
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { useAuth } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';

export function AccountScreen() {
  const { user, signOut, can } = useAuth();
  const { enabled: alertsEnabled, unreadCount } = useNotifications();
  const navigation = useNavigation<RootNavigation>();
  if (!user) return null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.role}>{ROLE_LABELS[user.role]}</Text>
      </View>

      <Card>
        <Text style={styles.title}>Quyền của bạn</Text>
        <Text style={styles.meta}>{ROLE_DESCRIPTIONS[user.role]}</Text>
        <View style={styles.permissions}>
          {ROLE_PERMISSIONS[user.role].map((permission) => (
            <Text key={permission} style={styles.permission}>✓ {PERMISSION_LABELS[permission]}</Text>
          ))}
        </View>
      </Card>

      {can('USER_MANAGE') ? (
        <Button title="Quản lý tài khoản nhân viên" icon="👥" onPress={() => navigation.navigate('Users')} />
      ) : null}
      {alertsEnabled ? (
        <Button
          title={`Thông báo tồn kho${unreadCount ? ` (${unreadCount})` : ''}`}
          icon="🔔"
          variant="secondary"
          onPress={() => navigation.navigate('Notifications')}
        />
      ) : null}
      {can('AI_USE') ? (
        <Button title="Trợ lý AI" icon="✨" variant="secondary" onPress={() => navigation.navigate('AiAssistant')} />
      ) : null}
      <Button title="Đổi mật khẩu" variant="ghost" onPress={() => navigation.navigate('ChangePassword')} />
      <Button title="Đăng xuất" variant="danger" onPress={signOut} />
      <Text style={styles.footer}>Cửa hàng: {user.storeId} · Máy chủ: {API_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  profile: { backgroundColor: colors.dark, borderRadius: 18, padding: 22, alignItems: 'center' },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#b9d1ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '900', color: colors.text },
  name: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 10 },
  email: { color: '#b8c5da', marginTop: 4 },
  role: { color: colors.primary, backgroundColor: '#e1ebff', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, marginTop: 10, fontWeight: '800', overflow: 'hidden' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.muted },
  permissions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permission: { color: colors.success, backgroundColor: colors.successSoft, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, fontSize: 12, overflow: 'hidden' },
  footer: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
