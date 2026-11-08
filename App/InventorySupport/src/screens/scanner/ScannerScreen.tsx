import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { productService } from '../../services/product.service';
import { useAuth } from '../../store/auth.store';

export function ScannerScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function handleBarcodeScanned({ data }: { data: string }) {
    if (!token || scanned || !data.trim()) return;
    setScanned(true);
    setBusy(true);
    setMessage(`Đang tìm mã ${data}...`);
    try {
      const product = await productService.findByBarcode(token, data.trim());
      setMessage(`Đã tìm thấy: ${product.name}`);
      navigation.navigate('Inventory', { productId: product.id });
    } catch (cause) {
      setMessage((cause as Error).message);
      setScanned(false);
    } finally {
      setBusy(false);
    }
  }

  if (!permission) {
    return <CenteredState text="Đang kiểm tra quyền camera..." />;
  }

  if (!permission.granted) {
    return (
      <CenteredState text="Ứng dụng cần quyền camera để quét barcode.">
        <Button
          title={permission.canAskAgain ? 'Cho phép camera' : 'Mở cài đặt'}
          onPress={() => permission.canAskAgain ? void requestPermission() : void Linking.openSettings()}
        />
      </CenteredState>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.instruction}>Đưa mã barcode vào khung để quét</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.status}>{busy ? 'Đang xử lý...' : message || 'Sẵn sàng quét barcode'}</Text>
        {scanned ? <Pressable style={styles.button} onPress={() => { setScanned(false); setMessage(''); }}><Text style={styles.buttonText}>Quét mã khác</Text></Pressable> : null}
      </View>
    </SafeAreaView>
  );
}

function CenteredState({ text, children }: { text: string; children?: ReactNode }) {
  return <SafeAreaView style={styles.centered}><Text style={styles.stateText}>{text}</Text>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111827' },
  cameraContainer: { flex: 1, overflow: 'hidden' },
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  overlay: { alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: '78%', height: 180, borderWidth: 3, borderColor: '#b9d1ff', borderRadius: 18 },
  instruction: { color: '#fff', backgroundColor: '#17233bcc', padding: 10, borderRadius: 8, marginTop: 28 },
  footer: { backgroundColor: '#fff', padding: 18, gap: 12 },
  status: { color: '#17233b', textAlign: 'center', minHeight: 20 },
  button: { backgroundColor: '#2f6fed', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  centered: { flex: 1, backgroundColor: '#f5f7fb', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  stateText: { color: '#17233b', textAlign: 'center', fontSize: 16 },
});
