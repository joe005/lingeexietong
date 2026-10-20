import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiClient, isApiRequestError } from '../api';
import type { Floor, MallSummary, Robot, Task, TaskStatus } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { TaskFormDialog } from '../components/dialogs/TaskFormDialog';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { Spinner, TableSkeleton, btnPrimary, btnSecondary } from '../components/ui';
import { TaskStatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { PlusIcon } from '../components/icons';
import { formatDateTime } from '../lib/format';
import { inputClass } from '../components/ui';

const POLL_INTERVAL_MS = 5000;

const STATUS_OPTIONS: Array<{ value: '' | TaskStatus; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待执行' },
  { value: 'executing', label: '执行中' },
  { value: 'completed', label: '已完成' },
];

/** 任务调度：筛选表格（5 秒轮询 + 手动刷新）+ 创建任务 + 下达。 */
export default function TasksPage() {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<'' | TaskStatus>('');
  const [mallFilter, setMallFilter] = useState<number | ''>('');
  const [floorFilter, setFloorFilter] = useState<number | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);

  const tasksResource = useResource(
    () =>
      getApiClient().then((api) =>
        api.listTasks({
          status: statusFilter === '' ? undefined : statusFilter,
          mall_id: mallFilter === '' ? undefined : mallFilter,
          floor_id: floorFilter === '' ? undefined : floorFilter,
        }),
      ),
    [statusFilter, mallFilter, floorFilter],
    { pollMs: POLL_INTERVAL_MS },
  );

  const metaResource = useResource(
    async () => {
      const api = await getApiClient();
      const [malls, floors, robots] = await Promise.all([api.listMalls(), api.listFloors(), api.listRobots()]);
      return { malls: malls.malls, floors: floors.floors, robots: robots.robots };
    },
    [],
  );

  const mallName = useMemo(() => new Map((metaResource.data?.malls ?? []).map((mall: MallSummary) => [mall.id, mall.name])), [metaResource.data]);
  const floorName = useMemo(() => new Map((metaResource.data?.floors ?? []).map((floor: Floor) => [floor.id, floor.name])), [metaResource.data]);
  const robotName = useMemo(() => new Map((metaResource.data?.robots ?? []).map((robot: Robot) => [robot.id, robot])), [metaResource.data]);

  const floorOptions = (metaResource.data?.floors ?? []).filter(
    (floor: Floor) => mallFilter === '' || floor.mall_id === mallFilter,
  );

  async function dispatchTask(task: Task) {
    setDispatchingId(task.id);
    try {
      const api = await getApiClient();
      const { task: dispatched } = await api.dispatchTask(task.id);
      toast.push('success', `任务 #${dispatched.id} 已下达并进入执行`);
      await tasksResource.refresh({ silent: true });
    } catch (error) {
      // 下达失败原因可读（如目标楼层无空闲机器人），任务保持待执行
      toast.push('error', isApiRequestError(error) ? error.message : '下达失败，请重试。');
      await tasksResource.refresh({ silent: true });
    } finally {
      setDispatchingId(null);
    }
  }

  async function handleCreated(task: Task) {
    toast.push(
      'success',
      task.robot_id !== null
        ? `任务 #${task.id} 已创建并分配机器人（待下达）`
        : `任务 #${task.id} 已创建，目标楼层暂无空闲机器人，保持待执行`,
    );
    setCreateOpen(false);
    await tasksResource.refresh({ silent: true });
  }

  const hasFilter = statusFilter !== '' || mallFilter !== '' || floorFilter !== '';

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '任务调度' }]}
        description="清洁任务的创建、下达与执行跟踪"
        actions={
          <div className="flex items-center gap-2.5">
            <RefreshControl
              refreshing={tasksResource.refreshing}
              onRefresh={() => void tasksResource.refresh({ silent: true })}
              pollSeconds={POLL_INTERVAL_MS / 1000}
            />
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setCreateOpen(true)}
              disabled={(metaResource.data?.floors.length ?? 0) === 0}
              title={(metaResource.data?.floors.length ?? 0) === 0 ? '请先在组织管理中创建楼层' : undefined}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              创建清洁任务
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
            onChange={(event) => {
              setStatusFilter(event.target.value as '' | TaskStatus);
              setFloorFilter('');
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          商场
          <select
            className={`${inputClass} w-40`}
            value={mallFilter}
            onChange={(event) => {
              setMallFilter(event.target.value === '' ? '' : Number(event.target.value));
              setFloorFilter('');
            }}
          >
            <option value="">全部商场</option>
            {(metaResource.data?.malls ?? []).map((mall: MallSummary) => (
              <option key={mall.id} value={mall.id}>
                {mall.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          楼层
          <select
            className={`${inputClass} w-40`}
            value={floorFilter}
            onChange={(event) => setFloorFilter(event.target.value === '' ? '' : Number(event.target.value))}
          >
            <option value="">全部楼层</option>
            {floorOptions.map((floor: Floor) => (
              <option key={floor.id} value={floor.id}>
                {mallName.get(floor.mall_id) ?? `商场 #${floor.mall_id}`} · {floor.name}
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
              setMallFilter('');
              setFloorFilter('');
            }}
          >
            清除筛选
          </button>
        ) : null}
      </div>

      <ResourceView resource={tasksResource} skeleton={<TableSkeleton />}>
        {({ tasks }) =>
          tasks.length === 0 ? (
            hasFilter ? (
              <EmptyState title="暂无符合条件的任务" description="调整筛选条件，或清除筛选后创建新任务。" />
            ) : (
              <EmptyState
                title="暂无清洁任务"
                description="创建并下达第一个清洁任务，系统将为目标楼层分配空闲机器人。"
                action={
                  <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
                    <PlusIcon className="h-3.5 w-3.5" />
                    创建第一个任务
                  </button>
                }
              />
            )
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">任务</th>
                    <th className="px-4 py-3 font-medium">目标楼层</th>
                    <th className="px-4 py-3 font-medium">机器人</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                    <th className="px-4 py-3 font-medium">下达时间</th>
                    <th className="px-4 py-3 font-medium">完成时间</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const robot = task.robot_id !== null ? robotName.get(task.robot_id) : undefined;
                    return (
                      <tr key={task.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <Link to={`/tasks/${task.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                            任务 #{task.id}
                          </Link>
                        </td>
                        <td className="max-w-[14rem] truncate px-4 py-3 text-slate-700" title={`${mallName.get(task.mall_id) ?? ''} · ${floorName.get(task.floor_id) ?? `楼层 #${task.floor_id}`}`}>
                          {mallName.get(task.mall_id) ?? `商场 #${task.mall_id}`} · {floorName.get(task.floor_id) ?? `楼层 #${task.floor_id}`}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {robot ? (
                            <Link to={`/robots/${robot.id}`} className="hover:text-blue-600" title={`${robot.code} · ${robot.name}`}>
                              {robot.code}
                            </Link>
                          ) : task.status === 'pending' ? (
                            <span className="text-slate-400">未分配</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <TaskStatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500" title={task.created_at}>
                          {formatDateTime(task.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500" title={task.dispatched_at ?? undefined}>
                          {formatDateTime(task.dispatched_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500" title={task.completed_at ?? undefined}>
                          {formatDateTime(task.completed_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {task.status === 'pending' ? (
                              <button
                                type="button"
                                className={btnPrimary}
                                onClick={() => void dispatchTask(task)}
                                disabled={dispatchingId !== null}
                              >
                                {dispatchingId === task.id ? <Spinner className="h-3.5 w-3.5" /> : null}
                                下达
                              </button>
                            ) : null}
                            <Link to={`/tasks/${task.id}`} className="text-xs font-medium text-slate-600 hover:text-blue-600">
                              详情
                            </Link>
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

      <TaskFormDialog
        open={createOpen}
        malls={metaResource.data?.malls ?? []}
        floors={metaResource.data?.floors ?? []}
        onClose={() => setCreateOpen(false)}
        onSubmitted={handleCreated}
      />
    </div>
  );
}
