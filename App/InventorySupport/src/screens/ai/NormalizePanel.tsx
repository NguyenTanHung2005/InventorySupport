import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AiResultNotice, AiSuggestionCard } from '../../components/AiSuggestionCard';
import { Button, Card, ErrorBanner, Field } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { useAuth, useToken } from '../../store/auth.store';
import type { AiResult } from '../../types';

export function NormalizePanel() {
  const token = useToken();
  const { can } = useAuth();
  const navigation = useNavigation<RootNavigation>();
  const [text, setText] = useState('');
  const [result, setResult] = useState<AiResult>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { generation.current++; }, []);

  async function handleAnalyze() {
    if (!text.trim() || pending.current) return;
    pending.current = true;
    const id = ++generation.current;
    setBusy(true);
    setError('');
    setResult(undefined);
    try {
      const response = await aiService.normalizeProduct(token, text.trim());
      if (id === generation.current) setResult(response);
    } catch (cause) {
      if (id === generation.current) setError((cause as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>Chuẩn hóa sản phẩm</Text>
        <Text style={{ color: colors.muted }}>Nhập tên hàng: AI sửa chính tả, tách từng sản phẩm và gợi ý title, mô tả, danh mục, đơn vị. Tối đa 5 sản phẩm mỗi lần.</Text>
        <Text style={{ color: colors.muted }}>Đây là bước chuẩn bị nhập kho. Bạn bổ sung số lượng, giá và xác nhận giao dịch sau khi chọn hoặc tạo sản phẩm.</Text>
      </Card>
      <Field label="Tên hoặc mô tả sản phẩm" value={text} multiline maxLength={1000} placeholder="nuoc ngot coca chai 390ml; banh oreo goi 133g" onChangeText={(value) => { generation.current++; setText(value); setResult(undefined); setError(''); }} />
      <Button title="Phân tích bằng AI" loading={busy} disabled={!text.trim()} onPress={handleAnalyze} />
      <ErrorBanner message={error} />
      {result ? (
        <>
          <Text style={{ color: colors.muted }}>Đã sửa chính tả: {result.correctedText}</Text>
          <AiResultNotice result={result} />
          {result.suggestions.length > 1 ? <Text style={{ color: colors.muted }}>Có {result.suggestions.length} sản phẩm. Hãy duyệt từng thẻ riêng.</Text> : null}
          {result.suggestions.map((suggestion, index) => <AiSuggestionCard key={`${suggestion.normalizedName}-${index}`} suggestion={suggestion} applyLabel={suggestion.matchedProducts?.length ? 'Vẫn mở form tạo mới' : 'Mở form tạo sản phẩm'} onApply={can('PRODUCT_CREATE') ? (prefill) => navigation.navigate('ProductForm', { prefill }) : undefined} />)}
        </>
      ) : null}
    </ScrollView>
  );
}
