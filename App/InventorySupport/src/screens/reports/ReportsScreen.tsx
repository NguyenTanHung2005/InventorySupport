import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
export function ReportsScreen() { return <SafeAreaView style={styles.page}><View style={styles.card}><Text style={styles.title}>Báo cáo</Text><Text style={styles.text}>Báo cáo nhập, xuất và tồn kho sẽ được mở rộng từ dữ liệu giao dịch.</Text></View></SafeAreaView>; }
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#f5f7fb', padding: 18 }, card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 }, title: { fontSize: 20, fontWeight: '800' }, text: { color: '#68758a', marginTop: 8 } });
