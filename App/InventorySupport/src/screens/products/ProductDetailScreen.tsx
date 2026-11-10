import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductImage } from '../../components/ProductImage';
import { StockBadge } from '../../components/StockBadge';
import { TransactionItem } from '../../components/TransactionItem';
import { Button, Card, ErrorBanner, InfoRow, Loading, SectionTitle } from '../../components/ui';
import { colors } from '../../constants/theme';
import { usePaginated } from '../../hooks/usePaginated';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import type { RootStackParamList } from '../../navigation/types';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { useAuth, useToken } from '../../store/auth.store';
import { Product, StockType } from '../../types';
import { confirmAction, notify } from '../../utils/dialog';
import { formatDateTime, formatMoney } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const token = useToken();
  const { can } = useAuth();
  const [product, setProduct] = useState<Product>();
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const history = usePaginated(
    (page, limit) => inventoryService.transactions(token, { productId, page, limit }),
    [token, productId],
  );

  const load = useCallback(async () => {
    try {
      const next = await productService.get(token, productId);
      setProduct(next);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [token, productId]);

  useEffect(() => {
    // load() chỉ setState sau `await` (tải dữ liệu từ API).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useRefreshOnFocus(() => {
    void load();
    void history.reload();
  });

  function openStock(type: StockType) {
    navigation.navigate('Tabs', { screen: 'Inventory', params: { productId, type, nonce: Date.now() } });
  }

  async function remove() {
    if (!product) return;
    const ok = await confirmAction(
      'Xóa sản phẩm?',
      `"${product.name}" sẽ bị ẩn khỏi danh sách. Lịch sử nhập/xuất vẫn được giữ lại cho báo cáo.`,
      'Xóa',
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await productService.remove(token, product.id);
      navigation.goBack();
    } catch (cause) {
      notify('Không xóa được', (cause as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (!product) {
    return (
      <View style={styles.page}>
        {error ? <View style={styles.content}><ErrorBanner message={error} onRetry={load} /></View> : <Loading />}
      </View>
    );
  }

  const margin = product.price - product.costPrice;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ProductImage uri={product.imageUrl} name={product.name} size={96} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.meta}>{product.category} · {product.barcode}</Text>
          <StockBadge quantity={product.quantity} minStock={product.minStock} />
        </View>
      </View>

      <Card style={styles.stockCard}>
        <View>
          <Text style={styles.meta}>Tồn kho hiện tại</Text>
          <Text style={styles.quantity}>{product.quantity} <Text style={styles.unit}>{product.unit}</Text></Text>
        </View>
        <Text style={styles.meta}>Tối thiểu: {product.minStock}</Text>
      </Card>

      <View style={styles.actions}>
        {can('STOCK_IMPORT') ? <Button title="Nhập" icon="⬇" variant="success" onPress={() => openStock('IMPORT')} style={styles.action} /> : null}
        {can('STOCK_EXPORT') ? <Button title="Xuất" icon="⬆" variant="danger" onPress={() => openStock('EXPORT')} style={styles.action} disabled={product.quantity === 0} /> : null}
        {can('STOCK_ADJUST') ? <Button title="Kiểm kê" variant="ghost" onPress={() => openStock('ADJUSTMENT')} style={styles.action} /> : null}
      </View>

      <Card>
        <InfoRow label="Giá bán" value={formatMoney(product.price)} />
        <InfoRow label="Giá nhập" value={formatMoney(product.costPrice)} />
        <InfoRow label="Lãi / đơn vị" value={formatMoney(margin)} />
        <InfoRow label="Nhà cung cấp" value={product.supplier || '—'} />
        <InfoRow label="Cập nhật" value={formatDateTime(product.updatedAt)} />
      </Card>

      <Card>
        <Text style={styles.label}>Mô tả</Text>
        <Text style={styles.description}>{product.description || 'Chưa có mô tả.'}</Text>
      </Card>

      {can('PRODUCT_UPDATE') || can('PRODUCT_DELETE') ? (
        <View style={styles.actions}>
          {can('PRODUCT_UPDATE') ? (
            <Button title="Sửa thông tin" icon="✎" variant="secondary" onPress={() => navigation.navigate('ProductForm', { productId })} style={styles.action} />
          ) : null}
          {can('PRODUCT_DELETE') ? (
            <Button title="Xóa" variant="ghost" loading={deleting} onPress={remove} style={styles.action} />
          ) : null}
        </View>
      ) : null}

      <SectionTitle title={`Lịch sử nhập / xuất (${history.total})`} />
      <Card>
        <ErrorBanner message={history.error} onRetry={history.reload} />
        {history.items.map((item) => <TransactionItem key={item.id} item={item} showProduct={false} />)}
        {!history.loading && !history.items.length ? <Text style={styles.meta}>Chưa có giao dịch.</Text> : null}
        {history.loading ? <ActivityIndicator color={colors.primary} /> : null}
        {history.hasMore && !history.loading ? <Button title="Xem thêm" variant="ghost" onPress={history.loadMore} /> : null}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  stockCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  quantity: { color: colors.text, fontSize: 32, fontWeight: '900' },
  unit: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  label: { color: colors.text, fontWeight: '800' },
  description: { color: colors.text, lineHeight: 20 },
});
