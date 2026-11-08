import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ProductsScreen } from '../screens/products/ProductsScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { ScannerScreen } from '../screens/scanner/ScannerScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { AiScreen } from '../screens/ai/AiScreen';

const Tabs = createBottomTabNavigator();
export function AppNavigator() {
  return <Tabs.Navigator screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#f5f7fb' }, headerTintColor: '#17233b', tabBarActiveTintColor: '#2f6fed', tabBarInactiveTintColor: '#68758a' }}><Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Tổng quan' }} /><Tabs.Screen name="Products" component={ProductsScreen} options={{ title: 'Sản phẩm' }} /><Tabs.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Nhập / xuất' }} /><Tabs.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Quét mã' }} /><Tabs.Screen name="Ai" component={AiScreen} options={{ title: 'Trợ lý AI' }} /><Tabs.Screen name="Reports" component={ReportsScreen} options={{ title: 'Báo cáo' }} /><Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Tài khoản' }} /></Tabs.Navigator>;
}
