import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/store/auth.store';
import { NotificationProvider } from './src/store/notification.store';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';

function RootNavigator() {
  const { token } = useAuth();
  return <NavigationContainer>{token ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
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
