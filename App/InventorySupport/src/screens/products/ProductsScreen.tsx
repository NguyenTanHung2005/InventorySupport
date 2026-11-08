import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, TextInput } from 'react-native';
import { getProducts } from '../../services/api';
import { useAuth } from '../../store/auth.store';
import { ProductCard } from '../../components/ProductCard';
export function ProductsScreen() { const { token } = useAuth(); const [items, setItems] = useState<any[]>([]); const [query, setQuery] = useState(''); useEffect(() => { if (token) void getProducts(token).then(setItems); }, [token]); const filtered = items.filter((p) => `${p.name} ${p.barcode} ${p.category}`.toLowerCase().includes(query.toLowerCase())); return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Tìm tên, danh mục, barcode..." />{filtered.map((p) => <ProductCard key={p.id} product={p} />)}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fb' }, content: { padding: 18, gap: 12 }, input: { backgroundColor: '#fff', borderColor: '#e3e8f0', borderWidth: 1, borderRadius: 10, padding: 13 } });
