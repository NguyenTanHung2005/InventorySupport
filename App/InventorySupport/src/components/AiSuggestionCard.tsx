import { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigation } from '../navigation/types';
import type { AiResult, AiSuggestion, ProductInput } from '../types';
import { aiService } from '../services/ai.service';
import { colors } from '../constants/theme';
import { ProductCard } from './ProductCard';
import { Button, Card, Field } from './ui';

export function AiResultNotice({ result }: { result: AiResult }) {
  return (
    <Text style={{ color: result.source === 'heuristic' ? colors.warning : colors.muted }}>
      {result.source === 'heuristic'
        ? `${result.fallbackReason === 'provider_unavailable' ? 'Dịch vụ AI đang lỗi.' : 'Chưa cấu hình AI.'} Đang dùng bộ luật offline chỉ sửa/tách cơ bản, chưa viết title và mô tả bằng AI. Hãy kiểm tra và bổ sung.`
        : 'Gemini AI đề xuất. Hãy duyệt từng sản phẩm trước khi lưu.'}
      {!result.suggestions.length ? '\nKhông nhận diện được sản phẩm. Hãy bổ sung tên hoặc quy cách.' : ''}
    </Text>
  );
}

export function AiSuggestionCard({ suggestion, onApply, applyLabel = 'Áp dụng vào form' }: {
  suggestion: AiSuggestion;
  onApply?: (input: ProductInput) => void;
  applyLabel?: string;
}) {
  const navigation = useNavigation<RootNavigation>();
  const [draft, setDraft] = useState(suggestion);
  return (
    <Card>
      <Text style={{ color: colors.muted }}>Tên đầu vào: {suggestion.name}</Text>
      <Text style={{ color: colors.muted }}>
        {suggestion.source === 'provider' ? `AI tự đánh giá: ${Math.round(suggestion.confidence * 100)}% (tham khảo)` : 'Bộ luật offline · cần kiểm tra'}
      </Text>
      {suggestion.source === 'provider' && suggestion.confidence < 0.75 ? <Text style={{ color: colors.warning }}>AI chưa chắc chắn, hãy đối chiếu lại thông tin.</Text> : null}
      <Field label="Tiêu đề / tên sản phẩm" value={draft.normalizedName} maxLength={200} onChangeText={(normalizedName) => setDraft({ ...draft, normalizedName })} />
      <Field label="Mô tả" value={draft.description} maxLength={2000} multiline onChangeText={(description) => setDraft({ ...draft, description })} />
      <Field label="Danh mục" value={draft.category} maxLength={80} onChangeText={(category) => setDraft({ ...draft, category })} />
      <Field label="Đơn vị tính" value={draft.unit} maxLength={30} placeholder="Cần xác nhận: chai, lon, gói..." onChangeText={(unit) => setDraft({ ...draft, unit })} />
      {suggestion.matchedProducts?.length ? (
        <>
          <Text style={{ color: colors.muted }}>Sản phẩm có sẵn có thể phù hợp (hãy kiểm tra quy cách):</Text>
          {suggestion.matchedProducts.map((product) => <ProductCard key={product.id} product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />)}
        </>
      ) : null}
      {onApply ? <Button title={applyLabel} disabled={!draft.normalizedName.trim() || !draft.description.trim() || !draft.category.trim() || !draft.unit.trim()} onPress={() => onApply(aiService.productInput({ ...draft, normalizedName: draft.normalizedName.trim(), description: draft.description.trim(), category: draft.category.trim(), unit: draft.unit.trim() }))} /> : null}
    </Card>
  );
}
