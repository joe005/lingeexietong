import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { getApiClient } from '../api';
import type { MallSummary } from '../api/types';
import { MallFormDialog } from '../components/dialogs/MallFormDialog';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { CardSkeletonGrid, btnPrimary } from '../components/ui';
import { useToast } from '../components/Toast';
import { PlusIcon } from '../components/icons';
import { formatDateTime } from '../lib/format';

function MallCard({ mall }: { mall: MallSummary }) {
  return (
    <Link
      to={`/malls/${mall.id}`}
      className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition hover:border-blue-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-base font-semibold text-slate-800 group-hover:text-blue-700" title={mall.name}>
          {mall.name}
        </h3>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-400">#{mall.id}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-50 px-3 py-2 text-center">
          <dt className="text-[11px] text-slate-500">楼层</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-800">{mall.floor_count}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-center">
          <dt className="text-[11px] text-slate-500">机器人</dt>
          <dd className="mt-0.5 text-lg font-semibold text-slate-800">{mall.robot_count}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <time className="text-xs text-slate-400" title={mall.created_at}>
          登记于 {formatDateTime(mall.created_at)}
        </time>
        <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700">进入商场 →</span>
      </div>
    </Link>
  );
}

/** 组织管理首页：商场列表（下钻入口）+ 创建商场。 */
export default function MallsPage() {
  const toast = useToast();
  const resource = useResource(() => getApiClient().then((api) => api.listMalls()), []);
  const [createOpen, setCreateOpen] = useState(false);

  async function handleCreated(mall: MallSummary) {
    toast.push('success', `商场「${mall.name}」已创建`);
    setCreateOpen(false);
    await resource.refresh({ silent: true });
  }

  const openCreate = () => setCreateOpen(true);

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '组织管理' }, { label: '商场' }]}
        description="按 商场 → 楼层 → 机器人 层级登记与浏览全部运营对象"
        actions={
          <button type="button" className={btnPrimary} onClick={openCreate}>
            <PlusIcon className="h-3.5 w-3.5" />
            创建商场
          </button>
        }
      />
      <ResourceView resource={resource} skeleton={<CardSkeletonGrid count={6} />}>
        {({ malls }) =>
          malls.length === 0 ? (
            <EmptyState
              title="还没有商场"
              description="创建第一个商场，开始搭建 商场 → 楼层 → 机器人 的层级组织。"
              action={
                <button type="button" className={btnPrimary} onClick={openCreate}>
                  <PlusIcon className="h-3.5 w-3.5" />
                  创建第一个商场
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {malls.map((mall) => (
                <MallCard key={mall.id} mall={mall} />
              ))}
            </div>
          )
        }
      </ResourceView>
      <MallFormDialog open={createOpen} mode="create" onClose={() => setCreateOpen(false)} onSubmitted={handleCreated} />
    </div>
  );
}
