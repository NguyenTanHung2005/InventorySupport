import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { productService } from '../services/product.service';
import { useToken } from '../store/auth.store';
import { ProductLabel } from '../types';
import { formatMoney } from '../utils/format';
import { Button } from './ui';

/**
 * Tem QR để in dán lên kệ / sản phẩm (docs/SCAN.md mục 2.4, nhu cầu N5).
 * QR chứa `IS:P:<barcode>`; quét bằng màn Quét sẽ ra đúng sản phẩm.
 */
export function ProductLabelModal({ productId, visible, onClose }: { productId: string; visible: boolean; onClose: () => void }) {
  const token = useToken();
  const [label, setLabel] = useState<ProductLabel>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    productService
      .label(token, productId)
      .then((value) => !cancelled && setLabel(value))
      .catch((cause: Error) => !cancelled && setError(cause.message));
    return () => {
      cancelled = true;
    };
  }, [token, productId, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {label ? (
            <View style={styles.label}>
              <Image source={{ uri: label.qrDataUrl }} style={styles.qr} accessibilityLabel={`Mã QR của ${label.name}`} />
              <Text style={styles.name} numberOfLines={2}>{label.name}</Text>
              <Text style={styles.price}>
                {formatMoney(label.price)} / {label.unit}
              </Text>
              <Text style={styles.code}>{label.barcode}</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ margin: 40 }} />
          )}
          <Text style={styles.hint}>
            {Platform.OS === 'web' ? 'Bấm In để in tem và dán lên kệ.' : 'Chụp màn hình để in, hoặc mở app trên web để in trực tiếp.'}
          </Text>
          <View style={styles.row}>
            {Platform.OS === 'web' && label ? (
              <Button title="In" icon="🖨" style={{ flex: 1 }} onPress={() => (globalThis as { print?: () => void }).print?.()} />
            ) : null}
            <Button title="Đóng" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, width: '100%', maxWidth: 360, gap: 14 },
  label: { alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12, padding: 16 },
  qr: { width: 220, height: 220 },
  name: { color: colors.text, fontWeight: '800', fontSize: 16, textAlign: 'center' },
  price: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  code: { color: colors.muted, letterSpacing: 1 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
});
