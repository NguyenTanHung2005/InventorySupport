import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { authService } from '../services/auth.service';
import { useAuth } from '../store/auth.store';

const Stack = createNativeStackNavigator();

export function AuthNavigator() {
  const { signIn } = useAuth();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitLogin(email: string, password: string) {
    setBusy(true);
    setError('');
    try {
      const result = await authService.login(email, password);
      signIn(result.accessToken, result.user);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(name: string, email: string, password: string, goToLogin: () => void) {
    setBusy(true);
    setError('');
    try {
      const result = await authService.register(name, email, password);
      setNotice(result.message);
      goToLogin();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onSubmit={submitLogin}
            onRegister={() => {
              setError('');
              setNotice('');
              navigation.navigate('Register');
            }}
            busy={busy}
            error={error}
            notice={notice}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {({ navigation }) => (
          <RegisterScreen
            onSubmit={(name, email, password) => submitRegister(name, email, password, () => navigation.navigate('Login'))}
            onLogin={() => {
              setError('');
              navigation.navigate('Login');
            }}
            busy={busy}
            error={error}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
