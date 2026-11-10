import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthUser, ProductInput, StockType } from '../types';

export type TabParamList = {
  Dashboard: undefined;
  Products: undefined;
  Inventory: { productId?: string; type?: StockType; nonce?: number } | undefined;
  Scanner: undefined;
  Reports: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ProductDetail: { productId: string };
  /** Không có productId = tạo mới; `prefill` dùng khi đi từ quét mã / AI. */
  ProductForm: { productId?: string; prefill?: Partial<ProductInput> } | undefined;
  Notifications: undefined;
  Users: undefined;
  UserForm: { user?: AuthUser } | undefined;
  AiAssistant: undefined;
  ChangePassword: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
