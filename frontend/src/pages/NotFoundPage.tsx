import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { btnPrimary } from '../components/ui';

/** 未知路由兜底页。 */
export default function NotFoundPage() {
  return (
    <EmptyState
      title="页面不存在"
      description="访问的页面不存在或已被移动，可返回实时监控继续操作。"
      action={
        <Link to="/monitor" className={btnPrimary}>
          返回实时监控
        </Link>
      }
    />
  );
}
