import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ProductCard } from '../../components/ProductCard';
import { Badge, Button, Card, Chip, ErrorBanner, Segmented, SuccessBanner, SwitchRow } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { pickImage, uploadService } from '../../services/upload.service';
import { useAuth, useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { AiResult, AiSuggestion, InvoiceLine, InvoiceScanResult, Product } from '../../types';
import { confirmAction } from '../../utils/dialog';
import { formatMoney, parseNumberInput } from '../../utils/format';

type Task = 'product' | 'invoice';
type Stage = 'idle' | 'uploading' | 'analyzing';

/** Quét bằng ảnh (docs/SCAN.md mục 3): nhận diện sản phẩm hoặc đọc phiếu nhập. */
export function ImageScanner() {
  const token = useToken();
  const { can } = useAuth();
  const navigation = useNavigation<RootNavigation>();
  const [task, setTask] = useState<Task>('product');
  const [provider, setProvider] = useState<'claude' | 'heuristic'>();
  const [preview, setPreview] = useState<string>();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [productResult, setProductResult] = useState<AiResult>();
  const [invoice, setInvoice] = useState<InvoiceScanResult>();

  useEffect(() => {
    aiService.status(token).then((status) => setProvider(status.provider)).catch(() => undefined);
  }, [token]);

  async function scan(source: 'camera' | 'library') {
    setError('');
    setProductResult(undefined);
    setInvoice(undefined);
    try {
      const image = await pickImage(source);
      if (!image) return;
      setPreview(image.uri);
      setStage('uploading');
      const { url } = await uploadService.uploadImage(token, image);
      setStage('analyzing');
      if (task === 'product') setProductResult(await aiService.scanImage(token, url));
      else setInvoice(await aiService.scanInvoice(token, url));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setStage('idle');
    }
  }

  const canInvoice = can('STOCK_IMPORT');
  return (
    <View style={{ gap: 12 }}>
      {canInvoice ? (
        <Segmented<Task>
          value={task}
          onChange={(value) => {
            setTask(value);
            setPreview(undefined);
            setProductResult(undefined);
            setInvoice(undefined);
            setError('');
          }}
          options={[
            { value: 'product', label: 'Nhận diện sản phẩm' },
            { value: 'invoice', label: 'Đọc phiếu nhập' },
          ]}
        />
      ) : null}

      <Card>
        <Text style={styles.label}>{task === 'product' ? 'Chụp bao bì sản phẩm' : 'Chụp phiếu giao hàng / hóa đơn'}</Text>
        <Text style={styles.meta}>
          {task === 'product'
            ? 'Dùng cho hàng không có mã vạch, mã bị mờ, hoặc để tạo nhanh sản phẩm mới. Chụp rõ tên và quy cách.'
            : 'AI đọc từng dòng hàng (tên, số lượng, đơn giá) và ghép với sản phẩm trong kho. Bạn duyệt lại trước khi nhập kho.'}
        </Text>
        {provider === 'heuristic' ? (
          <Text style={styles.warning}>Máy chủ chưa cấu hình AI (ANTHROPIC_API_KEY). Hãy dùng quét mã hoặc nhập tay.</Text>
        ) : null}
        <View style={styles.row}>
          <Button title="Chụp ảnh" icon="📷" style={styles.flex} loading={stage !== 'idle'} onPress={() => scan('camera')} />
          <Button title="Chọn ảnh" variant="ghost" style={styles.flex} disabled={stage !== 'idle'} onPress={() => scan('library')} />
        </View>
        {task === 'product' ? (
          <Button title="Mô tả bằng chữ thay vì ảnh" variant="secondary" onPress={() => navigation.navigate('AiAssistant', { mode: 'normalize' })} />
        ) : null}
      </Card>

      {preview ? (
        <View style={styles.previewBox}>
          <Image source={{ uri: preview }} style={styles.preview} />
          {stage !== 'idle' ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.previewText}>{stage === 'uploading' ? 'Đang tải ảnh lên...' : task === 'product' ? 'AI đang nhận diện...' : 'AI đang đọc phiếu...'}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ErrorBanner message={error} />

      {productResult ? (
        productResult.suggestions.length ? (
          productResult.suggestions.map((suggestion, index) => (
            <SuggestionCard key={`${suggestion.normalizedName}-${index}`} suggestion={suggestion} imageUrl={productResult.imageUrl} />
          ))
        ) : (
          <Card>
            <Text style={styles.text}>AI không nhận ra sản phẩm nào trong ảnh. Hãy chụp gần và rõ nhãn hơn.</Text>
          </Card>
        )
      ) : null}

      {invoice ? <InvoiceReview invoice={invoice} onDone={() => { setInvoice(undefined); setPreview(undefined); }} /> : null}
    </View>
  );
}

/* --------------------------------- Nhận diện sản phẩm --------------------------------- */

function SuggestionCard({ suggestion, imageUrl }: { suggestion: AiSuggestion; imageUrl?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { can } = useAuth();
  const confidence = Math.round(suggestion.confidence * 100);
  const matches = suggestion.matchedProducts ?? [];
  return (
    <Card>
      <View style={styles.between}>
        <Text style={styles.suggestionName}>{suggestion.normalizedName}</Text>
        <Badge label={`${confidence}%`} tone={confidence >= 75 ? 'success' : confidence >= 50 ? 'warning' : 'danger'} />
      </View>
      <Text style={styles.meta}>
        {suggestion.category} · {suggestion.unit}
        {suggestion.barcode ? ` · ${suggestion.barcode}` : ''}
      </Text>
      <Text style={styles.text}>{suggestion.description}</Text>
      {matches.length ? (
        <>
          <Text style={styles.label}>Sản phẩm có sẵn khớp với ảnh:</Text>
          {matches.map((product) => (
            <ProductCard key={product.id} product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />
          ))}
        </>
      ) : (
        <Text style={styles.meta}>Chưa có sản phẩm nào trong kho khớp với gợi ý này.</Text>
      )}
      {can('PRODUCT_CREATE') ? (
        <Button
          title={matches.length ? 'Vẫn tạo sản phẩm mới' : 'Tạo sản phẩm từ gợi ý'}
          variant={matches.length ? 'ghost' : 'primary'}
          onPress={() =>
            navigation.navigate('ProductForm', {
              prefill: {
                name: suggestion.normalizedName,
                category: suggestion.category,
                unit: suggestion.unit,
                description: suggestion.description,
                barcode: suggestion.barcode,
                // Dùng luôn ảnh vừa chụp làm ảnh sản phẩm.
                imageUrl,
              },
            })
          }
        />
      ) : null}
      <Text style={styles.hint}>Hãy kiểm tra lại thông tin AI gợi ý trước khi lưu.</Text>
    </Card>
  );
}

/* ----------------------------------- Đọc phiếu nhập ----------------------------------- */

interface ReviewLine {
  line: InvoiceLine;
  /** undefined = chưa chọn, null = bỏ qua dòng này. */
  product: Product | null | undefined;
  quantity: string;
}

function InvoiceReview({ invoice, onDone }: { invoice: InvoiceScanResult; onDone: () => void }) {
  const token = useToken();
  const { can } = useAuth();
  const navigation = useNavigation<RootNavigation>();
  const { refresh: refreshNotifications } = useNotifications();
  const [rows, setRows] = useState<ReviewLine[]>(() =>
    invoice.lines.map((line) => ({ line, product: line.candidates[0], quantity: String(line.quantity || '') })),
  );
  const [updateCost, setUpdateCost] = useState(can('PRODUCT_UPDATE'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!invoice.readable || !invoice.lines.length) {
    return (
      <Card>
        <Text style={styles.text}>AI không đọc được dòng hàng nào. Hãy chụp thẳng, đủ sáng, thấy rõ toàn bộ phiếu.</Text>
      </Card>
    );
  }

  const update = (index: number, patch: Partial<ReviewLine>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  const ready = rows.filter((row) => row.product && (parseNumberInput(row.quantity) ?? 0) > 0);
  const unresolved = rows.filter((row) => row.product === undefined).length;

  async function submit() {
    // Gộp các dòng cùng sản phẩm (backend không nhận trùng sản phẩm trong một lệnh).
    const merged = new Map<string, { product: Product; quantity: number; unitPrice: number }>();
    for (const row of ready) {
      const product = row.product as Product;
      const entry = merged.get(product.id) ?? { product, quantity: 0, unitPrice: row.line.unitPrice };
      entry.quantity += parseNumberInput(row.quantity) ?? 0;
      merged.set(product.id, entry);
    }
    const items = [...merged.values()];
    const ok = await confirmAction(
      'Nhập kho từ phiếu?',
      `${items.length} sản phẩm, tổng ${items.reduce((sum, item) => sum + item.quantity, 0)} đơn vị.${unresolved ? `\n${unresolved} dòng chưa chọn sản phẩm sẽ bị bỏ qua.` : ''}`,
      'Nhập kho',
    );
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      const reason = ['Phiếu nhập', invoice.supplier, invoice.date && `ngày ${invoice.date}`].filter(Boolean).join(' ');
      const result = await inventoryService.batch(token, {
        type: 'IMPORT',
        reason,
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      });
      // Cập nhật giá nhập theo phiếu (không ảnh hưởng phiếu nhập đã lưu nếu lỗi).
      let costUpdated = 0;
      if (updateCost && can('PRODUCT_UPDATE')) {
        for (const item of items) {
          if (item.unitPrice > 0 && item.unitPrice !== item.product.costPrice) {
            try {
              await productService.update(token, item.product.id, { costPrice: item.unitPrice });
              costUpdated += 1;
            } catch {
              // Bỏ qua, người dùng có thể sửa giá nhập trong màn sản phẩm.
            }
          }
        }
      }
      if (result.alerts.length) void refreshNotifications();
      setSuccess(`Đã nhập kho ${result.count} sản phẩm${costUpdated ? `, cập nhật giá nhập ${costUpdated} sản phẩm` : ''}.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <View style={{ gap: 12 }}>
        <SuccessBanner message={success} />
        <Button title="Quét phiếu khác" variant="secondary" onPress={onDone} />
      </View>
    );
  }

  return (
    <Card>
      <Text style={styles.label}>Duyệt phiếu nhập</Text>
      <Text style={styles.meta}>
        {[invoice.supplier || 'Không rõ nhà cung cấp', invoice.date].filter(Boolean).join(' · ')} · {rows.length} dòng
      </Text>
      {rows.map((row, index) => (
        <InvoiceRow
          key={row.line.index}
          row={row}
          onChange={(patch) => update(index, patch)}
          onCreate={() =>
            navigation.navigate('ProductForm', {
              prefill: { name: row.line.name, unit: row.line.unit || undefined, costPrice: row.line.unitPrice || undefined, barcode: row.line.barcode || undefined },
            })
          }
        />
      ))}
      {can('PRODUCT_UPDATE') ? (
        <SwitchRow label="Cập nhật giá nhập theo phiếu" hint="Chỉ với dòng có đơn giá khác giá nhập hiện tại" value={updateCost} onChange={setUpdateCost} />
      ) : null}
      <ErrorBanner message={error} />
      <Button title={`Nhập kho ${ready.length} dòng`} variant="success" loading={saving} disabled={!ready.length} onPress={submit} />
      <Text style={styles.hint}>AI có thể đọc sai: hãy đối chiếu số lượng với phiếu giấy trước khi lưu.</Text>
    </Card>
  );
}

function InvoiceRow({ row, onChange, onCreate }: { row: ReviewLine; onChange: (patch: Partial<ReviewLine>) => void; onCreate: () => void }) {
  const token = useToken();
  const { can } = useAuth();
  const { line, product } = row;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    if (!searching || !query.trim()) return;
    const timer = setTimeout(() => {
      productService.list(token, { search: query.trim(), limit: 5 }).then((page) => setResults(page.items)).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [token, searching, query]);

  const unitMismatch = product && line.unit && line.unit.toLowerCase() !== product.unit.toLowerCase();
  const options = [...line.candidates, ...results.filter((item) => !line.candidates.some((candidate) => candidate.id === item.id))];

  return (
    <View style={[styles.invoiceRow, product === null && styles.skipped]}>
      <View style={styles.between}>
        <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
        {line.confidence < 0.6 ? <Badge label="Đọc chưa chắc" tone="warning" /> : null}
      </View>
      <Text style={styles.meta}>
        Phiếu: {line.quantity} {line.unit || ''}
        {line.unitPrice ? ` × ${formatMoney(line.unitPrice)}` : ''}
        {line.barcode ? ` · ${line.barcode}` : ''}
      </Text>

      {product === null ? (
        <Text style={styles.link} onPress={() => onChange({ product: line.candidates[0] })}>Đã bỏ qua · Hoàn tác</Text>
      ) : (
        <>
          <View style={styles.wrap}>
            {options.map((option) => (
              <Chip key={option.id} label={`${option.name} (${option.unit})`} active={product?.id === option.id} onPress={() => onChange({ product: option })} />
            ))}
          </View>
          {!options.length ? <Text style={styles.warningText}>Chưa khớp sản phẩm nào trong kho.</Text> : null}
          {unitMismatch ? (
            <Text style={styles.warningText}>
              Phiếu ghi “{line.unit}”, kho tính theo “{product.unit}”. Kiểm tra lại số lượng quy đổi.
            </Text>
          ) : null}
          <View style={styles.row}>
            <TextInput style={styles.qty} value={row.quantity} onChangeText={(value) => onChange({ quantity: value })} keyboardType="number-pad" placeholder="SL" />
            <Text style={styles.meta}>{product?.unit ?? ''}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.link} onPress={() => setSearching((value) => !value)}>{searching ? 'Đóng tìm' : 'Chọn khác'}</Text>
            {can('PRODUCT_CREATE') ? <Text style={styles.link} onPress={onCreate}>Tạo mới</Text> : null}
            <Text style={styles.skip} onPress={() => onChange({ product: null })}>Bỏ qua</Text>
          </View>
          {searching ? (
            <TextInput style={styles.search} value={query} onChangeText={setQuery} placeholder="Tìm sản phẩm trong kho" placeholderTextColor="#9aa5b5" autoFocus />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flex: { flex: 1 },
  label: { color: colors.text, fontWeight: '800' },
  text: { color: colors.text, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 10, borderRadius: 8, overflow: 'hidden' },
  warningText: { color: colors.warning, fontSize: 12 },
  link: { color: colors.primary, fontWeight: '700' },
  skip: { color: colors.muted, fontWeight: '700' },
  previewBox: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' },
  preview: { width: '100%', height: '100%', resizeMode: 'contain' },
  previewOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewText: { color: '#fff', fontWeight: '700' },
  suggestionName: { color: colors.text, fontWeight: '800', fontSize: 17, flex: 1 },
  invoiceRow: { gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  skipped: { opacity: 0.5 },
  lineName: { color: colors.text, fontWeight: '700', flex: 1 },
  qty: { width: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, color: colors.text, fontWeight: '800', textAlign: 'center' },
  search: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: colors.text },
});
