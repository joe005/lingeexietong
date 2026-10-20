import { AlertTriangle, Bot, CheckCircle2, Clock, Gauge, MapPin, Sparkles } from 'lucide-react';
import { formatArea, formatDuration, formatPercent } from '../lib/format';
import { eventsUpTo, snapshotAt } from '../simulator/simulator';
import type { ActiveExecution, Plan, Robot } from '../types';

export function ExecutionDashboard({
  plan,
  robot,
  execution,
  now,
}: {
  plan: Plan;
  robot: Robot;
  execution: ActiveExecution;
  now: number;
}) {
  const snapshot = snapshotAt(execution, plan.zoneAreaSqm, now);
  const events = eventsUpTo(execution, snapshot.elapsedMs).slice(-8).reverse();
  const exception = snapshot.activeException;

  return (
    <section className="card">
      <div className="card-header-row">
        <h2 className="card-title">
          实时看板 · {plan.floor} · {plan.zoneName}
        </h2>
        <span className={exception ? 'status-badge status-exception' : 'status-badge status-normal'}>
          {exception ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
          {exception ? `异常：${exception.label}` : '状态正常'}
        </span>
      </div>
      <div className="metric-grid">
        <div className="metric">
          <span className="metric-label">
            <MapPin size={14} aria-hidden="true" /> 当前位置
          </span>
          <strong className="metric-value">
            {plan.floor} · {plan.zoneName} · {snapshot.stationName}
          </strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <Bot size={14} aria-hidden="true" /> 执行机器人
          </span>
          <strong className="metric-value">{robot.name}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <Gauge size={14} aria-hidden="true" /> 任务进度
          </span>
          <strong className="metric-value">{formatPercent(snapshot.progressPct)}</strong>
          <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(snapshot.progressPct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${snapshot.progressPct}%` }} />
          </div>
        </div>
        <div className="metric">
          <span className="metric-label">
            <Sparkles size={14} aria-hidden="true" /> 已清洁面积
          </span>
          <strong className="metric-value">
            {formatArea(snapshot.cleanedAreaSqm)} <small>/ {formatArea(plan.zoneAreaSqm)}</small>
          </strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <Clock size={14} aria-hidden="true" /> 已执行时长
          </span>
          <strong className="metric-value">{formatDuration(snapshot.elapsedMs)}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">
            <AlertTriangle size={14} aria-hidden="true" /> 异常状态
          </span>
          <strong className="metric-value metric-value-text">{exception ? exception.detail : '无异常'}</strong>
        </div>
      </div>
      <h3 className="card-subtitle">执行事件</h3>
      <ul className="event-log">
        {events.map((event, index) => (
          <li key={`${event.kind}-${event.atMs}-${index}`} className={`event event-${event.kind}`}>
            <span className="event-time">{formatDuration(event.atMs)}</span>
            <span className="event-message">{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
