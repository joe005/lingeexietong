import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiClient, isApiRequestError } from '../api';
import type { Floor, MallSummary, Robot } from '../api/types';
import { useResource } from '../hooks/useResource';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ResourceView } from '../components/ResourceView';
import { RefreshControl } from '../components/RefreshControl';
import { RobotStatusBadge } from '../components/StatusBadge';
import { SkeletonBlock, Spinner, btnDangerSoft, btnPrimary } from '../components/ui';
import { useToast } from '../components/Toast';
import { RadioIcon } from '../components/icons';

interface SimAction {
  key: 'report-fault' | 'report-recovery' | 'report-completion';
  label: string;
  className: string;
  /** 调用哪个上报端点（Robot Report API）。 */
  invoke: (robotId: number) => Promise<{ message: string }>;
}

const ACTIONS: SimAction[] = [
  {
    key: 'report-completion',
    label: '上报任务完成',
    className: btnPrimary,
    invoke: async (robotId) => {
      const api = await getApiClient();
      const { task, robot } = await api.reportRobotTaskCompletion(robotId);
      return { message: `${robot.code} 已上报任务完成：任务 #${task.id} 已完成` };
    },
  },
  {
    key: 'report-recovery',
    label: '上报恢复（空闲）',
    className: btnPrimary,
    invoke: async (robotId) => {
      const api = await getApiClient();
      const { robot } = await api.reportRobotStatus(robotId, { status: 'idle' });
      return { message: `${robot.code} 已上报恢复，当前空闲` };
    },
  },
  {
    key: 'report-fault',
    label: '上报故障',
    className: btnDangerSoft,
    invoke: async (robotId) => {
      const api = await getApiClient();
      const { robot } = await api.reportRobotStatus(robotId, { status: 'fault' });
      return { message: `${robot.code} 已上报故障，当前异常` };
    },
  },
];

/** 按机器人当前状态决定可用上报操作（只暴露合法转换，非法转换由服务端拒绝并提示）。 */
function availableActions(robot: Robot): SimAction[] {
  switch (robot.status) {
    case 'idle':
      return [ACTIONS.find((action) => action.key === 'report-fault')!];
    case 'executing':
      return [
        ACTIONS.find((action) => action.key === 'report-completion')!,
        ACTIONS.find((action) => action.key === 'report-fault')!,
      ];
    case 'fault':
      return [ACTIONS.find((action) => action.key === 'report-recovery')!];
  }
}

/**
 * 机器人模拟控制台（/robot-sim）：以机器人身份调用 Robot Report API，
 * 是机器人上报通道的演示与验收驱动面；写操作成功后立即重新拉取。
 */
export default function RobotSimPage() {
  const toast = useToast();
  const [pendingRobotId, setPendingRobotId] = useState<number | null>(null);

  const resource = useResource(
    async () => {
      const api = await getApiClient();
      const [malls, floors, robots] = await Promise.all([api.listMalls(), api.listFloors(), api.listRobots()]);
      return { malls: malls.malls as MallSummary[], floors: floors.floors as Floor[], robots: robots.robots as Robot[] };
    },
    [],
  );

  const mallName = new Map((resource.data?.malls ?? []).map((mall) => [mall.id, mall.name]));
  const floorName = new Map((resource.data?.floors ?? []).map((floor) => [floor.id, floor.name]));
  const sortedRobots = [...(resource.data?.robots ?? [])].sort((a, b) =>
    a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
  );

  async function runAction(robot: Robot, action: SimAction) {
    setPendingRobotId(robot.id);
    try {
      const { message } = await action.invoke(robot.id);
      toast.push('success', message);
      await resource.refresh({ silent: true });
    } catch (error) {
      toast.push('error', isApiRequestError(error) ? error.message : '上报失败，请重试。');
      await resource.refresh({ silent: true });
    } finally {
      setPendingRobotId(null);
    }
  }

  return (
    <div>
      <PageHeader
        crumbs={[{ label: '机器人模拟' }]}
        description="以机器人身份调用系统上报通道（状态上报 / 任务完成上报）"
        actions={
          <RefreshControl refreshing={resource.refreshing} onRefresh={() => void resource.refresh({ silent: true })} />
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/60 p-4">
        <RadioIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        <div className="min-w-0 text-xs leading-relaxed text-blue-800">
          <p className="font-medium">机器人通道 · 模拟驱动控制台</p>
          <p className="mt-1">
            当前以机器人身份模拟调用上报端点，用于演示与验收；真实机器人接入时仅替换调用方，
            端点语义与状态机不变，监控与任务界面无需改动。非法上报（如恢复空闲机器人、无执行中任务时上报完成）将被服务端拒绝并显示原因。
          </p>
        </div>
      </div>

      <ResourceView resource={resource} skeleton={<SkeletonBlock className="h-72" />}>
        {({ robots }) =>
          robots.length === 0 ? (
            <EmptyState
              title="暂无机器人可模拟"
              description="登记机器人后，即可在此模拟其状态上报与任务完成上报。"
              action={
                <Link to="/malls" className={btnPrimary}>
                  去组织管理登记机器人
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedRobots.map((robot) => {
                const actions = availableActions(robot);
                const busy = pendingRobotId === robot.id;
                return (
                  <section
                    key={robot.id}
                    className={`flex flex-col rounded-lg border bg-white p-4 ${
                      robot.status === 'fault'
                        ? 'border-red-300'
                        : robot.status === 'executing'
                          ? 'border-blue-300'
                          : 'border-slate-200'
                    }`}
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
                    <p className="mt-3 truncate text-xs text-slate-500" title={`${mallName.get(robot.mall_id) ?? ''} · ${floorName.get(robot.floor_id) ?? ''}`}>
                      {mallName.get(robot.mall_id) ?? `商场 #${robot.mall_id}`} · {floorName.get(robot.floor_id) ?? `楼层 #${robot.floor_id}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {robot.current_task_id !== null ? `执行任务 #${robot.current_task_id}` : '无执行中任务'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
                      {actions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          className={action.className}
                          onClick={() => void runAction(robot, action)}
                          disabled={busy}
                        >
                          {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
                          {action.label}
                        </button>
                      ))}
                      <Link to={`/robots/${robot.id}`} className="ml-auto text-xs font-medium text-slate-500 hover:text-blue-600">
                        详情
                      </Link>
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
