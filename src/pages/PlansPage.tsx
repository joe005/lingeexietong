import { useMemo, useState } from 'react';
import { formatDateTime } from '../lib/format';
import { PlanForm } from '../components/PlanForm';
import { StatusBadge } from '../components/StatusBadge';
import { useAppState } from '../store/useStore';
import type { PlanStatus } from '../types';

const STATUS_FILTERS: { value: PlanStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待分配' },
  { value: 'executing', label: '执行中' },
  { value: 'completed', label: '已完成' },
];

export function PlansPage({ onOpenPlan }: { onOpenPlan: (planId: string) => void }) {
  const state = useAppState();
  const [filter, setFilter] = useState<PlanStatus | 'all'>('all');

  const plans = useMemo(
    () => (filter === 'all' ? state.plans : state.plans.filter((plan) => plan.status === filter)),
    [state.plans, filter],
  );

  const robotName = (robotId: string | null): string =>
    robotId ? state.robots.find((robot) => robot.id === robotId)?.name ?? robotId : '—';

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">创建晚间清洁计划</h2>
        <PlanForm onCreated={(plan) => onOpenPlan(plan.id)} />
      </section>
      <section className="card">
        <div className="card-header-row">
          <h2 className="card-title">清洁计划列表</h2>
          <div className="filter-group" role="group" aria-label="按状态筛选">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? 'chip chip-active' : 'chip'}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {plans.length === 0 ? (
          <p className="empty-hint">暂无计划，请先创建晚间清洁计划。</p>
        ) : (
          <table className="plan-table">
            <thead>
              <tr>
                <th>楼层 / 区域</th>
                <th>作业时间</th>
                <th>清洁模式</th>
                <th>状态</th>
                <th>分配机器人</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    {plan.floor} · {plan.zoneName}
                  </td>
                  <td>{formatDateTime(plan.scheduledTime)}</td>
                  <td>{plan.cleaningMode}</td>
                  <td>
                    <StatusBadge status={plan.status} />
                  </td>
                  <td>{robotName(plan.robotId)}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => onOpenPlan(plan.id)}>
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
