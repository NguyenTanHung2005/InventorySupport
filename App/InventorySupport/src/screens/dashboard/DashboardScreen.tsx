import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLowStock, getProducts } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { ProductCard } from '../../components/ProductCard';
import { StockBadge } from '../../components/StockBadge';

export function DashboardScreen() {
  const { token } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [low, setLow] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => { if (!token) return; setLoading(true); try { setProducts(await getProducts(token)); setLow(await getLowStock(token)); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><View style={styles.hero}><Text style={styles.heroTitle}>Xin chào!</Text><Text style={styles.heroText}>Theo dõi cửa hàng của bạn hôm nay.</Text></View><View style={styles.grid}><Stat label="Sản phẩm" value={products.length} /><Stat label="Tổng tồn kho" value={products.reduce((sum, p) => sum + p.quantity, 0)} /><Stat label="Sắp hết hàng" value={low.length} /></View><View style={styles.section}><Text style={styles.heading}>Cảnh báo tồn kho</Text><Pressable onPress={refresh}><Text style={styles.action}>Làm mới</Text></Pressable></View>{loading ? <ActivityIndicator /> : low.length ? low.map((p) => <View key={p.id} style={styles.alert}><View style={{ flex: 1 }}><Text style={styles.name}>{p.name}</Text><Text style={styles.meta}>Còn {p.quantity} {p.unit}</Text></View><StockBadge quantity={p.quantity} minStock={p.minStock} /></View>) : <Text style={styles.meta}>Tồn kho đang ở mức an toàn.</Text>}<Text style={styles.heading}>Sản phẩm gần đây</Text>{products.slice(0, 5).map((p) => <ProductCard key={p.id} product={p} />)}</ScrollView></SafeAreaView>;
}
function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.meta}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fb' }, content: { padding: 18, gap: 14 }, hero: { backgroundColor: '#17233b', padding: 20, borderRadius: 18 }, heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' }, heroText: { color: '#b8c5da', marginTop: 6 }, grid: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 12 }, value: { color: '#17233b', fontSize: 24, fontWeight: '800', marginTop: 5 }, meta: { color: '#68758a', fontSize: 12 }, section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heading: { color: '#17233b', fontSize: 18, fontWeight: '800' }, action: { color: '#2f6fed', fontWeight: '700' }, alert: { backgroundColor: '#fffaf0', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }, name: { color: '#17233b', fontWeight: '700' } });
