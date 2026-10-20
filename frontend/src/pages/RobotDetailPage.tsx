import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiClient } from '../api';
import { useResource } from '../hooks/useResource';
import { RobotFormDialog } from '../components/dialogs/RobotFormDialog';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { RobotStatusBadge, TaskStatusBadge } from '../components/StatusBadge';
import { SkeletonBlock, btnSecondary } from '../components/ui';
import { useToast } from '../components/Toast';
import { formatDateTime } from '../lib/format';

/** 机器人详情：基本信息、归属层级、当前任务；支持名称与楼层归属调整。 */
export default function RobotDetailPage() {
  const { id } = useParams();
  const robotId = Number(id);
  const toast = useToast();
  const resource = useResource(
    async () => {
      const api = await getApiClient();
      const [{ robot }, { floors }] = await Promise.all([api.getRobot(robotId), api.listFloors()]);
      return { robot, floors };
    },
    [robotId],
  );
  const [editOpen, setEditOpen] = useState(false);

  async function reload(message: string) {
    toast.push('success', message);
    setEditOpen(false);
    await resource.refresh({ silent: true });
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: '组织管理' },
          { label: '商场', to: '/malls' },
          {
            label: resource.data?.robot.mall.name ?? `商场 #${resource.data?.robot.mall_id ?? ''}`,
            to: `/malls/${resource.data?.robot.mall_id ?? ''}`,
          },
          {
            label: resource.data?.robot.floor.name ?? `楼层 #${resource.data?.robot.floor_id ?? ''}`,
            to: `/malls/${resource.data?.robot.mall_id ?? ''}/floors/${resource.data?.robot.floor_id ?? ''}`,
          },
          { label: resource.data?.robot.name ?? `机器人 #${robotId}` },
        ]}
        description="机器人基本信息与归属（编号创建后不可修改）"
        actions={
          <div className="flex items-center gap-2.5">
            <RefreshControl refreshing={resource.refreshing} onRefresh={() => void resource.refresh({ silent: true })} />
            <button type="button" className={btnSecondary} onClick={() => setEditOpen(true)}>
              编辑机器人
            </button>
          </div>
        }
      />
      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-72" />}>
        {({ robot }) => (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="truncate text-base font-semibold text-slate-800" title={robot.name}>
                    {robot.name}
                  </h2>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{robot.code}</span>
                </div>
                <RobotStatusBadge status={robot.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">所属商场</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={robot.mall.name}>
                    <Link to={`/malls/${robot.mall_id}`} className="text-blue-600 hover:text-blue-700">
                      {robot.mall.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">所属楼层</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={robot.floor.name}>
                    <Link to={`/malls/${robot.mall_id}/floors/${robot.floor_id}`} className="text-blue-600 hover:text-blue-700">
                      {robot.floor.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">编号</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{robot.code}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">登记时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={robot.created_at}>
                    {formatDateTime(robot.created_at)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700">当前任务</h2>
              {robot.current_task ? (
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to={`/tasks/${robot.current_task.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    任务 #{robot.current_task.id}
                  </Link>
                  <TaskStatusBadge status={robot.current_task.status} />
                  <span className="text-xs text-slate-500" title={robot.current_task.created_at}>
                    创建于 {formatDateTime(robot.current_task.created_at)}
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">当前没有执行中的任务。</p>
              )}
            </section>
          </div>
        )}
      </ResourceView>

      {resource.data ? (
        <RobotFormDialog
          open={editOpen}
          mode="edit"
          robot={resource.data.robot}
          floors={resource.data.floors}
          onClose={() => setEditOpen(false)}
          onSubmitted={async (robot) => {
            await reload(`机器人 ${robot.code} 信息已更新`);
          }}
        />
      ) : null}
    </div>
  );
}
