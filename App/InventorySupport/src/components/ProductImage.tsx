import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { resolveImageUrl } from '../services/api';

/** Ảnh sản phẩm; không có ảnh (hoặc tải lỗi) thì hiển thị chữ cái đầu. */
export function ProductImage({ uri, name, size = 48 }: { uri?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const source = resolveImageUrl(uri);
  const box = { width: size, height: size, borderRadius: Math.round(size / 4) };
  if (source && !failed) {
    return (
      <Image
        source={{ uri: source }}
        style={[styles.image, box]}
        onError={() => setFailed(true)}
        accessibilityLabel={`Ảnh ${name}`}
      />
    );
  }
  return (
    <View style={[styles.placeholder, box]}>
      <Text style={[styles.letter, { fontSize: Math.round(size / 2.6) }]}>{name.charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.primarySoft },
  placeholder: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  letter: { color: colors.primary, fontWeight: '800' },
});
