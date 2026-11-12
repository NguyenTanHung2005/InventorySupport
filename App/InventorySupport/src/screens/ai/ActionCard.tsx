import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui';
import { STOCK_TYPE_LABELS } from '../../constants/permissions';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { inventoryService } from '../../services/inventory.service';
import { useAssistant } from '../../store/assistant.store';
import { useToken } from '../../store/auth.store';
import { useNotifications } from '../../store/notification.store';
import { AssistantAction } from '../../types';
import { formatMoney } from '../../utils/format';

/**
 * Thẻ đề xuất do AI tạo. Dữ liệu CHỈ thay đổi khi người dùng bấm Xác nhận,
 * và lúc đó gọi đúng API nghiệp vụ như thao tác tay (backend kiểm tra quyền lần nữa).
 */
export function ActionCard({ action }: { action: AssistantAction }) {
  const token = useToken();
  const navigation = useNavigation<RootNavigation>();
  const { actionStatus, setActionStatus } = useAssistant();
  const { refresh: refreshNotifications } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const status = actionStatus[action.id] ?? 'pending';

  if (action.kind === 'CREATE_PRODUCT') {
    const { prefill } = action;
    return (
      <View style={[styles.card, status !== 'pending' && styles.closed]}>
        <Text style={styles.kicker}>ĐỀ XUẤT TẠO SẢN PHẨM</Text>
        <Text style={styles.title}>{prefill.name}</Text>
        <Text style={styles.meta}>
          {[prefill.category, prefill.unit, prefill.price ? formatMoney(prefill.price) : undefined, prefill.barcode].filter(Boolean).join(' · ')}
        </Text>
        {status === 'pending' ? (
          <View style={styles.row}>
            <Button
              title="Mở form tạo"
              style={styles.flex}
              onPress={() => {
                setActionStatus(action.id, 'done');
                navigation.navigate('ProductForm', { prefill });
              }}
            />
            <Button title="Bỏ qua" variant="ghost" onPress={() => setActionStatus(action.id, 'dismissed')} />
          </View>
        ) : (
          <Text style={styles.meta}>{status === 'done' ? 'Đã mở form tạo sản phẩm' : 'Đã bỏ qua'}</Text>
        )}
      </View>
    );
  }

  const after =
    action.type === 'ADJUSTMENT'
      ? action.quantity
      : action.currentQuantity + (action.type === 'EXPORT' ? -action.quantity : action.quantity);

  async function confirm() {
    if (action.kind !== 'STOCK_MOVEMENT') return;
    setBusy(true);
    setError('');
    try {
      const response = await inventoryService.move(token, {
        productId: action.productId,
        type: action.type,
        quantity: action.quantity,
        reason: action.reason || 'Tạo từ trợ lý AI',
      });
      setActionStatus(action.id, 'done');
      setResult(`Đã lưu. ${response.product.name} còn ${response.product.quantity} ${response.product.unit}.${response.alert ? `\n⚠ ${response.alert.message}` : ''}`);
      if (response.alert) void refreshNotifications();
    } catch (cause) {
      // Ví dụ tồn kho đã thay đổi sau khi AI đề xuất.
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, status !== 'pending' && styles.closed]}>
      <Text style={styles.kicker}>ĐỀ XUẤT {STOCK_TYPE_LABELS[action.type].toUpperCase()}</Text>
      <Text style={styles.title}>
        {action.type === 'ADJUSTMENT' ? `Đặt tồn = ${action.quantity}` : `${action.type === 'EXPORT' ? '-' : '+'}${action.quantity}`} {action.unit} · {action.productName}
      </Text>
      <Text style={styles.meta}>
        Tồn kho: {action.currentQuantity} → {after} {action.unit}
        {action.reason ? ` · ${action.reason}` : ''}
      </Text>
      {status === 'pending' ? (
        <>
          <View style={styles.row}>
            <Button
              title="Xác nhận"
              variant={action.type === 'EXPORT' ? 'danger' : action.type === 'IMPORT' ? 'success' : 'primary'}
              style={styles.flex}
              loading={busy}
              onPress={confirm}
            />
            <Button
              title="Sửa"
              variant="ghost"
              disabled={busy}
              onPress={() =>
                navigation.navigate('Tabs', { screen: 'Inventory', params: { productId: action.productId, type: action.type, nonce: Date.now() } })
              }
            />
            <Button title="Bỏ qua" variant="ghost" disabled={busy} onPress={() => setActionStatus(action.id, 'dismissed')} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      ) : (
        <Text style={status === 'done' ? styles.success : styles.meta}>{status === 'done' ? result || 'Đã lưu' : 'Đã bỏ qua'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.primary },
  closed: { borderColor: colors.border, opacity: 0.85 },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  title: { color: colors.text, fontWeight: '800', fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 4 },
  flex: { flex: 1 },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontWeight: '700' },
});
