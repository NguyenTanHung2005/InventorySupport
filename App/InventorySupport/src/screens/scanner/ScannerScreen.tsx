import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ProductCard } from '../../components/ProductCard';
import { Badge, Button, Card, ErrorBanner, Segmented } from '../../components/ui';
import { colors } from '../../constants/theme';
import type { RootNavigation } from '../../navigation/types';
import { aiService } from '../../services/ai.service';
import { ApiError } from '../../services/api';
import { productService } from '../../services/product.service';
import { pickImage, uploadService } from '../../services/upload.service';
import { useAuth, useToken } from '../../store/auth.store';
import { AiResult, AiSuggestion, Product, StockType } from '../../types';

type Mode = 'barcode' | 'image';

type BarcodeResult =
  | { status: 'found'; code: string; product: Product }
  | { status: 'missing'; code: string };

export function ScannerScreen() {
  const { can } = useAuth();
  const [mode, setMode] = useState<Mode>('barcode');
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {can('AI_USE') ? (
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'barcode', label: '▦ Mã vạch / QR' },
            { value: 'image', label: '📷 Ảnh (AI)' },
          ]}
        />
      ) : null}
      {mode === 'barcode' ? <BarcodeScanner /> : <ImageScanner />}
    </ScrollView>
  );
}

/* ---------------------------------- Quét mã vạch ---------------------------------- */

function BarcodeScanner() {
  const token = useToken();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<BarcodeResult>();
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  async function lookup(raw: string) {
    const code = raw.trim();
    if (!code || locked.current) return;
    // Khóa ngay để camera không gọi API liên tục cho cùng một mã.
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const product = await productService.findByBarcode(token, code);
      setResult({ status: 'found', code, product });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        setResult({ status: 'missing', code });
      } else {
        setError((cause as Error).message);
        locked.current = false;
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    locked.current = false;
    setResult(undefined);
    setManual('');
    setError('');
  }

  const scanning = isFocused && !result && !busy;
  return (
    <View style={{ gap: 12 }}>
      {!permission ? (
        <ActivityIndicator color={colors.primary} />
      ) : !permission.granted ? (
        <Card>
          <Text style={styles.text}>Ứng dụng cần quyền camera để quét mã vạch.</Text>
          <Button
            title={permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt'}
            onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
          />
        </Card>
      ) : (
        <View style={styles.cameraBox}>
          {/* Chỉ bật camera khi tab đang mở để tiết kiệm pin và giải phóng camera cho app khác. */}
          {isFocused ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={scanning ? ({ data }: BarcodeScanningResult) => void lookup(data) : undefined}
            />
          ) : null}
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, !scanning && styles.framePaused]} />
            <Text style={styles.instruction}>{busy ? 'Đang tra cứu...' : result ? 'Đã quét xong' : 'Đưa mã vạch vào khung'}</Text>
          </View>
        </View>
      )}

      <Card>
        <Text style={styles.label}>Hoặc nhập mã thủ công</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={styles.input}
            value={manual}
            onChangeText={setManual}
            placeholder="Ví dụ: 8934588012345"
            placeholderTextColor="#9aa5b5"
            keyboardType="number-pad"
            onSubmitEditing={() => void lookup(manual)}
          />
          <Button title="Tra" onPress={() => void lookup(manual)} disabled={!manual.trim() || busy} />
        </View>
      </Card>

      <ErrorBanner message={error} />
      {result ? <BarcodeResultCard result={result} onReset={reset} /> : null}
    </View>
  );
}

function BarcodeResultCard({ result, onReset }: { result: BarcodeResult; onReset: () => void }) {
  const navigation = useNavigation<RootNavigation>();
  const { can } = useAuth();
  const openStock = (productId: string, type: StockType) =>
    navigation.navigate('Tabs', { screen: 'Inventory', params: { productId, type, nonce: Date.now() } });

  if (result.status === 'missing') {
    return (
      <Card>
        <Badge label="Chưa có trong kho" tone="warning" />
        <Text style={styles.text}>Mã <Text style={styles.bold}>{result.code}</Text> chưa được đăng ký.</Text>
        {can('PRODUCT_CREATE') ? (
          <Button title="Tạo sản phẩm với mã này" icon="＋" onPress={() => navigation.navigate('ProductForm', { prefill: { barcode: result.code } })} />
        ) : (
          <Text style={styles.meta}>Báo quản lý để thêm sản phẩm mới.</Text>
        )}
        <Button title="Quét mã khác" variant="ghost" onPress={onReset} />
      </Card>
    );
  }

  const { product } = result;
  return (
    <Card>
      <Badge label="Đã tìm thấy" tone="success" />
      <ProductCard product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />
      <View style={styles.actions}>
        {can('STOCK_EXPORT') ? (
          <Button title="Xuất" icon="⬆" variant="danger" style={styles.action} disabled={product.quantity === 0} onPress={() => openStock(product.id, 'EXPORT')} />
        ) : null}
        {can('STOCK_IMPORT') ? <Button title="Nhập" icon="⬇" variant="success" style={styles.action} onPress={() => openStock(product.id, 'IMPORT')} /> : null}
        {can('STOCK_ADJUST') ? <Button title="Kiểm kê" variant="ghost" style={styles.action} onPress={() => openStock(product.id, 'ADJUSTMENT')} /> : null}
      </View>
      <Button title="Quét mã khác" variant="ghost" onPress={onReset} />
    </Card>
  );
}

/* ---------------------------------- Quét ảnh bằng AI ---------------------------------- */

