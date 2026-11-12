import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Segmented } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';
import { AssistantChat } from './AssistantChat';
import { NormalizePanel } from './NormalizePanel';

type Props = NativeStackScreenProps<RootStackParamList, 'AiAssistant'>;
type Mode = 'chat' | 'normalize';

/** Trợ lý AI: hỏi đáp kho (tool use) và chuẩn hóa mô tả sản phẩm. Xem docs/AI_ASSISTANT.md. */
export function AiScreen({ route }: Props) {
  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'chat');
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'chat', label: '💬 Hỏi đáp' },
            { value: 'normalize', label: '✨ Chuẩn hóa' },
          ]}
        />
      </View>
      <View style={styles.body}>{mode === 'chat' ? <AssistantChat /> : <NormalizePanel />}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 12 },
  body: { flex: 1 },
});
