import { Link } from 'react-router-dom';
import { ChevronRightIcon } from './icons';

export interface Crumb {
  label: string;
  to?: string;
  /** 悬停显示的完整文本（截断文本以 title 显示全文）。 */
  title?: string;
}

/** 面包屑：组织管理逐层下钻导航（当前层不可点击）。 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : null}
          {crumb.to ? (
            <Link
              to={crumb.to}
              title={crumb.title ?? crumb.label}
              className="max-w-[14rem] truncate text-slate-500 transition hover:text-blue-600"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="max-w-[16rem] truncate font-medium text-slate-800" title={crumb.title ?? crumb.label}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
