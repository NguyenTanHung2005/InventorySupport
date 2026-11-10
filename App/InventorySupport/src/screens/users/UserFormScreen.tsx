import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, ErrorBanner, Field, SwitchRow } from '../../components/ui';
import { PERMISSION_LABELS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';
import { userService } from '../../services/user.service';
import { useAuth, useToken } from '../../store/auth.store';
import { UserRole } from '../../types';
import { confirmAction, notify } from '../../utils/dialog';

type Props = NativeStackScreenProps<RootStackParamList, 'UserForm'>;
const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'];

export function UserFormScreen({ route, navigation }: Props) {
  const existing = route.params?.user;
  const token = useToken();
  const { user: me, refreshUser } = useAuth();
  const isSelf = existing?.id === me?.id;

  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(existing?.role ?? 'STAFF');
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const passwordInvalid = (existing ? password.length > 0 : true) && password.length < 6;
  const valid = name.trim() && email.trim() && !passwordInvalid;

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (existing) {
        await userService.update(token, existing.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          active,
          ...(password ? { password } : {}),
        });
        if (isSelf) await refreshUser();
      } else {
        await userService.create(token, { name: name.trim(), email: email.trim(), password, role, active });
      }
      navigation.goBack();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    const ok = await confirmAction('Xóa tài khoản?', `Tài khoản ${existing.email} sẽ bị xóa vĩnh viễn. Bạn có thể chỉ khóa tài khoản thay vì xóa.`, 'Xóa');
    if (!ok) return;
    setDeleting(true);
    try {
      await userService.remove(token, existing.id);
      navigation.goBack();
    } catch (cause) {
      notify('Không xóa được', (cause as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Field label="Họ và tên" value={name} onChangeText={setName} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field
          label={existing ? 'Đặt lại mật khẩu' : 'Mật khẩu'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={existing ? 'Để trống nếu không đổi' : ''}
          error={password && passwordInvalid ? 'Tối thiểu 6 ký tự' : undefined}
          hint={existing ? undefined : 'Tối thiểu 6 ký tự'}
        />
      </Card>

      <Card>
        <Text style={styles.title}>Vai trò</Text>
        {ROLES.map((value) => (
          <Pressable
            key={value}
            disabled={isSelf}
            onPress={() => setRole(value)}
            style={[styles.role, role === value && styles.roleActive, isSelf && value !== role && styles.disabled]}
            accessibilityRole="radio"
            accessibilityState={{ checked: role === value }}
          >
            <Text style={styles.radio}>{role === value ? '◉' : '○'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleName}>{ROLE_LABELS[value]}</Text>
              <Text style={styles.meta}>{ROLE_DESCRIPTIONS[value]}</Text>
            </View>
          </Pressable>
        ))}
        <Text style={styles.meta}>
          Quyền: {ROLE_PERMISSIONS[role].map((permission) => PERMISSION_LABELS[permission]).join(', ')}
        </Text>
        {isSelf ? <Text style={styles.meta}>Bạn không thể tự đổi vai trò hoặc khóa tài khoản của mình.</Text> : null}
      </Card>

      <Card>
        <SwitchRow
          label="Đang hoạt động"
          hint={active ? 'Có thể đăng nhập' : 'Không thể đăng nhập (chờ kích hoạt hoặc bị khóa)'}
          value={active}
          onChange={isSelf ? () => undefined : setActive}
        />
      </Card>

      <ErrorBanner message={error} />
      <Button title={existing ? 'Lưu thay đổi' : 'Tạo tài khoản'} loading={saving} disabled={!valid} onPress={save} />
      {existing && !isSelf ? <Button title="Xóa tài khoản" variant="ghost" loading={deleting} onPress={remove} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  role: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  roleActive: { borderColor: colors.primary, backgroundColor: '#f3f7ff' },
  disabled: { opacity: 0.4 },
  radio: { color: colors.primary, fontSize: 18 },
  roleName: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
});
