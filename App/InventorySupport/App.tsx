import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/store/auth.store';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';

function RootNavigator() {
  const { token } = useAuth();
  return <NavigationContainer>{token ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><RootNavigator /></AuthProvider></SafeAreaProvider>;
}
