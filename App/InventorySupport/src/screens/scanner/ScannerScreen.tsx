import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Segmented } from '../../components/ui';
import { colors } from '../../constants/theme';
import { useAuth } from '../../store/auth.store';
import { BatchScanner } from './BatchScanner';
import { ImageScanner } from './ImageScanner';
import { LookupScanner } from './LookupScanner';

type Mode = 'lookup' | 'batch' | 'image';

/**
 * Màn Quét (docs/SCAN.md):
 * - Tra cứu: quét một mã vạch / QR để xem nhanh.
 * - Liên tục: kiểm kê, nhập hàng, xuất nhiều món rồi lưu một lần.
 * - Ảnh AI: nhận diện sản phẩm, đọc phiếu nhập.
 * Các chế độ được giữ trong bộ nhớ khi chuyển qua lại (danh sách đang quét không mất);
 * chỉ camera của chế độ đang hiển thị được bật.
 */
export function ScannerScreen() {
  const { can } = useAuth();
  const canBatch = can('STOCK_IMPORT') || can('STOCK_EXPORT') || can('STOCK_ADJUST');
  const options: { value: Mode; label: string }[] = [
    { value: 'lookup', label: 'Tra cứu' },
    ...(canBatch ? [{ value: 'batch' as const, label: 'Liên tục' }] : []),
    ...(can('AI_USE') ? [{ value: 'image' as const, label: 'Ảnh AI' }] : []),
  ];
  const [mode, setMode] = useState<Mode>('lookup');

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {options.length > 1 ? <Segmented<Mode> value={mode} onChange={setMode} options={options} /> : null}
      <View style={mode === 'lookup' ? undefined : styles.hidden}>
        <LookupScanner active={mode === 'lookup'} />
      </View>
      {canBatch ? (
        <View style={mode === 'batch' ? undefined : styles.hidden}>
          <BatchScanner active={mode === 'batch'} />
        </View>
      ) : null}
      {mode === 'image' ? <ImageScanner /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  hidden: { display: 'none' },
});
