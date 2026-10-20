import { useState } from 'react';
import { formatDateTime } from '../lib/format';
import { ReportDetail } from '../components/ReportDetail';
import { useAppState } from '../store/useStore';

export function ReportsPage() {
  const state = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.reports.find((report) => report.id === selectedId) ?? state.reports[0] ?? null;

  return (
    <div className="page reports-layout">
      <section className="card">
        <h2 className="card-title">作业报告</h2>
        {state.reports.length === 0 ? (
          <p className="empty-hint">暂无作业报告，任务完成后将自动生成。</p>
        ) : (
          <ul className="report-list">
            {state.reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className={selected?.id === report.id ? 'report-item report-item-active' : 'report-item'}
                  onClick={() => setSelectedId(report.id)}
                >
                  <strong>
                    {report.floor} · {report.zoneName}
                  </strong>
                  <span>
                    {report.robotName} · {formatDateTime(report.completedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected ? (
        <section className="card">
          <h2 className="card-title">报告详情</h2>
          <ReportDetail report={selected} />
        </section>
      ) : null}
    </div>
  );
}
