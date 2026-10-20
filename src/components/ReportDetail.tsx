import { AlertTriangle } from 'lucide-react';
import { formatArea, formatDateTime, formatDuration } from '../lib/format';
import type { Report } from '../types';

export function ReportDetail({ report }: { report: Report }) {
  return (
    <div className="report-detail">
      <dl className="detail-grid">
        <div>
          <dt>楼层 / 区域</dt>
          <dd>
            {report.floor} · {report.zoneName}
          </dd>
        </div>
        <div>
          <dt>作业时间</dt>
          <dd>{formatDateTime(report.scheduledTime)}</dd>
        </div>
        <div>
          <dt>清洁模式</dt>
          <dd>{report.cleaningMode}</dd>
        </div>
        <div>
          <dt>执行机器人</dt>
          <dd>{report.robotName}</dd>
        </div>
        <div>
          <dt>开始时间</dt>
          <dd>{formatDateTime(report.startedAt)}</dd>
        </div>
        <div>
          <dt>完成时间</dt>
          <dd>{formatDateTime(report.completedAt)}</dd>
        </div>
        <div>
          <dt>执行时长</dt>
          <dd>{formatDuration(report.durationMs)}</dd>
        </div>
        <div>
          <dt>任务进度</dt>
          <dd>100%</dd>
        </div>
        <div>
          <dt>已清洁面积</dt>
          <dd>
            {formatArea(report.cleanedAreaSqm)}（区域总面积 {formatArea(report.zoneAreaSqm)}）
          </dd>
        </div>
      </dl>
      <h3 className="card-subtitle">异常记录</h3>
      {report.exceptions.length === 0 ? (
        <p className="empty-hint">本次执行无异常记录。</p>
      ) : (
        <ul className="exception-list">
          {report.exceptions.map((item) => (
            <li key={item.kind}>
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
                <span>发生于执行开始后约 {formatDuration(item.atMs)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
