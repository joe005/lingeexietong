import { isApiRequestError } from '../api/client';
import { AlertIcon } from './icons';

/** 全局错误状态：错误条 + 重试（保留已加载数据时以紧凑形态展示在数据上方）。 */
export function ErrorBanner({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 ${compact ? 'px-4 py-2.5' : 'p-4'} text-red-700`}
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">数据加载失败</p>
        <p className="mt-0.5 text-xs leading-relaxed break-words">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
        >
          重试
        </button>
      ) : null}
    </div>
  );
}

export function errorText(error: unknown): string {
  if (isApiRequestError(error)) return error.message;
  return error instanceof Error ? error.message : String(error);
}
