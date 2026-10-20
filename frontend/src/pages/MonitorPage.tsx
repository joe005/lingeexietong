import { Link } from 'react-router-dom';
import { getApiClient } from '../api';
import type { Floor, MallSummary, Robot } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { RobotStatusBadge } from '../components/StatusBadge';
import { SkeletonBlock, btnPrimary } from '../components/ui';
import type { RobotStatus } from '../api/types';

const POLL_INTERVAL_MS = 5000;

const STATUS_STYLES: Record<RobotStatus, { bar: string; dot: string; label: string }> = {
  idle: { bar: 'bg-slate-400', dot: 'bg-slate-400', label: '空闲' },
  executing: { bar: 'bg-blue-500', dot: 'bg-blue-500', label: '执行任务中' },
  fault: { bar: 'bg-red-500', dot: 'bg-red-500', label: '异常' },
};

function RobotCard({ robot, mallName, floorName }: { robot: Robot; mallName: string; floorName: string }) {
  const borderClass =
    robot.status === 'fault'
      ? 'border-red-300'
      : robot.status === 'executing'
        ? 'border-blue-300'
        : 'border-slate-200';
  return (
    <Link
      to={`/robots/${robot.id}`}
      className={`flex flex-col rounded-lg border bg-white p-4 transition hover:shadow-sm ${borderClass}`}
      title={`${robot.code} · ${robot.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800" title={robot.name}>
            {robot.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{robot.code}</p>
        </div>
        <RobotStatusBadge status={robot.status} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="max-w-[12rem] truncate text-slate-500" title={`${mallName} · ${floorName}`}>
          {mallName} · {floorName}
        </span>
        {robot.current_task_id !== null ? (
          <span className="shrink-0 text-blue-600">任务 #{robot.current_task_id}</span>
        ) : (
          <span className="shrink-0 text-slate-400">无执行任务</span>
        )}
      </div>
    </Link>
  );
}

/** 实时监控：按商场/楼层分组的状态卡片墙 + 状态统计条；5 秒轮询 + 手动刷新。 */
export default function MonitorPage() {
  const resource = useResource(
    async () => {
      const api = await getApiClient();
      const [malls, floors, robots] = await Promise.all([api.listMalls(), api.listFloors(), api.listRobots()]);
      return {
        malls: malls.malls as MallSummary[],
        floors: floors.floors as Floor[],
        robots: robots.robots as Robot[],
      };
    },
    [],
    { pollMs: POLL_INTERVAL_MS },
  );

  const statusCounts: Record<RobotStatus, number> = { idle: 0, executing: 0, fault: 0 };
  for (const robot of resource.data?.robots ?? []) {
    statusCounts[robot.status] += 1;
  }
  const total = resource.data?.robots.length ?? 0;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '实时监控' }]}
        description="全部机器人的当前运行状态与所在商场/楼层"
        actions={
          <RefreshControl
            refreshing={resource.refreshing}
            onRefresh={() => void resource.refresh({ silent: true })}
            pollSeconds={POLL_INTERVAL_MS / 1000}
          />
        }
      />
      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-72" />}>
        {({ malls, floors, robots }) =>
          robots.length === 0 ? (
            <EmptyState
              title="暂无机器人可监控"
              description="登记机器人后，这里将按商场/楼层分组展示每台机器人的实时状态。"
              action={
                <Link to="/malls" className={btnPrimary}>
                  去组织管理登记机器人
                </Link>
              }
            />
          ) : (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="text-sm font-semibold text-slate-700">机器人状态统计</span>
                  <span className="text-xs text-slate-400">共 {total} 台</span>
                  {(Object.keys(STATUS_STYLES) as RobotStatus[]).map((status) => (
                    <span
                      key={status}
                      className="flex items-center gap-1.5 text-xs text-slate-600"
                      data-testid={`monitor-stat-${status}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[status].dot}`} />
                      {STATUS_STYLES[status].label}
                      <span className="font-semibold text-slate-800">{statusCounts[status]}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100" data-testid="monitor-stat-bar">
                  {(Object.keys(STATUS_STYLES) as RobotStatus[]).map((status) =>
                    statusCounts[status] > 0 ? (
                      <div
                        key={status}
                        className={STATUS_STYLES[status].bar}
                        style={{ width: `${(statusCounts[status] / Math.max(total, 1)) * 100}%` }}
                        title={`${STATUS_STYLES[status].label} ${statusCounts[status]}`}
                      />
                    ) : null,
                  )}
                </div>
              </section>

              {malls
                .filter((mall) => floors.some((floor) => floor.mall_id === mall.id))
                .map((mall) => {
                  const mallFloors = floors.filter((floor) => floor.mall_id === mall.id);
                  const mallFloorIds = new Set(mallFloors.map((floor) => floor.id));
                  const mallRobotCount = robots.filter((robot) => mallFloorIds.has(robot.floor_id)).length;
                  return (
                    <section key={mall.id} className="rounded-lg border border-slate-200 bg-white">
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
                        <h2 className="truncate text-sm font-semibold text-slate-800" title={mall.name}>
                          {mall.name}
                        </h2>
                        <span className="text-xs text-slate-400">
                          {mallFloors.length} 个楼层 · {mallRobotCount} 台机器人
                        </span>
                      </header>
                      <div className="divide-y divide-slate-100">
                        {mallFloors.map((floor) => {
                          const floorRobots = robots.filter((robot) => robot.floor_id === floor.id);
                          return (
                            <div key={floor.id} className="px-5 py-4">
                              <div className="mb-3 flex items-center justify-between">
                                <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500" title={floor.name}>
                                  {floor.name}
                                </h3>
                                <span className="text-xs text-slate-400">{floorRobots.length} 台</span>
                              </div>
                              {floorRobots.length === 0 ? (
                                <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-400">
                                  该楼层暂无机器人
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {floorRobots.map((robot) => (
                                    <RobotCard key={robot.id} robot={robot} mallName={mall.name} floorName={floor.name} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          )
        }
      </ResourceView>
    </div>
  );
}
