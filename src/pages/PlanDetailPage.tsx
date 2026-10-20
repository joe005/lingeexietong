import { useTicker } from '../lib/useTicker';
import { formatArea, formatDateTime, formatDuration } from '../lib/format';
import { ExecutionDashboard } from '../components/ExecutionDashboard';
import { ReportDetail } from '../components/ReportDetail';
import { RobotAssignForm } from '../components/RobotAssignForm';
import { StatusBadge } from '../components/StatusBadge';
import { useAppState } from '../store/useStore';

export function PlanDetailPage({ planId }: { planId: string }) {
  const state = useAppState();
  const now = useTicker(500);
  const plan = state.plans.find((item) => item.id === planId);

  if (!plan) {
    return (
      <div className="page">
        <section className="card">
          <p className="empty-hint">
            计划不存在或已删除。
            <a href="#/plans">返回计划列表</a>
          </p>
        </section>
      </div>
    );
  }

  const execution = state.executions.find((item) => item.planId === planId);
  const robot = plan.robotId ? state.robots.find((item) => item.id === plan.robotId) : undefined;
  const report = state.reports.find((item) => item.planId === planId);

  return (
    <div className="page">
      <section className="card">
        <div className="card-header-row">
          <h2 className="card-title">计划详情</h2>
          <StatusBadge status={plan.status} />
        </div>
        <dl className="detail-grid">
          <div>
            <dt>楼层</dt>
            <dd>{plan.floor}</dd>
          </div>
          <div>
            <dt>区域</dt>
            <dd>
              {plan.zoneName}（{formatArea(plan.zoneAreaSqm)}）
            </dd>
          </div>
          <div>
            <dt>作业时间</dt>
            <dd>{formatDateTime(plan.scheduledTime)}</dd>
          </div>
          <div>
            <dt>清洁模式</dt>
            <dd>{plan.cleaningMode}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{formatDateTime(plan.createdAt)}</dd>
          </div>
          <div>
            <dt>分配机器人</dt>
            <dd>{robot ? robot.name : '未分配'}</dd>
          </div>
        </dl>
      </section>

      {plan.status === 'pending' && (
        <section className="card">
          <h2 className="card-title">分配机器人</h2>
          <RobotAssignForm plan={plan} />
        </section>
      )}

      {plan.status === 'executing' && execution && robot && (
        <>
          <ExecutionDashboard plan={plan} robot={robot} execution={execution} now={now} />
          <p className="page-note">
            任务执行中，可在<a href="#/dashboard">实时看板</a>查看全部执行中的任务。
          </p>
        </>
      )}

      {plan.status === 'completed' && report && (
        <section className="card">
          <div className="card-header-row">
            <h2 className="card-title">执行完成</h2>
            <span className="status-badge status-completed">报告已生成</span>
          </div>
          <p className="form-hint">
            任务已完成（用时约 {formatDuration(report.durationMs)}），已清洁面积 {formatArea(report.cleanedAreaSqm)}，
            异常 {report.exceptions.length} 条。作业报告如下，也可在<a href="#/reports">作业报告</a>页查看全部报告。
          </p>
          <ReportDetail report={report} />
        </section>
      )}

      {plan.status === 'completed' && !report && (
        <section className="card">
          <p className="empty-hint">任务已完成。</p>
        </section>
      )}
    </div>
  );
}
