import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProductCard } from '../../components/ProductCard';
import { Button, Card, ErrorBanner, Field, Segmented, SuccessBanner } from '../../components/ui';
import { STOCK_TYPE_LABELS, STOCK_TYPE_PERMISSION } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import type { RootStackParamList, TabParamList } from '../../navigation/types';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { useAuth, useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { Product, StockType } from '../../types';
import { parseNumberInput } from '../../utils/format';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;

const REASONS: Record<StockType, string[]> = {
  IMPORT: ['Nhập từ nhà cung cấp', 'Khách trả hàng'],
  EXPORT: ['Bán lẻ', 'Hàng hỏng / hết hạn', 'Dùng nội bộ'],
  ADJUSTMENT: ['Kiểm kê định kỳ', 'Hàng hỏng', 'Thất thoát'],
};

export function InventoryScreen({ route, navigation }: Props) {
  const token = useToken();
  const { can } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const allowedTypes = useMemo(
    () => (['EXPORT', 'IMPORT', 'ADJUSTMENT'] as StockType[]).filter((type) => can(STOCK_TYPE_PERMISSION[type])),
    [can],
  );

  const [type, setType] = useState<StockType>(allowedTypes[0] ?? 'EXPORT');
  const [selected, setSelected] = useState<Product>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Nhận sản phẩm/loại giao dịch từ màn chi tiết hoặc màn quét mã.
  const { productId, type: requestedType, nonce } = route.params ?? {};
  useEffect(() => {
    if (!productId && !requestedType) return;
    let cancelled = false;
    (async () => {
      const product = productId ? await productService.get(token, productId) : undefined;
      if (cancelled) return;
      if (requestedType && allowedTypes.includes(requestedType)) setType(requestedType);
      setSuccess('');
      setError('');
      if (product) {
        setSelected(product);
        setQuantity(requestedType === 'ADJUSTMENT' ? String(product.quantity) : '1');
      }
    })().catch((cause: Error) => {
      if (!cancelled) setError(cause.message);
    });
    return () => {
      cancelled = true;
    };
  }, [token, productId, requestedType, nonce, allowedTypes]);

  // Tìm sản phẩm (debounce 300ms).
  useEffect(() => {
    if (selected) return;
    const timer = setTimeout(() => {
      setSearching(true);
      productService
        .list(token, { search: query.trim(), limit: 8, sort: 'name' })
        .then((page) => setResults(page.items))
        .catch((cause: Error) => setError(cause.message))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [token, query, selected]);

  const amount = parseNumberInput(quantity);
  const isAdjustment = type === 'ADJUSTMENT';
  const validationError = !selected
    ? undefined
    : amount === undefined || !Number.isInteger(amount) || amount < (isAdjustment ? 0 : 1)
      ? isAdjustment ? 'Nhập số lượng thực tế (≥ 0)' : 'Số lượng phải là số nguyên ≥ 1'
      : type === 'EXPORT' && amount > selected.quantity
        ? `Chỉ còn ${selected.quantity} ${selected.unit} trong kho`
        : isAdjustment && !reason.trim()
          ? 'Kiểm kê cần ghi lý do chênh lệch'
          : undefined;
  const after = selected && amount !== undefined
    ? isAdjustment ? amount : selected.quantity + (type === 'EXPORT' ? -amount : amount)
    : undefined;

  async function submit() {
    if (!selected || validationError || amount === undefined) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await inventoryService.move(token, { productId: selected.id, type, quantity: amount, reason: reason.trim() || undefined });
      setSelected(result.product);
      setSuccess(
        `${STOCK_TYPE_LABELS[type]} thành công: ${result.product.name} còn ${result.product.quantity} ${result.product.unit}.` +
          (result.alert ? `\n⚠ ${result.alert.message}` : ''),
      );
      setQuantity(isAdjustment ? String(result.product.quantity) : '1');
      setReason('');
      if (result.alert) void refreshNotifications();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function changeProduct() {
    setSelected(undefined);
    setSuccess('');
    setError('');
    navigation.setParams({ productId: undefined, type: undefined });
  }

  if (!allowedTypes.length) {
    return <View style={styles.page}><Text style={styles.meta}>Bạn không có quyền nhập/xuất kho.</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {allowedTypes.length > 1 ? (
          <Segmented
            value={type}
            onChange={(next) => {
              setType(next);
              setError('');
              if (next === 'ADJUSTMENT' && selected) setQuantity(String(selected.quantity));
            }}
            options={allowedTypes.map((value) => ({ value, label: STOCK_TYPE_LABELS[value] }))}
          />
        ) : (
          <Text style={styles.title}>{STOCK_TYPE_LABELS[type]}</Text>
        )}

        {selected ? (
          <View style={{ gap: 8 }}>
            <ProductCard product={selected} selected />
            <Text style={styles.link} onPress={changeProduct}>Đổi sản phẩm</Text>
          </View>
        ) : (
          <Card>
            <Text style={styles.label}>Chọn sản phẩm</Text>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm theo tên hoặc barcode"
              placeholderTextColor="#9aa5b5"
            />
            <Button title="Quét mã để chọn" icon="📷" variant="ghost" onPress={() => navigation.navigate('Scanner')} />
            {searching ? <ActivityIndicator color={colors.primary} /> : null}
            {results.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={() => {
                  setSelected(product);
                  setQuantity(isAdjustment ? String(product.quantity) : '1');
                  setSuccess('');
                }}
              />
            ))}
            {!searching && !results.length ? <Text style={styles.meta}>Không tìm thấy sản phẩm.</Text> : null}
          </Card>
        )}

        {selected ? (
          <Card>
            <Field
              label={isAdjustment ? `Số lượng thực tế đếm được (${selected.unit})` : `Số lượng ${type === 'IMPORT' ? 'nhập' : 'xuất'} (${selected.unit})`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              error={validationError && quantity ? validationError : undefined}
            />
            {after !== undefined && !validationError ? (
              <Text style={styles.preview}>
                Tồn kho: {selected.quantity} → <Text style={{ fontWeight: '800', color: after <= selected.minStock ? colors.warning : colors.success }}>{after}</Text> {selected.unit}
                {after <= selected.minStock ? '  (dưới mức tối thiểu)' : ''}
              </Text>
            ) : null}
            <Field label={isAdjustment ? 'Lý do chênh lệch *' : 'Ghi chú'} value={reason} onChangeText={setReason} placeholder="Không bắt buộc" />
            <View style={styles.reasons}>
              {REASONS[type].map((item) => (
                <Text key={item} style={styles.reasonChip} onPress={() => setReason(item)}>{item}</Text>
              ))}
            </View>
            <Button
              title={`Xác nhận ${STOCK_TYPE_LABELS[type].toLowerCase()}`}
              variant={type === 'EXPORT' ? 'danger' : type === 'IMPORT' ? 'success' : 'primary'}
              loading={submitting}
              disabled={Boolean(validationError)}
              onPress={submit}
            />
          </Card>
        ) : null}

        <SuccessBanner message={success} />
        <ErrorBanner message={error} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  label: { color: colors.text, fontWeight: '800' },
  meta: { color: colors.muted, padding: 16 },
  link: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
  search: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text },
  preview: { color: colors.text },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonChip: { color: colors.primary, backgroundColor: colors.primarySoft, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
});
