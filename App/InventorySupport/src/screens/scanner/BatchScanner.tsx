import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, ErrorBanner, Field, Segmented, SuccessBanner } from '../../components/ui';
import { STOCK_TYPE_PERMISSION } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { useAuth, useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { Product, StockType } from '../../types';
import { confirmAction } from '../../utils/dialog';
import { BarcodeCamera } from './BarcodeCamera';

const PURPOSES: Record<StockType, { label: string; hint: string; submit: string }> = {
  ADJUSTMENT: { label: 'Kiểm kê', hint: 'Quét từng món trên kệ, app tự đếm', submit: 'Lưu kiểm kê' },
  IMPORT: { label: 'Nhập hàng', hint: 'Quét từng món nhận từ nhà cung cấp', submit: 'Nhập kho' },
  EXPORT: { label: 'Xuất hàng', hint: 'Quét các món khách mua', submit: 'Xuất kho' },
};

interface Line {
  product: Product;
  count: number;
}

/**
 * Quét liên tục (docs/SCAN.md mục 2.3, nhu cầu N2-N4): mỗi lần quét +1,
 * hoàn tất thì lưu tất cả trong một lệnh POST /inventory/batch (tất cả hoặc không).
 */
export function BatchScanner({ active }: { active: boolean }) {
  const token = useToken();
  const { can } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const purposes = useMemo(
    () => (['ADJUSTMENT', 'IMPORT', 'EXPORT'] as StockType[]).filter((type) => can(STOCK_TYPE_PERMISSION[type])),
    [can],
  );
  const [purpose, setPurpose] = useState<StockType>(purposes[0] ?? 'EXPORT');
  const [lines, setLines] = useState<Line[]>([]);
  const linesRef = useRef<Line[]>([]);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Cache mã → sản phẩm để quét lại cùng món không phải gọi API (đếm nhanh).
  const cache = useRef(new Map<string, Product | null>());
  // Số lần quét đang chờ API trả về cho từng mã (quét nhanh liên tiếp không bị mất).
  const pending = useRef(new Map<string, number>());

  function add(product: Product | null, raw: string, times: number) {
    if (!product) {
      setUnknown((current) => (current.includes(raw) ? current : [raw, ...current]));
      setFeedback(`⚠ Mã ${raw} chưa có trong kho`);
      return;
    }
    const current = linesRef.current;
    const existing = current.find((line) => line.product.id === product.id);
    const wanted = (existing?.count ?? 0) + times;
    // Xuất không được vượt tồn kho.
    const count = purpose === 'EXPORT' ? Math.min(wanted, product.quantity) : wanted;
    setFeedback(
      purpose === 'EXPORT' && wanted > product.quantity
        ? `⚠ ${product.name} chỉ còn ${product.quantity} ${product.unit}`
        : `✓ ${product.name}: ${count}`,
    );
    updateLines([{ product, count }, ...current.filter((line) => line.product.id !== product.id)]);
  }

  /** Cập nhật ref ngay lập tức để nhiều lần quét liên tiếp trong cùng một nhịp không đè nhau. */
  function updateLines(next: Line[]) {
    linesRef.current = next;
    setLines(next);
  }

  async function handleScan(raw: string) {
    setSuccess('');
    if (cache.current.has(raw)) {
      add(cache.current.get(raw) ?? null, raw, 1);
      return;
    }
    const waiting = pending.current.get(raw);
    if (waiting !== undefined) {
      pending.current.set(raw, waiting + 1);
      return;
    }
    pending.current.set(raw, 1);
    try {
      const result = await productService.resolve(token, raw);
      cache.current.set(raw, result.product);
      add(result.product, result.code, pending.current.get(raw) ?? 1);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      pending.current.delete(raw);
    }
  }

  function setCount(productId: string, count: number) {
    updateLines(
      linesRef.current.map((line) => {
        if (line.product.id !== productId) return line;
        const max = purpose === 'EXPORT' ? line.product.quantity : 100000;
        return { ...line, count: Math.max(0, Math.min(max, Math.round(count) || 0)) };
      }),
    );
  }

  const changes =
    purpose === 'ADJUSTMENT'
      ? lines.filter((line) => line.count !== line.product.quantity)
      : lines.filter((line) => line.count > 0);
  const totalItems = lines.reduce((sum, line) => sum + line.count, 0);

  function clear() {
    updateLines([]);
    setUnknown([]);
    setFeedback('');
    setNote('');
    cache.current.clear();
  }

  async function submit() {
    setError('');
    if (purpose === 'ADJUSTMENT' && lines.length && !changes.length) {
      setSuccess(`Đã kiểm ${lines.length} sản phẩm: tất cả khớp sổ sách, không cần lưu.`);
      clear();
      return;
    }
    const summary =
      purpose === 'ADJUSTMENT'
        ? `${changes.length} sản phẩm có chênh lệch sẽ được cập nhật theo số đếm thực tế.`
        : `${PURPOSES[purpose].label} ${changes.reduce((sum, line) => sum + line.count, 0)} món (${changes.length} sản phẩm).`;
    if (!(await confirmAction(`${PURPOSES[purpose].submit}?`, summary, 'Lưu'))) return;

    setSaving(true);
    try {
      const result = await inventoryService.batch(token, {
        type: purpose,
        reason: note.trim() || (purpose === 'ADJUSTMENT' ? 'Kiểm kê bằng quét mã' : purpose === 'EXPORT' ? 'Bán lẻ (quét mã)' : 'Nhập hàng (quét mã)'),
        items: changes.map((line) => ({ productId: line.product.id, quantity: line.count })),
      });
      setSuccess(
        `Đã lưu ${result.count} dòng.` + (result.alerts.length ? `\n⚠ ${result.alerts.map((alert) => alert.message).join('\n⚠ ')}` : ''),
      );
      if (result.alerts.length) void refreshNotifications();
      clear();
    } catch (cause) {
      // Tất cả hoặc không: lỗi một dòng thì không dòng nào được ghi, danh sách giữ nguyên để sửa.
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!purposes.length) {
    return (
      <Card>
        <Text style={styles.text}>Tài khoản của bạn không có quyền nhập, xuất hoặc kiểm kê.</Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {purposes.length > 1 ? (
        <Segmented
          value={purpose}
          onChange={(value) => {
            setPurpose(value);
            setError('');
          }}
          options={purposes.map((value) => ({ value, label: PURPOSES[value].label }))}
        />
      ) : null}

      <BarcodeCamera visible={active} active={active && !saving} onScan={(raw) => void handleScan(raw)} hint={PURPOSES[purpose].hint} status={feedback || undefined} height={220} />

      <SuccessBanner message={success} />
      <ErrorBanner message={error} />

      {lines.length ? (
        <Card>
          <View style={styles.header}>
            <Text style={styles.title}>
              {lines.length} sản phẩm · {totalItems} món
            </Text>
            <Text style={styles.link} onPress={async () => (await confirmAction('Xóa danh sách?', 'Các món đã quét sẽ bị xóa.', 'Xóa')) && clear()}>
              Xóa hết
            </Text>
          </View>
          {purpose === 'ADJUSTMENT' ? (
            <Text style={styles.meta}>Chỉ các sản phẩm đã quét được kiểm kê. Số đếm khác sổ sách sẽ được cập nhật.</Text>
          ) : null}
          {lines.map((line) => (
            <LineRow key={line.product.id} line={line} purpose={purpose} onChange={(count) => setCount(line.product.id, count)} onRemove={() => updateLines(linesRef.current.filter((item) => item.product.id !== line.product.id))} />
          ))}
          <Field label="Ghi chú" value={note} onChangeText={setNote} placeholder={purpose === 'ADJUSTMENT' ? 'Kiểm kê bằng quét mã' : 'Không bắt buộc'} />
          <Button
            title={`${PURPOSES[purpose].submit}${purpose === 'ADJUSTMENT' ? ` (${changes.length} chênh lệch)` : ''}`}
            variant={purpose === 'EXPORT' ? 'danger' : purpose === 'IMPORT' ? 'success' : 'primary'}
            loading={saving}
            disabled={purpose !== 'ADJUSTMENT' && !changes.length}
            onPress={submit}
          />
        </Card>
      ) : (
        <Text style={styles.empty}>Chưa quét món nào. Mỗi lần quét một mã, số lượng tăng 1.</Text>
      )}

      {unknown.length ? (
        <Card>
          <Text style={styles.title}>Mã chưa có trong kho ({unknown.length})</Text>
          <Text style={styles.meta}>Không tính vào phiếu. Tạo sản phẩm sau rồi quét lại.</Text>
          {unknown.map((code) => (
            <Text key={code} style={styles.code} selectable>
              {code}
            </Text>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function LineRow({ line, purpose, onChange, onRemove }: { line: Line; purpose: StockType; onChange: (count: number) => void; onRemove: () => void }) {
  const { product, count } = line;
  const diff = count - product.quantity;
  return (
    <View style={styles.line}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {purpose === 'ADJUSTMENT' ? (
          <Text style={[styles.meta, diff !== 0 && { color: diff < 0 ? colors.danger : colors.warning, fontWeight: '700' }]}>
            Sổ: {product.quantity} · Đếm: {count} {diff === 0 ? '· khớp' : `· ${diff > 0 ? '+' : ''}${diff}`}
          </Text>
        ) : (
          <Text style={styles.meta}>
            Tồn {product.quantity} → {purpose === 'EXPORT' ? product.quantity - count : product.quantity + count} {product.unit}
          </Text>
        )}
      </View>
      <View style={styles.stepper}>
        <Pressable style={styles.stepButton} onPress={() => onChange(count - 1)} accessibilityLabel="Giảm">
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <TextInput style={styles.count} value={String(count)} onChangeText={(value) => onChange(Number(value.replace(/\D/g, '')))} keyboardType="number-pad" />
        <Pressable style={styles.stepButton} onPress={() => onChange(count + 1)} accessibilityLabel="Tăng">
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.remove} onPress={onRemove} accessibilityLabel="Xóa dòng">
        ✕
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '800' },
  link: { color: colors.danger, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
  empty: { color: colors.muted, textAlign: 'center', padding: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  name: { color: colors.text, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  count: { width: 52, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, color: colors.text, fontWeight: '800' },
  remove: { color: colors.muted, fontSize: 16, padding: 6 },
  code: { color: colors.text, fontFamily: 'monospace' },
});
