import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STOCK_TYPE_LABELS } from '../constants/permissions';
import { colors } from '../constants/theme';
import { StockTransaction } from '../types';
import { formatDateTime } from '../utils/format';

export function TransactionItem({ item, showProduct = true, onPress }: { item: StockTransaction; showProduct?: boolean; onPress?: () => void }) {
  const sign = item.type === 'EXPORT' ? '-' : item.type === 'IMPORT' ? '+' : item.quantity >= 0 ? '+' : '';
  const color = item.type === 'EXPORT' ? colors.danger : item.type === 'IMPORT' ? colors.success : colors.warning;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {STOCK_TYPE_LABELS[item.type]}{showProduct ? ` · ${item.productName}` : ''}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {formatDateTime(item.createdAt)} · {item.createdByName}
          {item.reason ? ` · ${item.reason}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color }]}>{sign}{Math.abs(item.quantity)}</Text>
        <Text style={styles.meta}>{item.quantityBefore} → {item.quantityAfter}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  info: { flex: 1 },
  title: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  amount: { fontWeight: '800', fontSize: 16 },
});
