import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ProductCard } from '../../components/ProductCard';
import { TransactionItem } from '../../components/TransactionItem';
import { Card, EmptyState, ErrorBanner, Loading, SectionTitle } from '../../components/ui';
import { ROLE_LABELS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { inventoryService } from '../../services/inventory.service';
import { useAuth, useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { InventorySummary, Product, StockTransaction } from '../../types';
import { formatMoney, formatNumber } from '../../utils/format';

export function DashboardScreen() {
  const token = useToken();
  const { user, can } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const navigation = useNavigation<RootNavigation>();
  const [summary, setSummary] = useState<InventorySummary>();
  const [low, setLow] = useState<Product[]>([]);
  const [recent, setRecent] = useState<StockTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextSummary, lowStock, transactions] = await Promise.all([
        inventoryService.summary(token),
        inventoryService.lowStock(token),
        inventoryService.transactions(token, { limit: 5 }),
      ]);
      setSummary(nextSummary);
      setLow(lowStock);
      setRecent(transactions.items);
      void refreshNotifications();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [token, refreshNotifications]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Xin chào, {user?.name}!</Text>
        <Text style={styles.heroText}>{user ? ROLE_LABELS[user.role] : ''} · Theo dõi cửa hàng hôm nay</Text>
      </View>

      <ErrorBanner message={error} onRetry={load} />
      {!summary && !error ? <Loading /> : null}

      {summary ? (
        <>
          <View style={styles.grid}>
            <Stat label="Sản phẩm" value={formatNumber(summary.productCount)} />
            <Stat label="Tổng tồn" value={formatNumber(summary.totalQuantity)} />
          </View>
          <View style={styles.grid}>
            <Stat label="Sắp hết" value={formatNumber(summary.lowStockCount)} tone="warning" />
            <Stat label="Hết hàng" value={formatNumber(summary.outOfStockCount)} tone="danger" />
          </View>
          {can('REPORT_VIEW') ? (
            <Card>
              <Text style={styles.meta}>Giá trị tồn kho (theo giá nhập)</Text>
              <Text style={styles.money}>{formatMoney(summary.stockValue)}</Text>
              <Text style={styles.meta}>Theo giá bán: {formatMoney(summary.retailValue)}</Text>
            </Card>
          ) : null}
        </>
      ) : null}

      <SectionTitle title="Cảnh báo tồn kho" />
      {low.length ? (
        low.slice(0, 6).map((product) => (
          <ProductCard key={product.id} product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />
        ))
      ) : summary ? (
        <EmptyState text="Tồn kho đang ở mức an toàn." />
      ) : null}

      <SectionTitle title="Giao dịch gần đây" />
      <Card>
        {recent.length ? (
          recent.map((item) => (
            <TransactionItem key={item.id} item={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })} />
          ))
        ) : (
          <Text style={styles.meta}>Chưa có giao dịch nào.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={[styles.value, tone === 'warning' && { color: colors.warning }, tone === 'danger' && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: { backgroundColor: colors.dark, padding: 20, borderRadius: 18 },
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '800' },
  heroText: { color: '#b8c5da', marginTop: 6 },
  grid: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  value: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 4 },
  money: { color: colors.text, fontSize: 22, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12 },
});
