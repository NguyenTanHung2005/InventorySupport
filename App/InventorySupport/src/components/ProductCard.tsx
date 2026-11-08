import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Product } from '../types';

export function ProductCard({ product, onPress }: { product: Product; onPress?: () => void }) {
  const content = <View style={styles.row}><View style={styles.icon}><Text style={styles.iconText}>{product.name.charAt(0)}</Text></View><View style={styles.info}><Text style={styles.name}>{product.name}</Text><Text style={styles.meta}>{product.category} · {product.barcode}</Text></View><View><Text style={product.quantity <= product.minStock ? styles.warning : styles.quantity}>{product.quantity}</Text><Text style={styles.meta}>{product.unit}</Text></View></View>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
const styles = StyleSheet.create({ row: { backgroundColor: '#fff', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e3e8f0' }, icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#e8efff', alignItems: 'center', justifyContent: 'center' }, iconText: { color: '#2f6fed', fontWeight: '800', fontSize: 18 }, info: { flex: 1, marginLeft: 12 }, name: { color: '#17233b', fontWeight: '700' }, meta: { color: '#68758a', fontSize: 12, marginTop: 4 }, quantity: { color: '#17233b', fontWeight: '800', fontSize: 18, textAlign: 'right' }, warning: { color: '#b7791f', fontWeight: '800', fontSize: 18, textAlign: 'right' } });
