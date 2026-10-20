import { useMemo, useState } from 'react';
import { getApiClient } from '../api';
import type { MaintenanceEvent, MaintenanceStatus, Robot } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { EventDetailDialog } from '../components/dialogs/EventDetailDialog';
import { EventFormDialog } from '../components/dialogs/EventFormDialog';
import { ResolveEventDialog } from '../components/dialogs/ResolveEventDialog';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { EventStatusBadge, EventTypeBadge } from '../components/StatusBadge';
import { TableSkeleton, btnPrimary, btnSecondary, inputClass } from '../components/ui';
import { useToast } from '../components/Toast';
import { PlusIcon } from '../components/icons';
import { formatDateTime } from '../lib/format';

const STATUS_OPTIONS: Array<{ value: '' | MaintenanceStatus; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'open', label: '未处理' },
  { value: 'resolved', label: '已处理' },
];

/** 设备运维：事件表格（筛选）+ 登记事件 + 处理关闭对话框 + 详情。 */
export default function MaintenancePage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'' | MaintenanceStatus>('');
  const [robotFilter, setRobotFilter] = useState<number | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<MaintenanceEvent | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const eventsResource = useResource(
    () =>
      getApiClient().then((api) =>
        api.listMaintenanceEvents({
          status: statusFilter === '' ? undefined : statusFilter,
          robot_id: robotFilter === '' ? undefined : robotFilter,
        }),
      ),
    [statusFilter, robotFilter],
  );

  const robotsResource = useResource(() => getApiClient().then((api) => api.listRobots()), []);
  const robots = robotsResource.data?.robots ?? [];
  const robotMap = useMemo(() => new Map(robots.map((robot: Robot) => [robot.id, robot])), [robots]);
  const sortedRobots = useMemo(
    () => [...robots].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)),
    [robots],
  );

  async function reload(message: string) {
    toast.push('success', message);
    setCreateOpen(false);
    setResolveTarget(null);
    await eventsResource.refresh({ silent: true });
  }

  const hasFilter = statusFilter !== '' || robotFilter !== '';

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '设备运维' }]}
        description="机器人故障与维护事件的登记、处理关闭与历史查询"
        actions={
          <div className="flex items-center gap-2.5">
            <RefreshControl
              refreshing={eventsResource.refreshing}
              onRefresh={() => void eventsResource.refresh({ silent: true })}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setCreateOpen(true)}
              disabled={robots.length === 0}
              title={robots.length === 0 ? '请先在组织管理中登记机器人' : undefined}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              登记运维事件
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-xs font-medium text-slate-600">
          状态
          <select
            className={`${inputClass} w-32`}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | MaintenanceStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          机器人
          <select
            className={`${inputClass} w-48`}
            value={robotFilter}
            onChange={(event) => setRobotFilter(event.target.value === '' ? '' : Number(event.target.value))}
          >
            <option value="">全部机器人</option>
            {sortedRobots.map((robot) => (
              <option key={robot.id} value={robot.id}>
                {robot.code} · {robot.name}
              </option>
            ))}
          </select>
        </label>
        {hasFilter ? (
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              setStatusFilter('');
              setRobotFilter('');
            }}
          >
            清除筛选
          </button>
        ) : null}
      </div>

      <ResourceView resource={eventsResource} skeleton={<TableSkeleton />}>
        {({ events }) =>
          events.length === 0 ? (
            hasFilter ? (
              <EmptyState title="暂无符合条件的运维事件" description="调整筛选条件，或清除筛选查看全部事件。" />
            ) : (
              <EmptyState
                title="暂无运维事件"
                description="为机器人登记故障或维护事件，处理后即可在此查询历史。"
                action={
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => setCreateOpen(true)}
                    disabled={robots.length === 0}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    登记第一条事件
                  </button>
                }
              />
            )
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">事件</th>
                    <th className="px-4 py-3 font-medium">机器人</th>
                    <th className="px-4 py-3 font-medium">类型</th>
                    <th className="px-4 py-3 font-medium">描述</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">登记时间</th>
                    <th className="px-4 py-3 font-medium">处理时间</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const robot = robotMap.get(event.robot_id);
                    return (
                      <tr key={event.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-500">#{event.id}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {robot ? (
                            <span title={`${robot.code} · ${robot.name}`}>
                              {robot.code} · {robot.name}
                            </span>
                          ) : (
                            `机器人 #${event.robot_id}`
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <EventTypeBadge type={event.type} />
                        </td>
                        <td className="max-w-[18rem] truncate px-4 py-3 text-slate-700" title={event.description}>
                          {event.description}
                        </td>
                        <td className="px-4 py-3">
                          <EventStatusBadge status={event.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500" title={event.created_at}>
                          {formatDateTime(event.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500" title={event.resolved_at ?? undefined}>
                          {formatDateTime(event.resolved_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {event.status === 'open' ? (
                              <button type="button" className={btnPrimary} onClick={() => setResolveTarget(event)}>
                                处理
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="text-xs font-medium text-slate-600 hover:text-blue-600"
                              onClick={() => setDetailId(event.id)}
                            >
                              详情
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </ResourceView>

      <EventFormDialog
        open={createOpen}
        robots={robots}
        onClose={() => setCreateOpen(false)}
        onSubmitted={async (event) => {
          const robot = robotMap.get(event.robot_id);
          await reload(`${event.type === 'fault' ? '故障' : '维护'}事件 #${event.id} 已登记${robot ? `（${robot.code}）` : ''}`);
        }}
      />
      <ResolveEventDialog
        open={resolveTarget !== null}
        event={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onSubmitted={async (event) => {
          await reload(`运维事件 #${event.id} 已处理并关闭`);
        }}
      />
      <EventDetailDialog open={detailId !== null} eventId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