function ImageScanner() {
  const token = useToken();
  const navigation = useNavigation<RootNavigation>();
  const [preview, setPreview] = useState<string>();
  const [stage, setStage] = useState<'idle' | 'uploading' | 'analyzing'>('idle');
  const [result, setResult] = useState<AiResult>();
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'claude' | 'heuristic'>();

  useEffect(() => {
    aiService.status(token).then((status) => setProvider(status.provider)).catch(() => undefined);
  }, [token]);

  async function scan(source: 'camera' | 'library') {
    setError('');
    setResult(undefined);
    try {
      const image = await pickImage(source);
      if (!image) return;
      setPreview(image.uri);
      setStage('uploading');
      const { url } = await uploadService.uploadImage(token, image);
      setStage('analyzing');
      setResult(await aiService.scanImage(token, url));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setStage('idle');
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.label}>Nhận diện sản phẩm từ ảnh</Text>
        <Text style={styles.meta}>
          Chụp bao bì sản phẩm (thấy rõ tên, quy cách, mã vạch nếu có). AI gợi ý tên chuẩn, danh mục, đơn vị và đối chiếu với hàng trong kho.
        </Text>
        {provider === 'heuristic' ? (
          <Text style={styles.warning}>Máy chủ chưa cấu hình AI nhận diện ảnh (ANTHROPIC_API_KEY). Bạn vẫn có thể dùng trợ lý AI bằng chữ.</Text>
        ) : null}
        <View style={styles.actions}>
          <Button title="Chụp ảnh" icon="📷" style={styles.action} loading={stage !== 'idle'} onPress={() => scan('camera')} />
          <Button title="Chọn ảnh" variant="ghost" style={styles.action} disabled={stage !== 'idle'} onPress={() => scan('library')} />
        </View>
        <Button title="Mô tả bằng chữ thay vì ảnh" variant="secondary" onPress={() => navigation.navigate('AiAssistant')} />
      </Card>

      {preview ? (
        <View style={styles.previewBox}>
          <Image source={{ uri: preview }} style={styles.preview} />
          {stage !== 'idle' ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.previewText}>{stage === 'uploading' ? 'Đang tải ảnh lên...' : 'AI đang nhận diện...'}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <ErrorBanner message={error} />

      {result ? (
        result.suggestions.length ? (
          result.suggestions.map((suggestion, index) => (
            <SuggestionCard key={`${suggestion.normalizedName}-${index}`} suggestion={suggestion} imageUrl={result.imageUrl} />
          ))
        ) : (
          <Card>
            <Text style={styles.text}>AI không nhận ra sản phẩm nào trong ảnh. Hãy chụp gần và rõ nhãn hơn.</Text>
          </Card>
        )
      ) : null}
    </View>
  );
}

function SuggestionCard({ suggestion, imageUrl }: { suggestion: AiSuggestion; imageUrl?: string }) {
  const navigation = useNavigation<RootNavigation>();
  const { can } = useAuth();
  const confidence = Math.round(suggestion.confidence * 100);
  const matches = suggestion.matchedProducts ?? [];
  return (
    <Card>
      <View style={styles.suggestionHeader}>
        <Text style={styles.suggestionName}>{suggestion.normalizedName}</Text>
        <Badge label={`${confidence}%`} tone={confidence >= 75 ? 'success' : confidence >= 50 ? 'warning' : 'danger'} />
      </View>
      <Text style={styles.meta}>{suggestion.category} · {suggestion.unit}{suggestion.barcode ? ` · ${suggestion.barcode}` : ''}</Text>
      <Text style={styles.text}>{suggestion.description}</Text>

      {matches.length ? (
        <>
          <Text style={styles.label}>Sản phẩm có sẵn khớp với ảnh:</Text>
          {matches.map((product) => (
            <ProductCard key={product.id} product={product} onPress={() => navigation.navigate('ProductDetail', { productId: product.id })} />
          ))}
        </>
      ) : (
        <Text style={styles.meta}>Chưa có sản phẩm nào trong kho khớp với gợi ý này.</Text>
      )}

      {can('PRODUCT_CREATE') ? (
        <Button
          title={matches.length ? 'Vẫn tạo sản phẩm mới' : 'Tạo sản phẩm từ gợi ý'}
          variant={matches.length ? 'ghost' : 'primary'}
          onPress={() =>
            navigation.navigate('ProductForm', {
              prefill: {
                name: suggestion.normalizedName,
                category: suggestion.category,
                unit: suggestion.unit,
                description: suggestion.description,
                barcode: suggestion.barcode,
                // Dùng luôn ảnh vừa chụp làm ảnh sản phẩm.
                imageUrl,
              },
            })
          }
        />
      ) : null}
      <Text style={styles.hint}>Hãy kiểm tra lại thông tin AI gợi ý trước khi lưu.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  cameraBox: { height: 300, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111827' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '80%', height: 150, borderWidth: 3, borderColor: '#b9d1ff', borderRadius: 18 },
  framePaused: { borderColor: '#4ade80' },
  instruction: { color: '#fff', backgroundColor: '#17233bcc', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 18, overflow: 'hidden' },
  label: { color: colors.text, fontWeight: '800' },
  text: { color: colors.text, lineHeight: 20 },
  bold: { fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft, padding: 10, borderRadius: 8, overflow: 'hidden' },
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: colors.text },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  previewBox: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111827' },
  preview: { width: '100%', height: '100%', resizeMode: 'contain' },
  previewOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewText: { color: '#fff', fontWeight: '700' },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  suggestionName: { color: colors.text, fontWeight: '800', fontSize: 17, flex: 1 },
});
