import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TransactionItem } from '../../components/TransactionItem';
import { Card, Chip, EmptyState, ErrorBanner, SectionTitle } from '../../components/ui';
import { STOCK_TYPE_LABELS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import { usePaginated } from '../../hooks/usePaginated';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import type { RootNavigation } from '../../navigation/types';
import { inventoryService } from '../../services/inventory.service';
import { useToken } from '../../store/auth.store';
import { InventorySummary, StockType } from '../../types';
import { formatMoney, formatNumber, toDateInput } from '../../utils/format';

type Period = 'today' | '7d' | '30d' | 'all';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'all', label: 'Tất cả' },
];

function periodRange(period: Period): { from?: string; to?: string } {
  if (period === 'all') return {};
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === '7d') start.setDate(start.getDate() - 6);
  if (period === '30d') start.setDate(start.getDate() - 29);
  return { from: start.toISOString(), to: toDateInput(new Date()) };
}

export function ReportsScreen() {
  const token = useToken();
  const navigation = useNavigation<RootNavigation>();
  const [period, setPeriod] = useState<Period>('7d');
  const [type, setType] = useState<StockType>();
  const [summary, setSummary] = useState<InventorySummary>();
  const [summaryError, setSummaryError] = useState('');
  const range = useMemo(() => periodRange(period), [period]);

  const loadSummary = useCallback(() => {
    inventoryService
      .summary(token, range)
      .then((next) => {
        setSummary(next);
        setSummaryError('');
      })
      .catch((cause: Error) => setSummaryError(cause.message));
  }, [token, range]);
  useEffect(loadSummary, [loadSummary]);

  const list = usePaginated(
    (page, limit) => inventoryService.transactions(token, { page, limit, type, ...range }),
    [token, type, range],
  );
  useRefreshOnFocus(() => {
    loadSummary();
    void list.reload();
  });

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionItem item={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.productId })} />
      )}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshing={list.refreshing}
      onRefresh={() => {
        loadSummary();
        void list.refresh();
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {PERIODS.map((item) => <Chip key={item.value} label={item.label} active={period === item.value} onPress={() => setPeriod(item.value)} />)}
          </ScrollView>
          <ErrorBanner message={summaryError} onRetry={loadSummary} />
          {summary ? (
            <>
              <View style={styles.grid}>
                <Stat label="Đã nhập" value={formatNumber(summary.importedQuantity)} color={colors.success} />
                <Stat label="Đã xuất" value={formatNumber(summary.exportedQuantity)} color={colors.danger} />
                <Stat label="Kiểm kê" value={formatNumber(summary.adjustmentCount)} color={colors.warning} />
              </View>
              <Card>
                <Row label="Doanh thu ước tính (xuất × giá bán)" value={formatMoney(summary.exportRevenue)} />
                <Row label="Giá trị tồn kho (giá nhập)" value={formatMoney(summary.stockValue)} />
                <Row label="Sản phẩm sắp hết / hết hàng" value={`${summary.lowStockCount} / ${summary.outOfStockCount}`} />
              </Card>
              {summary.topExported.length ? (
                <Card>
                  <Text style={styles.cardTitle}>Xuất nhiều nhất</Text>
                  {summary.topExported.map((item, index) => {
                    const max = summary.topExported[0].exported || 1;
                    return (
                      <View key={item.productId} style={{ gap: 4 }}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.text} numberOfLines={1}>{index + 1}. {item.productName}</Text>
                          <Text style={styles.bold}>{item.exported}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.bar, { width: `${Math.max(4, (item.exported / max) * 100)}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </Card>
              ) : null}
            </>
          ) : !summaryError ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}

          <SectionTitle title={`Sổ giao dịch (${list.total})`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Tất cả" active={!type} onPress={() => setType(undefined)} />
            {(Object.keys(STOCK_TYPE_LABELS) as StockType[]).map((value) => (
              <Chip key={value} label={STOCK_TYPE_LABELS[value]} active={type === value} onPress={() => setType(value)} />
            ))}
          </ScrollView>
          <ErrorBanner message={list.error} onRetry={list.reload} />
        </View>
      }
      ListEmptyComponent={list.loading ? null : <EmptyState text="Không có giao dịch trong khoảng thời gian này." />}
      ListFooterComponent={list.loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.meta, { flex: 1 }]}>{label}</Text>
      <Text style={styles.bold}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 4 },
  chips: { gap: 8 },
  grid: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  value: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  meta: { color: colors.muted, fontSize: 12 },
  cardTitle: { color: colors.text, fontWeight: '800' },
  text: { color: colors.text, flex: 1 },
  bold: { color: colors.text, fontWeight: '800' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  barTrack: { height: 6, backgroundColor: colors.primarySoft, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
});
