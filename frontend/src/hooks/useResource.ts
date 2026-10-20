import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiRequestError, isApiRequestError } from '../api/client';

export interface Resource<T> {
  data: T | null;
  error: ApiRequestError | null;
  /** 首次加载或依赖变化加载中（显示骨架）。 */
  loading: boolean;
  /** 轮询 / 手动静默刷新中（不闪骨架）。 */
  refreshing: boolean;
  /** 写操作成功后调用：静默重新拉取受影响数据。 */
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
}

/**
 * 通用资源 hook：加载 / 错误 / 静默刷新 / 可选轮询。
 *
 * - deps 变化触发完整重新加载（骨架态）；轮询与手动刷新为静默刷新；
 * - 请求竞态保护：仅最新一次请求的响应会写入状态；
 * - 静默刷新失败时保留旧数据，由页面以错误条 + 重试呈现。
 */
export function useResource<T>(
  loader: () => Promise<T>,
  deps: DependencyList = [],
  options: { pollMs?: number } = {},
): Resource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const requestIdRef = useRef(0);
  const aliveRef = useRef(true);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refresh = useCallback(async (opts: { silent?: boolean } = {}) => {
    const silent = opts.silent ?? true;
    const requestId = ++requestIdRef.current;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const result = await loaderRef.current();
      if (!aliveRef.current || requestId !== requestIdRef.current) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (!aliveRef.current || requestId !== requestIdRef.current) return;
      const apiError = isApiRequestError(cause)
        ? cause
        : new ApiRequestError(0, 'UNKNOWN', cause instanceof Error ? cause.message : String(cause));
      setError(apiError);
    } finally {
      if (aliveRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // 依赖变化或首次挂载：完整加载（deps 由调用方保证长度稳定）
  useEffect(() => {
    void refresh({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const pollMs = options.pollMs;
    if (!pollMs) return;
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, pollMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, options.pollMs]);

  return { data, error, loading, refreshing, refresh };
}
