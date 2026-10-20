import type { PlanStatus } from '../types';

const LABELS: Record<PlanStatus, string> = {
  pending: '待分配',
  executing: '执行中',
  completed: '已完成',
};

export function StatusBadge({ status }: { status: PlanStatus }) {
  return <span className={`status-badge status-${status}`}>{LABELS[status]}</span>;
}
