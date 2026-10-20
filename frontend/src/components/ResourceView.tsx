import type { ReactNode } from 'react';
import type { Resource } from '../hooks/useResource';
import { ErrorBanner, errorText } from './ErrorBanner';
import { SkeletonBlock } from './ui';

/**
 * 资源视图容器：统一加载（骨架）/ 错误（错误条 + 重试）/ 数据渲染。
 *
 * - 首次加载显示骨架；静默刷新失败保留旧数据并显示紧凑错误条；
 * - 空态由页面在 children 内自行判断（空态引导语义与页面相关）。
 */
export function ResourceView<T>({
  resource,
  skeleton,
  children,
}: {
  resource: Resource<T>;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const { data, error, loading, refresh } = resource;

  if (loading && data === null) {
    return <>{skeleton ?? <SkeletonBlock className="h-40" />}</>;
  }
  if (error && data === null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ErrorBanner message={errorText(error)} onRetry={() => void refresh({ silent: false })} />
      </div>
    );
  }
  if (data === null) {
    return <>{skeleton ?? <SkeletonBlock className="h-40" />}</>;
  }
  return (
    <>
      {error ? <div className="mb-4"><ErrorBanner compact message={errorText(error)} onRetry={() => void refresh({ silent: true })} /></div> : null}
      {children(data)}
    </>
  );
}
