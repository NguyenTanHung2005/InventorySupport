import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { Product } from '../types';
import { formatMoney } from '../utils/format';
import { ProductImage } from './ProductImage';

export function ProductCard({ product, onPress, selected }: { product: Product; onPress?: () => void; selected?: boolean }) {
  const low = product.quantity <= product.minStock;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && onPress && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <ProductImage uri={product.imageUrl} name={product.name} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{product.category} · {product.barcode}</Text>
        <Text style={styles.price}>{formatMoney(product.price)}</Text>
      </View>
      <View style={styles.stock}>
        <Text style={[styles.quantity, product.quantity === 0 ? styles.danger : low ? styles.warning : null]}>
          {product.quantity}
        </Text>
        <Text style={styles.meta}>{product.unit}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: 12 },
  selected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: '#f3f7ff' },
  pressed: { opacity: 0.85 },
  info: { flex: 1 },
  name: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  price: { color: colors.primary, fontWeight: '700', marginTop: 4, fontSize: 13 },
  stock: { alignItems: 'flex-end', minWidth: 48 },
  quantity: { color: colors.text, fontWeight: '800', fontSize: 18 },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
});
