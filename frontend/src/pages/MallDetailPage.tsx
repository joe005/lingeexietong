import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getApiClient } from '../api';
import type { Floor, MallSummary } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { FloorFormDialog } from '../components/dialogs/FloorFormDialog';
import { MallFormDialog } from '../components/dialogs/MallFormDialog';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { SkeletonBlock, btnSecondary, btnPrimary } from '../components/ui';
import { useToast } from '../components/Toast';
import { PlusIcon, ChevronRightIcon } from '../components/icons';
import { formatDateTime } from '../lib/format';

/** 商场详情：商场信息 + 楼层列表（下钻至楼层详情）。 */
export default function MallDetailPage() {
  const { id } = useParams();
  const mallId = Number(id);
  const toast = useToast();
  const resource = useResource(() => getApiClient().then((api) => api.getMall(mallId)), [mallId]);
  const [createFloorOpen, setCreateFloorOpen] = useState(false);
  const [editMallOpen, setEditMallOpen] = useState(false);

  async function reload(message: string) {
    toast.push('success', message);
    setCreateFloorOpen(false);
    setEditMallOpen(false);
    await resource.refresh({ silent: true });
  }

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: '组织管理' },
          { label: '商场', to: '/malls' },
          { label: resource.data?.mall.name ?? `#${mallId}` },
        ]}
        description="商场信息与楼层管理"
        actions={
          <div className="flex items-center gap-2.5">
            <button type="button" className={btnSecondary} onClick={() => setEditMallOpen(true)}>
              编辑商场
            </button>
            <button type="button" className={btnPrimary} onClick={() => setCreateFloorOpen(true)}>
              <PlusIcon className="h-3.5 w-3.5" />
              创建楼层
            </button>
          </div>
        }
      />
      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-64" />}>
        {({ mall }) => (
          <div className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-700">商场信息</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <dt className="text-xs text-slate-500">商场名称</dt>
                  <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={mall.name}>
                    {mall.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">楼层数</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{mall.floor_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">机器人数</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{mall.robot_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">登记时间</dt>
                  <dd className="mt-1 text-sm text-slate-800" title={mall.created_at}>
                    {formatDateTime(mall.created_at)}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">楼层（{mall.floors.length}）</h2>
              {mall.floors.length === 0 ? (
                <EmptyState
                  title="该商场还没有楼层"
                  description="创建第一个楼层后，即可在楼层下登记清洁机器人。"
                  action={
                    <button type="button" className={btnPrimary} onClick={() => setCreateFloorOpen(true)}>
                      <PlusIcon className="h-3.5 w-3.5" />
                      创建第一个楼层
                    </button>
                  }
                />
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                        <th className="px-4 py-3 font-medium">楼层</th>
                        <th className="px-4 py-3 font-medium">机器人</th>
                        <th className="px-4 py-3 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mall.floors.map((floor) => (
                        <tr key={floor.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <Link
                              to={`/malls/${mall.id}/floors/${floor.id}`}
                              className="font-medium text-blue-600 hover:text-blue-700"
                            >
                              {floor.name}
                            </Link>
                            <span className="ml-2 text-xs text-slate-400">#{floor.id}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{floor.robot_count} 台</td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              to={`/malls/${mall.id}/floors/${floor.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-600"
                            >
                              进入楼层
                              <ChevronRightIcon className="h-3 w-3" />
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

      <MallFormDialog
        open={editMallOpen}
        mode="edit"
        mallId={mallId}
        initialName={resource.data?.mall.name}
        onClose={() => setEditMallOpen(false)}
        onSubmitted={async (mall: MallSummary) => {
          await reload(`商场「${mall.name}」已更新`);
        }}
      />
      <FloorFormDialog
        open={createFloorOpen}
        mode="create"
        mallId={mallId}
        onClose={() => setCreateFloorOpen(false)}
        onSubmitted={async (floor: Floor) => {
          await reload(`楼层「${floor.name}」已创建`);
        }}
      />
    </div>
  );
}
