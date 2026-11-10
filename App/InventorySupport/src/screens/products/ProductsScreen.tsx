import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { ProductCard } from '../../components/ProductCard';
import { Button, Chip, EmptyState, ErrorBanner, SuccessBanner } from '../../components/ui';
import { colors } from '../../constants/theme';
import { usePaginated } from '../../hooks/usePaginated';
import type { RootNavigation } from '../../navigation/types';
import { productService } from '../../services/product.service';
import { useAuth, useToken } from '../../store/auth.store';
import { notify } from '../../utils/dialog';
import { importProductsFromExcel } from '../../utils/excel';

export function ProductsScreen() {
  const token = useToken();
  const { can } = useAuth();
  const navigation = useNavigation<RootNavigation>();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>();
  const [lowStock, setLowStock] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  // Chờ người dùng ngừng gõ 350ms rồi mới gọi API.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const list = usePaginated(
    (page, limit) => productService.list(token, { page, limit, search, category, lowStock: lowStock || undefined }),
    [token, search, category, lowStock],
  );

  const loadCategories = useCallback(() => {
    void productService.categories(token).then(setCategories).catch(() => undefined);
  }, [token]);
  useEffect(loadCategories, [loadCategories]);

  // Làm mới khi quay lại màn hình (sau khi thêm/sửa/xóa sản phẩm).
  useRefreshOnFocus(() => {
    loadCategories();
    void list.reload();
  });

  async function importExcel() {
    setImporting(true);
    setMessage('');
    try {
      const result = await importProductsFromExcel(token);
      if (!result) return;
      setMessage(`Đã nhập ${result.imported} sản phẩm từ Excel`);
      if (result.failed.length) notify('Một số dòng bị lỗi', result.failed.slice(0, 8).join('\n'));
      void list.reload();
    } catch (cause) {
      notify('Không nhập được file', (cause as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ProductCard product={item} onPress={() => navigation.navigate('ProductDetail', { productId: item.id })} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm tên, barcode, danh mục, nhà cung cấp..."
            placeholderTextColor="#9aa5b5"
            clearButtonMode="while-editing"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Tất cả" active={!category && !lowStock} onPress={() => { setCategory(undefined); setLowStock(false); }} />
            <Chip label="⚠ Sắp hết" active={lowStock} onPress={() => setLowStock((value) => !value)} />
            {categories.map((item) => (
              <Chip key={item} label={item} active={category === item} onPress={() => setCategory(category === item ? undefined : item)} />
            ))}
          </ScrollView>
          {can('PRODUCT_CREATE') ? (
            <View style={styles.actions}>
              <Button title="Thêm sản phẩm" icon="＋" onPress={() => navigation.navigate('ProductForm')} style={{ flex: 1 }} />
              <Button title="Nhập Excel" variant="ghost" loading={importing} onPress={importExcel} style={{ flex: 1 }} />
            </View>
          ) : null}
          <SuccessBanner message={message} />
          <ErrorBanner message={list.error} onRetry={list.reload} />
          <Text style={styles.count}>{list.total} sản phẩm</Text>
        </View>
      }
      ListEmptyComponent={list.loading ? null : <EmptyState text={search || category || lowStock ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm nào.'} />}
      ListFooterComponent={list.loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 12 },
  search: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text },
  chips: { gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  count: { color: colors.muted, fontSize: 12 },
});
