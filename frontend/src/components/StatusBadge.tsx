/**
 * 状态徽章（全局复用组件）。
 *
 * 状态与类型 → 界面标签映射按契约约定（technical-contract.md）：
 * - 机器人：idle=空闲、executing=执行任务中、fault=异常；
 * - 任务：pending=待执行、executing=执行中、completed=已完成；
 * - 运维事件状态：open=未处理、resolved=已处理；类型：fault=故障、maintenance=维护。
 *
 * 状态色约定（architecture-baseline.md §3）：
 * 空闲=中性灰、执行任务中/执行中=主色蓝、待执行=琥珀、已完成/已处理=绿、异常/未处理=红。
 */
import type { MaintenanceStatus, MaintenanceType, RobotStatus, TaskStatus } from '../api/types';

const ROBOT_STATUS: Record<RobotStatus, { label: string; className: string }> = {
  idle: { label: '空闲', className: 'bg-slate-100 text-slate-600 ring-slate-300' },
  executing: { label: '执行任务中', className: 'bg-blue-50 text-blue-700 ring-blue-300' },
  fault: { label: '异常', className: 'bg-red-50 text-red-700 ring-red-300' },
};

const TASK_STATUS: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: '待执行', className: 'bg-amber-50 text-amber-700 ring-amber-300' },
  executing: { label: '执行中', className: 'bg-blue-50 text-blue-700 ring-blue-300' },
  completed: { label: '已完成', className: 'bg-emerald-50 text-emerald-700 ring-emerald-300' },
};

const EVENT_STATUS: Record<MaintenanceStatus, { label: string; className: string }> = {
  open: { label: '未处理', className: 'bg-red-50 text-red-700 ring-red-300' },
  resolved: { label: '已处理', className: 'bg-emerald-50 text-emerald-700 ring-emerald-300' },
};

const EVENT_TYPE: Record<MaintenanceType, { label: string; className: string }> = {
  fault: { label: '故障', className: 'bg-red-50 text-red-700 ring-red-300' },
  maintenance: { label: '维护', className: 'bg-slate-100 text-slate-600 ring-slate-300' },
};

function BadgePill({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

export function RobotStatusBadge({ status }: { status: RobotStatus }) {
  const def = ROBOT_STATUS[status];
  return <BadgePill label={def.label} className={def.className} />;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const def = TASK_STATUS[status];
  return <BadgePill label={def.label} className={def.className} />;
}

export function EventStatusBadge({ status }: { status: MaintenanceStatus }) {
  const def = EVENT_STATUS[status];
  return <BadgePill label={def.label} className={def.className} />;
}

export function EventTypeBadge({ type }: { type: MaintenanceType }) {
  const def = EVENT_TYPE[type];
  return <BadgePill label={def.label} className={def.className} />;
}
