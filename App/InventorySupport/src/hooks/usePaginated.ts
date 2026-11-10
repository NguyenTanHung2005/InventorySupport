import { useCallback, useEffect, useRef, useState } from 'react';
import { PAGE_SIZE } from '../constants/config';
import { Paginated } from '../types';

/**
 * Tải danh sách có phân trang: trang đầu khi `deps` đổi, `loadMore` khi cuộn tới cuối,
 * `refresh` khi kéo để làm mới. Bỏ qua kết quả của request cũ nếu bộ lọc đã đổi.
 */
export function usePaginated<T>(
  fetchPage: (page: number, limit: number) => Promise<Paginated<T>>,
  deps: unknown[],
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  const load = useCallback(async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
    const id = ++requestId.current;
    // Đẩy cập nhật state sang microtask để không setState đồng bộ trong effect.
    await Promise.resolve();
    if (id !== requestId.current) return;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await fetchRef.current(nextPage, PAGE_SIZE);
      if (id !== requestId.current) return;
      setItems((current) => (mode === 'append' ? [...current, ...result.items] : result.items));
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (cause) {
      if (id === requestId.current) setError((cause as Error).message);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // load() chỉ setState sau `await`, đây là mẫu tải dữ liệu trong effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(1, 'replace');
    // `deps` do nơi gọi truyền vào, giống tham số thứ hai của useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const hasMore = page < totalPages;
  return {
    items,
    setItems,
    total,
    loading,
    refreshing,
    error,
    hasMore,
    refresh: () => load(1, 'refresh'),
    reload: () => load(1, 'replace'),
    loadMore: () => {
      if (hasMore && !loading && !refreshing) void load(page + 1, 'append');
    },
  };
}
