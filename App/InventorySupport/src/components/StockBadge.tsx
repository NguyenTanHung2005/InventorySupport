import { StyleSheet, Text } from 'react-native';
export function StockBadge({ quantity, minStock }: { quantity: number; minStock: number }) { return <Text style={quantity <= minStock ? styles.low : styles.ok}>{quantity <= minStock ? 'Sắp hết' : 'Ổn định'}</Text>; }
const styles = StyleSheet.create({ low: { color: '#b7791f', backgroundColor: '#fff1c9', padding: 6, borderRadius: 8, fontSize: 12, fontWeight: '800' }, ok: { color: '#217a4b', backgroundColor: '#e7f7ed', padding: 6, borderRadius: 8, fontSize: 12, fontWeight: '800' } });
