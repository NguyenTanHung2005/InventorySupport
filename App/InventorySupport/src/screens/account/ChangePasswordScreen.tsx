import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, ErrorBanner, Field } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';
import { authService } from '../../services/auth.service';
import { useToken } from '../../store/auth.store';
import { notify } from '../../utils/dialog';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const token = useToken();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mismatch = confirm.length > 0 && confirm !== next;
  const valid = current.length > 0 && next.length >= 6 && confirm === next;

  async function save() {
    setSaving(true);
    setError('');
    try {
      await authService.changePassword(token, current, next);
      notify('Đã đổi mật khẩu');
      navigation.goBack();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Field label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry />
        <Field label="Mật khẩu mới" value={next} onChangeText={setNext} secureTextEntry hint="Tối thiểu 6 ký tự" />
        <Field label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry error={mismatch ? 'Mật khẩu không khớp' : undefined} />
      </Card>
      <ErrorBanner message={error} />
      <Button title="Lưu" loading={saving} disabled={!valid} onPress={save} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
});
