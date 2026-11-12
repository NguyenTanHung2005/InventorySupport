import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AssistantProvider } from './src/store/assistant.store';
import { AuthProvider, useAuth } from './src/store/auth.store';
import { NotificationProvider } from './src/store/notification.store';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';

function RootNavigator() {
  const { token, user } = useAuth();
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
