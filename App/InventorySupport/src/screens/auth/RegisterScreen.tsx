import { AuthForm } from './LoginScreen';
export function RegisterScreen({ onSubmit, onLogin, busy, error }: { onSubmit: (name: string, email: string, password: string) => void; onLogin: () => void; busy?: boolean; error?: string }) {
  return <AuthForm title="Tạo tài khoản mới" submitLabel={busy ? 'Đang đăng ký...' : 'Đăng ký'} showName onSubmit={(email, password, name) => onSubmit(name ?? '', email, password)} onFooter={onLogin} footer="Đã có tài khoản? Đăng nhập" error={error} />;
}
