import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Field } from '../../components/ui';
import { API_URL, DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../constants/config';
import { colors } from '../../constants/theme';

export function LoginScreen({
  onSubmit,
  onRegister,
  busy,
  error,
  notice,
}: {
  onSubmit: (email: string, password: string) => void;
  onRegister: () => void;
  busy?: boolean;
  error?: string;
  notice?: string;
}) {
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  return (
    <AuthLayout>
      <Text style={styles.heading}>Đăng nhập</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.hint}>Tài khoản demo:</Text>
      <View style={styles.chips}>
        {DEMO_ACCOUNTS.map((account) => (
          <Chip
            key={account.email}
            label={account.label}
            active={email === account.email}
            onPress={() => {
              setEmail(account.email);
              setPassword(DEMO_PASSWORD);
            }}
          />
        ))}
      </View>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={() => onSubmit(email.trim(), password)} />
      <Button title="Đăng nhập" loading={busy} onPress={() => onSubmit(email.trim(), password)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={onRegister}>
        <Text style={styles.link}>Chưa có tài khoản? Đăng ký</Text>
      </Pressable>
      <ServerStatus />
    </AuthLayout>
  );
}

/** Hiển thị địa chỉ máy chủ và trạng thái kết nối để dễ chẩn đoán lỗi trên simulator/điện thoại. */
function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((response) => !cancelled && setStatus(response.ok ? 'ok' : 'fail'))
      .catch(() => !cancelled && setStatus('fail'))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  return (
    <View style={styles.server}>
      <Text style={styles.hint}>
        Máy chủ: {API_URL} · {status === 'checking' ? 'đang kiểm tra...' : status === 'ok' ? '🟢 đã kết nối' : '🔴 không kết nối được'}
      </Text>
      {status === 'fail' ? (
        <Text style={styles.hint}>
          Kiểm tra backend đã chạy, điện thoại cùng mạng Wi-Fi, tường lửa cho phép cổng 3000, hoặc đặt EXPO_PUBLIC_API_URL.
        </Text>
      ) : null}
    </View>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>IS</Text>
            </View>
            <Text style={styles.title}>Inventory Support</Text>
            <Text style={styles.subtitle}>Kiểm kê cửa hàng nhỏ, đơn giản mỗi ngày</Text>
          </View>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const authStyles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 20, fontWeight: '800' },
  error: { color: colors.danger, textAlign: 'center' },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '700', padding: 4 },
  hint: { color: colors.muted, fontSize: 12 },
});

const styles = StyleSheet.create({
  ...authStyles,
  page: { flex: 1, backgroundColor: colors.dark },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 22, maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 26 },
  logo: { width: 66, height: 66, borderRadius: 20, backgroundColor: '#b9d1ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { color: colors.text, fontSize: 24, fontWeight: '900' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#b8c5da', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 12 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  server: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 },
  notice: { backgroundColor: colors.successSoft, color: colors.success, padding: 10, borderRadius: 10 },
});
