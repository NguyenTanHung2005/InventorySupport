import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/** Gọi `refresh` mỗi khi quay lại màn hình, bỏ qua lần focus đầu tiên (đã tải lúc mount). */
export function useRefreshOnFocus(refresh: () => void) {
  const firstFocus = useRef(true);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refreshRef.current();
    }, []),
  );
}
