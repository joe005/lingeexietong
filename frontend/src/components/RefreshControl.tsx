import { RefreshIcon } from './icons';
import { Spinner, btnSecondary } from './ui';

/** 手动刷新控件：标注自动轮询周期，刷新中显示 spinner。 */
export function RefreshControl({
  refreshing,
  onRefresh,
  pollSeconds,
  label = '刷新',
}: {
  refreshing: boolean;
  onRefresh: () => void;
  pollSeconds?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {pollSeconds ? <span className="text-xs text-slate-400">每 {pollSeconds} 秒自动刷新</span> : null}
      <button type="button" className={btnSecondary} onClick={onRefresh} disabled={refreshing}>
        {refreshing ? <Spinner className="h-3.5 w-3.5" /> : <RefreshIcon className="h-3.5 w-3.5" />}
        {label}
      </button>
    </div>
  );
}
