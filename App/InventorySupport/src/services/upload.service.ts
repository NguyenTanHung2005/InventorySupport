import * as ImagePicker from 'expo-image-picker';
import { request } from './api';

export interface PickedImage {
  /** URI để xem trước ngay trên máy. */
  uri: string;
  base64: string;
  mimeType: string;
}

/**
 * Mở camera hoặc thư viện ảnh và trả về ảnh dạng base64.
 * Trả về `undefined` nếu người dùng hủy. Ném lỗi nếu bị từ chối quyền.
 */
export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | undefined> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera' ? 'Bạn chưa cấp quyền camera' : 'Bạn chưa cấp quyền truy cập thư viện ảnh');
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    allowsEditing: true,
    aspect: [1, 1],
  };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return undefined;

  const asset = result.assets[0];
  // Trên web, uri thường là data URL nên có thể dùng thay base64.
  const base64 = asset.base64 ?? (asset.uri.startsWith('data:') ? asset.uri : undefined);
  if (!base64) throw new Error('Không đọc được dữ liệu ảnh');
  return { uri: asset.uri, base64, mimeType: asset.mimeType ?? 'image/jpeg' };
}

export const uploadService = {
  uploadImage: (token: string, image: PickedImage) =>
    request<{ url: string; size: number }>('/uploads/image', {
      method: 'POST',
      token,
      body: { base64: image.base64, mimeType: image.mimeType },
    }),
};
