import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { useAuth, useToken } from '../../store/auth.store';
import type { AiResult } from '../../types';

export function AiScreen() {
  const token = useToken();
  const { can } = useAuth();
  const navigation = useNavigation<RootNavigation>();
  const [text, setText] = useState('');
  const [result, setResult] = useState<AiResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAnalyze() {
    if (!text.trim()) return;
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
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.badge}>AI</Text>
        <Text style={styles.title}>Chuẩn hóa sản phẩm</Text>
        <Text style={styles.description}>
          Nhập mô tả tự nhiên (có thể không dấu, nhiều sản phẩm cách nhau bằng dấu phẩy). AI gợi ý tên chuẩn, danh mục, đơn vị và mô tả.
        </Text>
      </View>

      <Text style={styles.label}>Mô tả sản phẩm</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ví dụ: nuoc ngot coca chai 390ml, banh oreo"
        placeholderTextColor="#9aa5b5"
        multiline
        textAlignVertical="top"
        maxLength={1000}
      />
      <Pressable style={[styles.button, (!text.trim() || busy) && styles.disabled]} onPress={handleAnalyze} disabled={!text.trim() || busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Phân tích bằng AI</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.result}>
          <Text style={styles.resultLabel}>KẾT QUẢ ĐỀ XUẤT</Text>
          <Text style={styles.meta}>Đã sửa chính tả: {result.correctedText}</Text>
          <Text style={styles.confidence}>
            Độ tin cậy: {Math.round(result.confidence * 100)}% · {result.source === 'provider' ? 'Claude AI' : 'Bộ luật offline'}
          </Text>
          {result.hasMultipleProductTypes ? (
            <Text style={styles.multipleHint}>Phát hiện nhiều loại sản phẩm khác nhau. Hãy tạo từng sản phẩm riêng.</Text>
          ) : null}
          {result.suggestions.map((suggestion, index) => (
            <View key={`${suggestion.normalizedName}-${index}`} style={styles.suggestion}>
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{suggestion.normalizedName}</Text>
                <Text style={styles.meta}>{suggestion.category} · {suggestion.unit}</Text>
                <Text style={styles.descriptionResult}>{suggestion.description}</Text>
              </View>
              {can('PRODUCT_CREATE') ? (
                <Pressable
                  style={styles.useButton}
                  onPress={() =>
                    navigation.navigate('ProductForm', {
                      prefill: {
                        name: suggestion.normalizedName,
                        category: suggestion.category,
                        unit: suggestion.unit,
                        description: suggestion.description,
                        barcode: suggestion.barcode,
                      },
                    })
                  }
                >
                  <Text style={styles.useButtonText}>Tạo sản phẩm</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Text style={styles.hint}>Hãy xác nhận lại thông tin trước khi lưu sản phẩm.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { backgroundColor: colors.dark, borderRadius: 18, padding: 20 },
  badge: { color: colors.text, backgroundColor: '#b9d1ff', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', fontWeight: '900', overflow: 'hidden' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 16 },
  description: { color: '#becbe0', lineHeight: 20, marginTop: 8 },
  label: { color: colors.text, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 13, minHeight: 120, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 11, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800' },
  error: { color: colors.danger, textAlign: 'center' },
  result: { backgroundColor: '#effbf3', borderColor: '#bfe8cc', borderWidth: 1, borderRadius: 14, padding: 16 },
  resultLabel: { color: colors.success, fontWeight: '800', fontSize: 12 },
  meta: { color: colors.muted, marginTop: 6 },
  descriptionResult: { color: colors.muted, marginTop: 8 },
  confidence: { color: colors.success, fontWeight: '800', marginTop: 8 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 14 },
  multipleHint: { color: '#9a5d00', backgroundColor: '#fff4d6', padding: 10, borderRadius: 8, marginTop: 12 },
  suggestion: { borderTopWidth: 1, borderTopColor: '#bfe8cc', marginTop: 14, paddingTop: 14, flexDirection: 'row', gap: 10 },
  suggestionInfo: { flex: 1 },
  suggestionName: { color: colors.text, fontWeight: '800' },
  useButton: { backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'center' },
  useButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
