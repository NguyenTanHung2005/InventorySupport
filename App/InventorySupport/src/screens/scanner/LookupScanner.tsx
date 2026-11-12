import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProductCard } from '../../components/ProductCard';
import { Badge, Button, Card, ErrorBanner } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { productService } from '../../services/product.service';
import { useAuth, useToken } from '../../store/auth.store';
import { ScanFormat, ScanResolveResult, StockType } from '../../types';
import { formatMoney } from '../../utils/format';
import { BarcodeCamera } from './BarcodeCamera';

export const FORMAT_LABELS: Record<ScanFormat, string> = {
  APP_QR: 'Tem QR của cửa hàng',
  GS1_DIGITAL_LINK: 'QR chuẩn GS1',
  BARCODE: 'Mã vạch',
  TEXT: 'Mã khác',
};

/** Chế độ Tra cứu: quét một mã → xem giá, tồn, thao tác nhanh (docs/SCAN.md mục 2.2, nhu cầu N1, N6). */
export function LookupScanner({ active }: { active: boolean }) {
  const token = useToken();
  const [result, setResult] = useState<ScanResolveResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function lookup(raw: string) {
    if (busy || result) return;
    setBusy(true);
    setError('');
    try {
      setResult(await productService.resolve(token, raw));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <BarcodeCamera
        visible={active}
        active={active && !result && !busy}
        onScan={(raw) => void lookup(raw)}
        hint="Đưa mã vạch hoặc QR vào khung"
        status={busy ? 'Đang tra cứu...' : result ? 'Đã quét xong' : undefined}
      />
      <ErrorBanner message={error} />
      {result ? <LookupResult result={result} onReset={() => setResult(undefined)} /> : null}
    </View>
  );
}

function LookupResult({ result, onReset }: { result: ScanResolveResult; onReset: () => void }) {
  const navigation = useNavigation<RootNavigation>();
  const { can } = useAuth();
  const openStock = (productId: string, type: StockType) =>
    navigation.navigate('Tabs', { screen: 'Inventory', params: { productId, type, nonce: Date.now() } });
  const { product } = result;

  if (!product) {
    const isProductCode = result.format !== 'TEXT';
    return (
      <Card>
        <View style={styles.row}>
          <Badge label={isProductCode ? 'Chưa có trong kho' : 'Không phải mã sản phẩm'} tone="warning" />
          <Badge label={FORMAT_LABELS[result.format]} tone="muted" />
        </View>
        {/* Chỉ hiển thị nội dung, không tự mở link trong QR lạ. */}
        <Text style={styles.text} selectable numberOfLines={3}>
          Mã: <Text style={styles.bold}>{result.code}</Text>
        </Text>
        {isProductCode && can('PRODUCT_CREATE') ? (
          <Button title="Tạo sản phẩm với mã này" icon="＋" onPress={() => navigation.navigate('ProductForm', { prefill: { barcode: result.code } })} />
        ) : isProductCode ? (
          <Text style={styles.meta}>Báo quản lý để thêm sản phẩm mới.</Text>
        ) : (
          <Text style={styles.meta}>QR này không chứa mã sản phẩm (có thể là link, Wi-Fi...).</Text>
        )}
        <Button title="Quét mã khác" variant="ghost" onPress={onReset} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.row}>
        <Badge label="Đã tìm thấy" tone="success" />
        <Badge label={FORMAT_LABELS[result.format]} tone="muted" />
      </View>
      <ProductCard product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />
      <Text style={styles.price}>
        Giá bán {formatMoney(product.price)} · còn {product.quantity} {product.unit}
      </Text>
      <View style={styles.row}>
        {can('STOCK_EXPORT') ? (
          <Button title="Xuất" icon="⬆" variant="danger" style={styles.flex} disabled={product.quantity === 0} onPress={() => openStock(product.id, 'EXPORT')} />
        ) : null}
        {can('STOCK_IMPORT') ? <Button title="Nhập" icon="⬇" variant="success" style={styles.flex} onPress={() => openStock(product.id, 'IMPORT')} /> : null}
        {can('STOCK_ADJUST') ? <Button title="Kiểm kê" variant="ghost" style={styles.flex} onPress={() => openStock(product.id, 'ADJUSTMENT')} /> : null}
      </View>
      <Button title="Quét mã khác" variant="ghost" onPress={onReset} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1 },
  text: { color: colors.text },
  bold: { fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  price: { color: colors.text, fontWeight: '700' },
});
