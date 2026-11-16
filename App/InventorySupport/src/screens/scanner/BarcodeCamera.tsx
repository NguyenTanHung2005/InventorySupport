import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { Button, Card } from '../../components/ui';
import { colors } from '../../constants/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const;

/**
 * Camera quét mã dùng chung cho chế độ Tra cứu và Quét liên tục (docs/SCAN.md mục 2).
 * - Chỉ bật khi tab đang hiển thị và `active` (tiết kiệm pin, nhả camera cho app khác).
 * - Bỏ qua cùng một mã trong `cooldownMs` vì camera đọc một mã nhiều lần mỗi giây.
 * - Rung nhẹ mỗi lần ghi nhận để người dùng không cần nhìn màn hình.
 * - Luôn có ô nhập mã tay (web, mã mờ, không có camera).
 */
export function BarcodeCamera({
  visible = true,
  active,
  onScan,
  hint,
  status,
  cooldownMs = 1500,
  height = 260,
}: {
  /** Gắn camera (chỉ một camera được gắn tại một thời điểm). */
  visible?: boolean;
  /** Đang nhận mã (false = tạm dừng, ví dụ khi đang hiển thị kết quả). */
  active: boolean;
  onScan: (raw: string) => void;
  hint: string;
  status?: string;
  cooldownMs?: number;
  height?: number;
}) {
  const isFocused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cameraError, setCameraError] = useState('');
  useEffect(() => { const listener = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => listener.remove(); }, []);
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  function accept(raw: string, fromCamera: boolean) {
    const code = raw.trim();
    if (!code || !active || !visible || !isFocused || AppState.currentState !== 'active') return;
    const now = Date.now();
    if (fromCamera && code === last.current.code && now - last.current.at < cooldownMs) return;
    last.current = { code, at: now };
    if (Platform.OS !== 'web') Vibration.vibrate(40);
    onScan(code);
  }

  const mounted = isFocused && visible && foreground;
  const cameraOn = mounted && active;
  return (
    <View style={{ gap: 10 }}>
      {!permission ? (
        <ActivityIndicator color={colors.primary} />
      ) : !permission.granted ? (
        <Card>
          <Text style={styles.text}>Ứng dụng cần quyền camera để quét mã vạch / QR.</Text>
          <Button
            title={permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt'}
            onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
          />
        </Card>
      ) : (
        <View style={[styles.cameraBox, { height }]}>
          {mounted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onMountError={({ message }) => setCameraError(message)}
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={cameraOn ? ({ data }: BarcodeScanningResult) => accept(data, true) : undefined}
            />
          ) : null}
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, !cameraOn && styles.framePaused]} />
            <Text style={styles.instruction}>{status ?? hint}</Text>
          </View>
        </View>
      )}

      {cameraError ? <Text accessibilityRole="alert">{cameraError}. Có thể nhập mã thủ công.</Text> : null}
      <View style={styles.manualRow}>
        <TextInput
          style={styles.input}
          value={manual}
          onChangeText={setManual}
          placeholder="Nhập mã thủ công"
          placeholderTextColor="#9aa5b5"
          autoCapitalize="characters"
          onSubmitEditing={() => {
            accept(manual, false);
            setManual('');
          }}
          returnKeyType="search"
        />
        <Button
          title="Nhập"
          variant="secondary"
          disabled={!manual.trim() || !active || !mounted}
          onPress={() => {
            accept(manual, false);
            setManual('');
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text },
  cameraBox: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#111827' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '80%', height: 140, borderWidth: 3, borderColor: '#b9d1ff', borderRadius: 18 },
  framePaused: { borderColor: '#4ade80' },
  instruction: { color: '#fff', backgroundColor: '#17233bcc', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 16, overflow: 'hidden', textAlign: 'center' },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text },
});
