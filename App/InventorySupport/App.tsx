import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { Button, ErrorBanner, Loading } from './src/components/ui';
import { colors } from './src/constants/theme';
import { AssistantProvider } from './src/store/assistant.store';
import { AuthProvider, useAuth } from './src/store/auth.store';
import { NotificationProvider } from './src/store/notification.store';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';

function RootNavigator() {
  const { token, user, restoring, sessionError, retrySession, signOut } = useAuth();
  if (restoring) return <Loading />;
  if (sessionError) return (
    <View style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>Khôi phục đăng nhập</Text>
      <ErrorBanner message={sessionError} />
      <Button title="Thử lại" onPress={retrySession} />
      <Button title="Xóa phiên và đăng nhập lại" variant="secondary" onPress={signOut} />
    </View>
  );
  return (
    <NavigationContainer>
      {token && user ? (
        // key theo user: đăng xuất / đổi tài khoản sẽ xóa lịch sử chat của trợ lý.
        <AssistantProvider key={user.id}>
          <AppNavigator />
        </AssistantProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
