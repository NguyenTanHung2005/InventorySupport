import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { aiService } from '../../services/ai.service';
import { useAuth } from '../../store/auth.store';
import { useNavigation } from '@react-navigation/native';

type AiResult = Awaited<ReturnType<typeof aiService.normalizeProduct>>;

export function AiScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const [text, setText] = useState('');
  const [result, setResult] = useState<AiResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAnalyze() {
    if (!token || !text.trim()) return;
    setBusy(true);
    setError('');
    try {
      setResult(await aiService.normalizeProduct(token, text.trim()));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>AI</Text>
          <Text style={styles.title}>Chuẩn hóa sản phẩm</Text>
          <Text style={styles.description}>
            Nhập mô tả tự nhiên. AI sẽ gợi ý tên, danh mục, đơn vị và mô tả chuẩn hóa.
          </Text>
        </View>

        <Text style={styles.label}>Mô tả sản phẩm</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ví dụ: nuoc ngot coca chai 390ml"
          multiline
          textAlignVertical="top"
        />
        <Pressable
          style={[styles.button, (!text.trim() || busy) && styles.disabled]}
          onPress={handleAnalyze}
          disabled={!text.trim() || busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Phân tích bằng AI</Text>}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>KẾT QUẢ ĐỀ XUẤT</Text>
            <Text style={styles.resultName}>{result.normalizedName}</Text>
            <Text style={styles.meta}>Danh mục: {result.category}</Text>
            <Text style={styles.meta}>Đơn vị: {result.unit}</Text>
            <Text style={styles.descriptionResult}>{result.description}</Text>
            <Text style={styles.meta}>Đã sửa chính tả: {result.correctedText}</Text>
            <Text style={styles.confidence}>
              Độ tin cậy: {Math.round(result.confidence * 100)}%
            </Text>
            <Text style={styles.hint}>Hãy xác nhận lại thông tin trước khi lưu sản phẩm.</Text>
            {result.hasMultipleProductTypes ? <Text style={styles.multipleHint}>Phát hiện nhiều loại sản phẩm khác nhau. Hãy nhập từng sản phẩm riêng.</Text> : null}
            {result.suggestions.map((suggestion) => (
              <View key={`${suggestion.normalizedName}-${suggestion.unit}`} style={styles.suggestion}>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{suggestion.normalizedName}</Text>
                  <Text style={styles.meta}>{suggestion.category} · {suggestion.unit}</Text>
                  <Text style={styles.descriptionResult}>{suggestion.description}</Text>
                </View>
                <Pressable style={styles.useButton} onPress={() => navigation.navigate('Inventory', { normalizedProduct: suggestion })}>
                  <Text style={styles.useButtonText}>Dùng để nhập</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 18, gap: 14 },
  hero: { backgroundColor: '#17233b', borderRadius: 18, padding: 20 },
  badge: { color: '#17233b', backgroundColor: '#b9d1ff', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', fontWeight: '900' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 16 },
  description: { color: '#becbe0', lineHeight: 20, marginTop: 8 },
  label: { color: '#17233b', fontWeight: '700' },
  input: { backgroundColor: '#fff', borderColor: '#e3e8f0', borderWidth: 1, borderRadius: 10, padding: 13, minHeight: 120, color: '#17233b' },
  button: { backgroundColor: '#2f6fed', borderRadius: 11, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800' },
  error: { color: '#c2413b', textAlign: 'center' },
  result: { backgroundColor: '#effbf3', borderColor: '#bfe8cc', borderWidth: 1, borderRadius: 14, padding: 16 },
  resultLabel: { color: '#217a4b', fontWeight: '800', fontSize: 12 },
  resultName: { color: '#17233b', fontWeight: '800', fontSize: 22, marginTop: 8 },
  meta: { color: '#68758a', marginTop: 6 },
  descriptionResult: { color: '#68758a', marginTop: 12 },
  confidence: { color: '#217a4b', fontWeight: '800', marginTop: 12 },
  hint: { color: '#68758a', fontSize: 12, marginTop: 12 },
  multipleHint: { color: '#9a5d00', backgroundColor: '#fff4d6', padding: 10, borderRadius: 8, marginTop: 12 },
  suggestion: { borderTopWidth: 1, borderTopColor: '#bfe8cc', marginTop: 14, paddingTop: 14, flexDirection: 'row', gap: 10 },
  suggestionInfo: { flex: 1 },
  suggestionName: { color: '#17233b', fontWeight: '800' },
  useButton: { backgroundColor: '#217a4b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'center' },
  useButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
