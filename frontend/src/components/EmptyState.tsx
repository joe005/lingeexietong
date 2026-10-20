import type { ReactNode } from 'react';
import { EmptyIcon } from './icons';

/** 全局空态：说明 + 创建入口引导（action 由页面提供）。 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <EmptyIcon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-700">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
