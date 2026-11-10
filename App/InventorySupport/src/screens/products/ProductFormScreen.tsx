import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Chip, ErrorBanner, Field, Loading } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { resolveImageUrl } from '../../services/api';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { pickImage, uploadService } from '../../services/upload.service';
import { useAuth, useToken } from '../../store/auth.store';
import { notify } from '../../utils/dialog';
import { formatMoney, parseNumberInput } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductForm'>;

const UNITS = ['cái', 'chai', 'lon', 'gói', 'hộp', 'kg', 'thùng'];

interface FormState {
  name: string;
  barcode: string;
  category: string;
  unit: string;
  price: string;
  costPrice: string;
  minStock: string;
  supplier: string;
  description: string;
  imageUrl?: string;
  initialQuantity: string;
}

const EMPTY: FormState = {
  name: '',
  barcode: '',
  category: '',
  unit: 'cái',
  price: '',
  costPrice: '',
  minStock: '5',
  supplier: '',
  description: '',
  initialQuantity: '',
};

export function ProductFormScreen({ route, navigation }: Props) {
  const productId = route.params?.productId;
  const prefill = route.params?.prefill;
  const token = useToken();
  const { can } = useAuth();
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    ...(prefill
      ? {
          name: prefill.name ?? '',
          barcode: prefill.barcode ?? '',
          category: prefill.category ?? '',
          unit: prefill.unit ?? 'cái',
          description: prefill.description ?? '',
          imageUrl: prefill.imageUrl,
        }
      : {}),
  }));
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    void productService.categories(token).then(setCategories).catch(() => undefined);
    if (!productId) return;
    productService
      .get(token, productId)
      .then((product) =>
        setForm({
          name: product.name,
          barcode: product.barcode,
          category: product.category,
          unit: product.unit,
          price: String(product.price || ''),
          costPrice: String(product.costPrice || ''),
          minStock: String(product.minStock),
          supplier: product.supplier,
          description: product.description,
          imageUrl: product.imageUrl,
          initialQuantity: '',
        }),
      )
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [token, productId]);

  async function chooseImage(source: 'camera' | 'library') {
    try {
      const image = await pickImage(source);
      if (!image) return;
      setUploading(true);
      const { url } = await uploadService.uploadImage(token, image);
      set('imageUrl')(url);
    } catch (cause) {
      notify('Không tải được ảnh', (cause as Error).message);
    } finally {
      setUploading(false);
    }
  }

  /** Dùng AI chuẩn hóa tên, gợi ý danh mục/đơn vị/mô tả từ tên đang nhập. */
  async function suggest() {
    if (!form.name.trim()) return;
    setSuggesting(true);
    try {
      const result = await aiService.normalizeProduct(token, form.name.trim());
      const first = result.suggestions[0];
      if (!first) return;
      setForm((current) => ({
        ...current,
        name: first.normalizedName || current.name,
        category: first.category || current.category,
        unit: first.unit || current.unit,
        description: current.description || first.description,
        barcode: current.barcode || first.barcode || '',
      }));
    } catch (cause) {
      notify('AI chưa gợi ý được', (cause as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  const price = parseNumberInput(form.price);
  const costPrice = parseNumberInput(form.costPrice);
  const minStock = parseNumberInput(form.minStock);
  const initialQuantity = parseNumberInput(form.initialQuantity);
  const errors = {
    name: !form.name.trim() ? 'Nhập tên sản phẩm' : undefined,
    price: form.price && price === undefined ? 'Giá không hợp lệ' : undefined,
    costPrice: form.costPrice && costPrice === undefined ? 'Giá không hợp lệ' : undefined,
    minStock: form.minStock && (minStock === undefined || !Number.isInteger(minStock)) ? 'Phải là số nguyên' : undefined,
    initialQuantity: form.initialQuantity && (initialQuantity === undefined || !Number.isInteger(initialQuantity)) ? 'Phải là số nguyên' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const warnLoss = price !== undefined && costPrice !== undefined && price > 0 && costPrice > price;

  async function save() {
    setSubmitted(true);
    if (hasErrors) return;
    setSaving(true);
    setError('');
    const input = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit.trim() || undefined,
      price: price ?? 0,
      costPrice: costPrice ?? 0,
      minStock: minStock ?? 0,
      supplier: form.supplier.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl ?? '',
    };
    try {
      if (productId) {
        await productService.update(token, productId, input);
        navigation.goBack();
        return;
      }
      const created = await productService.create(token, { ...input, imageUrl: form.imageUrl });
      if (initialQuantity && initialQuantity > 0 && can('STOCK_IMPORT')) {
        await inventoryService.move(token, { productId: created.id, type: 'IMPORT', quantity: initialQuantity, reason: 'Tồn ban đầu' });
      }
      navigation.replace('ProductDetail', { productId: created.id });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  const imageUri = resolveImageUrl(form.imageUrl);
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.section}>Ảnh sản phẩm</Text>
          <View style={styles.imageRow}>
            <View style={styles.imageBox}>
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.image} />
              ) : (
                <Text style={styles.meta}>Chưa có ảnh</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Button title="Chụp ảnh" icon="📷" variant="secondary" onPress={() => chooseImage('camera')} disabled={uploading} />
              <Button title="Chọn từ thư viện" variant="ghost" onPress={() => chooseImage('library')} disabled={uploading} />
              {form.imageUrl ? <Text style={styles.remove} onPress={() => set('imageUrl')(undefined)}>Gỡ ảnh</Text> : null}
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.section}>Thông tin cơ bản</Text>
          <Field label="Tên sản phẩm *" value={form.name} onChangeText={set('name')} placeholder="Ví dụ: Coca-Cola 390ml" error={submitted ? errors.name : undefined} />
          {can('AI_USE') ? (
            <Button title="Gợi ý danh mục, đơn vị, mô tả bằng AI" icon="✨" variant="secondary" loading={suggesting} disabled={!form.name.trim()} onPress={suggest} />
          ) : null}
          <Field label="Mã barcode" value={form.barcode} onChangeText={set('barcode')} placeholder="Để trống để hệ thống tự sinh" keyboardType="number-pad" autoCapitalize="none" />
          <Field label="Danh mục" value={form.category} onChangeText={set('category')} placeholder="Ví dụ: Nước giải khát" />
          {categories.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((item) => <Chip key={item} label={item} active={form.category === item} onPress={() => set('category')(item)} />)}
            </ScrollView>
          ) : null}
          <Text style={styles.label}>Đơn vị tính</Text>
          <View style={styles.wrap}>
            {UNITS.map((unit) => <Chip key={unit} label={unit} active={form.unit === unit} onPress={() => set('unit')(unit)} />)}
          </View>
          <Field label="Đơn vị khác" value={UNITS.includes(form.unit) ? '' : form.unit} onChangeText={set('unit')} placeholder="Nhập nếu không có ở trên" />
        </Card>

        <Card>
          <Text style={styles.section}>Giá & tồn kho</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Giá bán (₫)" value={form.price} onChangeText={set('price')} keyboardType="number-pad" placeholder="0" error={submitted ? errors.price : undefined} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Giá nhập (₫)" value={form.costPrice} onChangeText={set('costPrice')} keyboardType="number-pad" placeholder="0" error={submitted ? errors.costPrice : undefined} />
            </View>
          </View>
          {price !== undefined && costPrice !== undefined ? (
            <Text style={[styles.meta, warnLoss && { color: colors.danger }]}>
              Lãi mỗi {form.unit || 'đơn vị'}: {formatMoney(price - costPrice)}{warnLoss ? ' (giá bán thấp hơn giá nhập!)' : ''}
            </Text>
          ) : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Tồn tối thiểu" value={form.minStock} onChangeText={set('minStock')} keyboardType="number-pad" hint="Cảnh báo khi tồn ≤ mức này" error={submitted ? errors.minStock : undefined} />
            </View>
            {!productId && can('STOCK_IMPORT') ? (
              <View style={{ flex: 1 }}>
                <Field label="Tồn ban đầu" value={form.initialQuantity} onChangeText={set('initialQuantity')} keyboardType="number-pad" placeholder="0" error={submitted ? errors.initialQuantity : undefined} />
              </View>
            ) : null}
          </View>
          {productId ? <Text style={styles.meta}>Số lượng tồn chỉ thay đổi qua Nhập / Xuất / Kiểm kê để giữ lịch sử.</Text> : null}
        </Card>

        <Card>
          <Text style={styles.section}>Thông tin thêm</Text>
          <Field label="Nhà cung cấp" value={form.supplier} onChangeText={set('supplier')} placeholder="Ví dụ: Đại lý Minh Phát" />
          <Field label="Mô tả" value={form.description} onChangeText={set('description')} multiline placeholder="Quy cách, hương vị, ghi chú bảo quản..." />
        </Card>

        <ErrorBanner message={error} />
        <Button title={productId ? 'Lưu thay đổi' : 'Tạo sản phẩm'} loading={saving} disabled={uploading} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  section: { color: colors.text, fontWeight: '800', fontSize: 16 },
  label: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  chips: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  imageBox: { width: 120, height: 120, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  remove: { color: colors.danger, fontWeight: '700', textAlign: 'center', padding: 4 },
});
