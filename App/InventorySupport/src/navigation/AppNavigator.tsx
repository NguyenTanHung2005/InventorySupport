import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NotificationBell } from '../components/NotificationBell';
import { colors } from '../constants/theme';
import { useAuth } from '../store/auth.store';
import { AccountScreen } from '../screens/account/AccountScreen';
import { ChangePasswordScreen } from '../screens/account/ChangePasswordScreen';
import { AiScreen } from '../screens/ai/AiScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { ProductDetailScreen } from '../screens/products/ProductDetailScreen';
import { ProductFormScreen } from '../screens/products/ProductFormScreen';
import { ProductsScreen } from '../screens/products/ProductsScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { ScannerScreen } from '../screens/scanner/ScannerScreen';
import { UserFormScreen } from '../screens/users/UserFormScreen';
import { UsersScreen } from '../screens/users/UsersScreen';
import type { RootStackParamList, TabParamList } from './types';

const Tabs = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.55 }}>{icon}</Text>;
}

const tabIcon = (icon: string) =>
  function renderTabIcon({ focused }: { focused: boolean }) {
    return <TabIcon icon={icon} focused={focused} />;
  };

function MainTabs() {
  const { can } = useAuth();
  const canMoveStock = can('STOCK_IMPORT') || can('STOCK_EXPORT') || can('STOCK_ADJUST');
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerRight: () => <NotificationBell />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Tổng quan', tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="Products" component={ProductsScreen} options={{ title: 'Sản phẩm', tabBarIcon: tabIcon('📦') }} />
      {canMoveStock ? (
        <Tabs.Screen
          name="Inventory"
          component={InventoryScreen}
          options={{ title: can('STOCK_IMPORT') ? 'Nhập / xuất' : 'Xuất kho', tabBarIcon: tabIcon('🔁') }}
        />
      ) : null}
      <Tabs.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Quét', tabBarIcon: tabIcon('📷') }} />
      {can('REPORT_VIEW') ? (
        <Tabs.Screen name="Reports" component={ReportsScreen} options={{ title: 'Báo cáo', tabBarIcon: tabIcon('📊') }} />
      ) : null}
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Tài khoản', tabBarIcon: tabIcon('👤') }} />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { can } = useAuth();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackTitle: 'Quay lại',
      }}
    >
      <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Chi tiết sản phẩm' }} />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={({ route }) => ({ title: route.params?.productId ? 'Sửa sản phẩm' : 'Thêm sản phẩm' })}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Thông báo' }} />
      <Stack.Screen name="AiAssistant" component={AiScreen} options={{ title: 'Trợ lý AI' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Đổi mật khẩu' }} />
      {can('USER_MANAGE') ? (
        <>
          <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Quản lý tài khoản' }} />
          <Stack.Screen
            name="UserForm"
            component={UserFormScreen}
            options={({ route }) => ({ title: route.params?.user ? 'Sửa tài khoản' : 'Thêm tài khoản' })}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
