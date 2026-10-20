import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiClient } from '../api';
import type { Floor, Robot } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { FloorFormDialog } from '../components/dialogs/FloorFormDialog';
import { RobotFormDialog } from '../components/dialogs/RobotFormDialog';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RobotStatusBadge } from '../components/StatusBadge';
import { SkeletonBlock, btnPrimary, btnSecondary } from '../components/ui';
import { useToast } from '../components/Toast';
import { PlusIcon } from '../components/icons';
import { formatDateTime } from '../lib/format';

/** 楼层详情：楼层信息 + 机器人列表（登记机器人、下钻机器人详情）。 */
export default function FloorDetailPage() {
  const { mallId, floorId } = useParams();
  const mallIdNum = Number(mallId);
  const floorIdNum = Number(floorId);
  const toast = useToast();
  const resource = useResource(() => getApiClient().then((api) => api.getFloor(floorIdNum)), [floorIdNum]);
  const [createRobotOpen, setCreateRobotOpen] = useState(false);
  const [editFloorOpen, setEditFloorOpen] = useState(false);

  async function reload(message: string) {
    toast.push('success', message);
    setCreateRobotOpen(false);
    setEditFloorOpen(false);
    await resource.refresh({ silent: true });
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: '组织管理' },
          { label: '商场', to: '/malls' },
          { label: resource.data?.floor.mall.name ?? `#${mallIdNum}`, to: `/malls/${mallIdNum}` },
          { label: resource.data?.floor.name ?? `楼层 #${floorIdNum}` },
        ]}
        description="楼层信息与机器人管理（每台机器人归属唯一楼层）"
        actions={
          <div className="flex items-center gap-2.5">
            <button type="button" className={btnSecondary} onClick={() => setEditFloorOpen(true)}>
              编辑楼层
            </button>
            <button type="button" className={btnPrimary} onClick={() => setCreateRobotOpen(true)}>
              <PlusIcon className="h-3.5 w-3.5" />
              登记机器人
            </button>
          </div>
        }
      />
      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-72" />}>
        {({ floor }) => (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700">楼层信息</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">所属商场</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={floor.mall.name}>
                    {floor.mall.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">楼层名称</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={floor.name}>
                    {floor.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">机器人数</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{floor.robot_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">登记时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={floor.created_at}>
                    {formatDateTime(floor.created_at)}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">机器人（{floor.robots.length}）</h2>
              {floor.robots.length === 0 ? (
                <EmptyState
                  title="该楼层还没有机器人"
                  description="登记第一台清洁机器人后，即可在监控与任务调度中使用。"
                  action={
                    <button type="button" className={btnPrimary} onClick={() => setCreateRobotOpen(true)}>
                      <PlusIcon className="h-3.5 w-3.5" />
                      登记第一台机器人
                    </button>
                  }
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                        <th className="px-4 py-3 font-medium">名称</th>
                        <th className="px-4 py-3 font-medium">编号</th>
                        <th className="px-4 py-3 font-medium">状态</th>
                        <th className="px-4 py-3 font-medium">当前任务</th>
                        <th className="px-4 py-3 font-medium">登记时间</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {floor.robots.map((robot: Robot) => (
                        <tr key={robot.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <Link
                              to={`/robots/${robot.id}`}
                              className="max-w-[14rem] truncate font-medium text-blue-600 hover:text-blue-700"
                              title={robot.name}
                            >
                              {robot.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{robot.code}</td>
                          <td className="px-4 py-3">
                            <RobotStatusBadge status={robot.status} />
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {robot.current_task_id !== null ? (
                              <Link to={`/tasks/${robot.current_task_id}`} className="text-blue-600 hover:text-blue-700">
                                任务 #{robot.current_task_id}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500" title={robot.created_at}>
                            {formatDateTime(robot.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/robots/${robot.id}`}
                              className="text-xs font-medium text-slate-600 hover:text-blue-600"
                            >
                              详情
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </ResourceView>

      <FloorFormDialog
        open={editFloorOpen}
        mode="edit"
        floorId={floorIdNum}
        initialName={resource.data?.floor.name}
        onClose={() => setEditFloorOpen(false)}
        onSubmitted={async (floor: Floor) => {
          await reload(`楼层「${floor.name}」已更新`);
        }}
      />
      {resource.data ? (
        <RobotFormDialog
          open={createRobotOpen}
          mode="create"
          floors={[resource.data.floor]}
          onClose={() => setCreateRobotOpen(false)}
          onSubmitted={async (robot: Robot) => {
            await reload(`机器人 ${robot.code}「${robot.name}」已登记`);
          }}
        />
      ) : null}
    </div>
  );
}
