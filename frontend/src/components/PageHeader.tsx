import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';

/** 页头：面包屑 + 页面说明 + 操作区（创建/刷新等）。 */
export function PageHeader({
  crumbs,
  description,
  actions,
}: {
  crumbs: Crumb[];
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Breadcrumbs items={crumbs} />
        {description ? <p className="mt-1.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
