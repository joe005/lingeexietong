import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiClient, isApiRequestError } from '../api';
import { useResource } from '../hooks/useResource';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { TaskStatusBadge } from '../components/StatusBadge';
import { SkeletonBlock, btnPrimary, btnSecondary } from '../components/ui';
import { useToast } from '../components/Toast';
import { Spinner } from '../components/ui';
import { formatDateTime } from '../lib/format';

/** 任务详情：目标楼层、分配机器人与状态跟踪；待执行任务可下达。 */
export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const toast = useToast();
  const resource = useResource(() => getApiClient().then((api) => api.getTask(taskId)), [taskId]);
  const [dispatching, setDispatching] = useState(false);

  async function dispatch() {
    setDispatching(true);
    try {
      const api = await getApiClient();
      const { task } = await api.dispatchTask(taskId);
      toast.push('success', `任务 #${task.id} 已下达并进入执行`);
      await resource.refresh({ silent: true });
    } catch (error) {
      toast.push('error', isApiRequestError(error) ? error.message : '下达失败，请重试。');
      await resource.refresh({ silent: true });
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '任务调度', to: '/tasks' }, { label: `任务 #${taskId}` }]}
        description="任务的目标楼层、分配机器人与执行状态"
        actions={
          <div className="flex items-center gap-2.5">
            <RefreshControl refreshing={resource.refreshing} onRefresh={() => void resource.refresh({ silent: true })} />
            {resource.data?.task.status === 'pending' ? (
              <button type="button" className={btnPrimary} onClick={() => void dispatch()} disabled={dispatching}>
                {dispatching ? <Spinner className="h-3.5 w-3.5" /> : null}
                下达任务
              </button>
            ) : null}
            <Link to="/tasks" className={btnSecondary}>
              返回任务列表
            </Link>
          </div>
        }
      />
      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-64" />}>
        {({ task }) => (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-800">任务 #{task.id}</h2>
                <TaskStatusBadge status={task.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">目标楼层</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={task.floor.name}>
                    {task.floor.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">分配机器人</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">
                    {task.robot ? (
                      <Link to={`/robots/${task.robot.id}`} className="text-blue-600 hover:text-blue-700" title={`${task.robot.code} · ${task.robot.name}`}>
                        {task.robot.code} · {task.robot.name}
                      </Link>
                    ) : task.status === 'pending' ? (
                      <span className="text-amber-600">未分配（待执行）</span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">创建时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={task.created_at}>
                    {formatDateTime(task.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">下达时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={task.dispatched_at ?? undefined}>
                    {formatDateTime(task.dispatched_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">完成时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={task.completed_at ?? undefined}>
                    {formatDateTime(task.completed_at)}
                  </dd>
                </div>
              </dl>
              {task.status === 'pending' ? (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                  任务待执行：下达后系统将按分配规则为目标楼层选取空闲机器人（编号升序首个）；无可分配机器人时将保持待执行并提示原因。
                </p>
              ) : null}
              {task.status === 'executing' ? (
                <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                  任务执行中：等待机器人上报完成。可在
                  <Link to="/robot-sim" className="mx-1 font-medium text-blue-700 underline">
                    机器人模拟控制台
                  </Link>
                  以机器人身份上报任务完成或故障。
                </p>
              ) : null}
              {task.status === 'completed' && task.robot ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
                  任务已完成，执行机器人为 {task.robot.code} · {task.robot.name}。
                </div>
              ) : null}
            </section>

            {task.robot ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-700">执行机器人</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <Link to={`/robots/${task.robot.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                    {task.robot.name}
                  </Link>
                  <span className="text-xs text-slate-500">{task.robot.code}</span>
                  <span className="text-xs text-slate-400">当前状态以监控页为准</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  提示：任务完成后机器人状态由上报通道驱动，可前往
                  <Link to="/monitor" className="mx-1 text-blue-600 hover:text-blue-700">
                    实时监控
                  </Link>
                  查看其当前状态。
                </p>
              </section>
            ) : null}
          </div>
        )}
      </ResourceView>
    </div>
  );
}
