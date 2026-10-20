import { Link } from 'react-router-dom';
import { getApiClient } from '../api';
import type { Stats } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { TableSkeleton, btnPrimary } from '../components/ui';

function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClass = {
    default: 'text-slate-800',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${toneClass}`} data-testid={`metric-${label}`}>
        {value}
      </p>
    </div>
  );
}

const metricTone = { blue: 'blue', green: 'green', amber: 'amber', red: 'red' } as const;

/** 数据分析：指标卡 + 按商场汇总表（stats 由服务端实时聚合，与实际记录一致）。 */
export default function AnalyticsPage() {
  const resource = useResource(() => getApiClient().then((api) => api.getStats()), []);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '数据分析' }]}
        description="基于系统内实际运营记录的实时聚合统计（任务执行 / 机器人运行 / 运维记录）"
        actions={<RefreshControl refreshing={resource.refreshing} onRefresh={() => void resource.refresh({ silent: true })} />}
      />
      <ResourceView resource={resource} skeleton={<TableSkeleton rows={8} />}>
        {({ stats }: { stats: Stats }) =>
          stats.totals.malls === 0 && stats.totals.robots === 0 ? (
            <EmptyState
              title="暂无运营数据"
              description="登记商场、楼层与机器人并产生任务与运维记录后，这里将展示汇总统计。"
              action={
                <Link to="/malls" className={btnPrimary}>
                  去组织管理开始登记
                </Link>
              }
            />
          ) : (
            <div className="space-y-5">
              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">总体规模</h2>
                <div className="grid grid-cols-3 gap-3">
                  <MetricTile label="商场" value={stats.totals.malls} />
                  <MetricTile label="楼层" value={stats.totals.floors} />
                  <MetricTile label="机器人" value={stats.totals.robots} />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">机器人运行状态</h2>
                <div className="grid grid-cols-3 gap-3">
                  <MetricTile label="空闲" value={stats.totals.robots_idle} />
                  <MetricTile label="执行任务中" value={stats.totals.robots_executing} tone={metricTone.blue} />
                  <MetricTile label="异常" value={stats.totals.robots_fault} tone={metricTone.red} />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">任务执行</h2>
                <div className="grid grid-cols-4 gap-3">
                  <MetricTile label="任务总数" value={stats.totals.tasks} />
                  <MetricTile label="待执行" value={stats.totals.tasks_pending} tone={metricTone.amber} />
                  <MetricTile label="执行中" value={stats.totals.tasks_executing} tone={metricTone.blue} />
                  <MetricTile label="已完成" value={stats.totals.tasks_completed} tone={metricTone.green} />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">运维记录</h2>
                <div className="grid grid-cols-3 gap-3">
                  <MetricTile label="运维总数" value={stats.totals.maintenance} />
                  <MetricTile label="未处理" value={stats.totals.maintenance_open} tone={metricTone.red} />
                  <MetricTile label="已处理" value={stats.totals.maintenance_resolved} tone={metricTone.green} />
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold text-slate-700">按商场汇总</h2>
                {stats.by_mall.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center text-xs text-slate-400">
                    暂无商场数据
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                          <th className="px-4 py-3 font-medium">商场</th>
                          <th className="px-4 py-3 font-medium">楼层</th>
                          <th className="px-4 py-3 font-medium">机器人</th>
                          <th className="px-4 py-3 font-medium">异常机器人</th>
                          <th className="px-4 py-3 font-medium">任务</th>
                          <th className="px-4 py-3 font-medium">完成任务</th>
                          <th className="px-4 py-3 font-medium">未处理运维</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.by_mall.map((row) => (
                          <tr key={row.mall_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <Link to={`/malls/${row.mall_id}`} className="font-medium text-blue-600 hover:text-blue-700" title={row.mall_name}>
                                {row.mall_name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-700">{row.floors}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700">{row.robots}</td>
                            <td className="px-4 py-3 tabular-nums text-red-600">{row.robots_fault}</td>
                            <td className="px-4 py-3 tabular-nums text-slate-700">{row.tasks}</td>
                            <td className="px-4 py-3 tabular-nums text-emerald-600">{row.tasks_completed}</td>
                            <td className="px-4 py-3 tabular-nums text-red-600">{row.maintenance_open}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <p className="text-xs leading-relaxed text-slate-400">
                统计口径：以上数值由服务端对系统内实际记录（任务、机器人状态、运维事件）实时聚合计算，无缓存与预聚合，与各模块列表数据同源一致。
              </p>
            </div>
          )
        }
      </ResourceView>
    </div>
  );
}
