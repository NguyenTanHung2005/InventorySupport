import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Chip } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { useAssistant, type ChatMessage } from '../../store/assistant.store';
import { useAuth, useToken } from '../../store/auth.store';
import { AssistantProduct, Permission } from '../../types';
import { confirmAction } from '../../utils/dialog';
import { ActionCard } from './ActionCard';

/** Gợi ý nhanh; chip thao tác chỉ hiện khi người dùng có quyền. */
const SUGGESTIONS: { text: string; permission?: Permission }[] = [
  { text: 'Hàng nào sắp hết?' },
  { text: 'Tổng quan 7 ngày', permission: 'REPORT_VIEW' },
  { text: 'Giao dịch hôm nay' },
  { text: 'Coca còn bao nhiêu?' },
  { text: 'Xuất 2 chai coca', permission: 'STOCK_EXPORT' },
  { text: 'Nhập 10 mì hảo hảo', permission: 'STOCK_IMPORT' },
];

export function AssistantChat() {
  const token = useToken();
  const { can } = useAuth();
  const { messages, sending, turn, maxTurns, send, reset } = useAssistant();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<{ provider: 'claude' | 'offline'; model?: string }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    aiService
      .status(token)
      .then((status) => setMode(status.assistant))
      .catch(() => undefined);
  }, [token]);

  const suggestions = useMemo(() => SUGGESTIONS.filter((item) => !item.permission || can(item.permission)), [can]);
  const limitReached = turn >= maxTurns;

  function submit(value = text) {
    if (!value.trim() || sending || limitReached) return;
    setText('');
    void send(value);
  }

  async function startOver() {
    if (messages.length && !(await confirmAction('Cuộc trò chuyện mới?', 'Lịch sử hiện tại sẽ bị xóa.', 'Bắt đầu lại'))) return;
    await reset();
  }

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <Text style={styles.mode}>
          {mode ? (mode.provider === 'claude' ? '🟢 Claude AI' : '🟡 Chế độ offline (chưa cấu hình AI)') : ' '}
        </Text>
        {messages.length ? (
          <Text style={styles.link} onPress={startOver}>Trò chuyện mới</Text>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListEmptyComponent={
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Xin chào! Mình là trợ lý kho.</Text>
            <Text style={styles.welcomeText}>
              Hỏi mình về tồn kho, giá, lịch sử nhập/xuất, hoặc nhờ chuẩn bị phiếu nhập/xuất. Mình chỉ đề xuất, dữ liệu
              chỉ thay đổi khi bạn bấm Xác nhận.
            </Text>
          </View>
        }
        ListFooterComponent={
          sending ? (
            <View style={[styles.bubble, styles.assistant, styles.typing]}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.meta}>Đang tra cứu...</Text>
            </View>
          ) : null
        }
      />

      {!messages.length || !sending ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
          {suggestions.map((item) => (
            <Chip key={item.text} label={item.text} onPress={() => submit(item.text)} />
          ))}
        </ScrollView>
      ) : null}

      {limitReached ? (
        <Pressable style={styles.limit} onPress={reset}>
          <Text style={styles.limitText}>Đã đạt {maxTurns} câu hỏi. Chạm để bắt đầu cuộc trò chuyện mới.</Text>
        </Pressable>
      ) : (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Hỏi về tồn kho, sản phẩm..."
            placeholderTextColor="#9aa5b5"
            multiline
            maxLength={1000}
            onSubmitEditing={() => submit()}
            blurOnSubmit
            returnKeyType="send"
          />
          <Pressable
            style={[styles.send, (!text.trim() || sending) && styles.sendDisabled]}
            onPress={() => submit()}
            disabled={!text.trim() || sending}
            accessibilityLabel="Gửi"
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'notice') return <Text style={styles.notice}>{message.text}</Text>;
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser && styles.alignEnd]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.assistant, message.error && styles.errorBubble]}>
        <Text style={isUser ? styles.userText : message.error ? styles.errorText : styles.text}>{message.text}</Text>
      </View>
      {message.products?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.products}>
          {message.products.map((product) => <ProductChip key={product.id} product={product} />)}
        </ScrollView>
      ) : null}
      {message.actions?.map((action) => (
        <View key={action.id} style={styles.action}>
          <ActionCard action={action} />
        </View>
      ))}
      {message.toolCalls?.length ? (
        <Text style={styles.trace}>Đã tra: {[...new Set(message.toolCalls.map((call) => call.summary))].join(' · ')}</Text>
      ) : null}
    </View>
  );
}

function ProductChip({ product }: { product: AssistantProduct }) {
  const navigation = useNavigation<RootNavigation>();
  const color = product.status === 'OUT' ? colors.danger : product.status === 'LOW' ? colors.warning : colors.success;
  return (
    <Pressable style={styles.productChip} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}>
      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
      <Text style={[styles.productQty, { color }]}>
        {product.quantity} {product.unit}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  mode: { color: colors.muted, fontSize: 12 },
  link: { color: colors.primary, fontWeight: '800' },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  welcome: { backgroundColor: colors.dark, borderRadius: 16, padding: 18, gap: 8 },
  welcomeTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  welcomeText: { color: '#becbe0', lineHeight: 20 },
  bubbleWrap: { gap: 6, maxWidth: '92%' },
  alignEnd: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  user: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistant: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  errorBubble: { backgroundColor: colors.dangerSoft, borderColor: '#f3c3bf' },
  typing: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  userText: { color: '#fff', lineHeight: 20 },
  text: { color: colors.text, lineHeight: 21 },
  errorText: { color: colors.danger, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 13 },
  notice: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  products: { gap: 8 },
  productChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, maxWidth: 180 },
  productName: { color: colors.text, fontWeight: '700', fontSize: 13 },
  productQty: { fontWeight: '800', fontSize: 13, marginTop: 2 },
  action: { width: '100%', minWidth: 280 },
  trace: { color: colors.muted, fontSize: 11 },
  suggestions: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  inputBar: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' },
  input: { flex: 1, maxHeight: 110, backgroundColor: colors.background, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 18 },
  limit: { padding: 14, backgroundColor: colors.warningSoft },
  limitText: { color: colors.warning, textAlign: 'center', fontWeight: '700' },
});
