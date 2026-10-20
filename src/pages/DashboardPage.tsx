import { useTicker } from '../lib/useTicker';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { useAppState } from '../store/useStore';
import type { ActiveExecution, Plan, Robot } from '../types';

export function DashboardPage() {
  const state = useAppState();
  const now = useTicker(500);

  const active: { execution: ActiveExecution; plan: Plan; robot: Robot }[] = [];
  for (const execution of state.executions) {
    const plan = state.plans.find((item) => item.id === execution.planId);
    const robot = state.robots.find((item) => item.id === execution.robotId);
    if (plan && robot) active.push({ execution, plan, robot });
  }

  return (
    <div className="page">
      <section className="card">
        <div className="card-header-row">
          <h2 className="card-title">实时运营看板</h2>
          <div className="summary-strip">
            <span className="summary-item">
              执行中 <strong>{active.length}</strong>
            </span>
            <span className="summary-item">
              已完成 <strong>{state.reports.length}</strong>
            </span>
          </div>
        </div>
        {active.length === 0 ? (
          <div className="empty-hint">
            <p>当前没有执行中的任务。为计划分配机器人后，执行数据将在这里实时展示。</p>
            <a className="primary-button" href="#/plans">
              去创建清洁计划
            </a>
          </div>
        ) : null}
      </section>
      {active.map(({ execution, plan, robot }) => (
        <ExecutionDashboard key={execution.planId} plan={plan} robot={robot} execution={execution} now={now} />
      ))}
    </div>
  );
}
