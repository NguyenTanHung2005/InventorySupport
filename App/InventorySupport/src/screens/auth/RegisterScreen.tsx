import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Button, Field } from '../../components/ui';
import { AuthLayout, authStyles as styles } from './LoginScreen';

export function RegisterScreen({
  onSubmit,
  onLogin,
  busy,
  error,
}: {
  onSubmit: (name: string, email: string, password: string) => void;
  onLogin: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <AuthLayout>
      <Text style={styles.heading}>Tạo tài khoản nhân viên</Text>
      <Text style={styles.hint}>Tài khoản mới cần quản trị viên kích hoạt trước khi đăng nhập.</Text>
      <Field label="Họ và tên" value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry hint="Tối thiểu 6 ký tự" />
      <Field label="Nhập lại mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry error={mismatch ? 'Mật khẩu không khớp' : undefined} />
      <Button
        title="Đăng ký"
        loading={busy}
        disabled={!name.trim() || !email.trim() || password.length < 6 || confirm !== password}
        onPress={() => onSubmit(name.trim(), email.trim(), password)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={onLogin}>
        <Text style={styles.link}>Đã có tài khoản? Đăng nhập</Text>
      </Pressable>
    </AuthLayout>
  );
}
