/**
 * 契约类型定义。
 *
 * 字段命名与形状严格对齐 docs/wi-t1000006/technical-contract.md：
 * - snake_case 字段原样消费，前端不做任何字段转换；
 * - 派生字段（floor_count / robot_count / mall_id / current_task_id / 统计聚合）
 *   由服务端计算并随响应返回，前端只读；
 * - 状态与类型 → 界面标签的映射由前端承担（见 components/StatusBadge.tsx）。
 */

export type RobotStatus = 'idle' | 'executing' | 'fault';
export type TaskStatus = 'pending' | 'executing' | 'completed';
export type MaintenanceType = 'fault' | 'maintenance';
export type MaintenanceStatus = 'open' | 'resolved';
/** Robot Report API 状态上报允许的值（区别于机器人全量状态枚举）。 */
export type RobotReportStatus = 'fault' | 'idle';

export interface MallSummary {
  id: number;
  name: string;
  floor_count: number;
  robot_count: number;
  created_at: string;
}

export interface MallFloorBrief {
  id: number;
  name: string;
  robot_count: number;
}

export interface MallDetail extends MallSummary {
  floors: MallFloorBrief[];
}

export interface Floor {
  id: number;
  mall_id: number;
  name: string;
  robot_count: number;
  created_at: string;
}

export interface FloorDetail extends Floor {
  mall: { id: number; name: string };
  robots: Robot[];
}

export interface Robot {
  id: number;
  floor_id: number;
  mall_id: number;
  name: string;
  code: string;
  status: RobotStatus;
  current_task_id: number | null;
  created_at: string;
}

export interface RobotDetail extends Robot {
  floor: { id: number; name: string };
  mall: { id: number; name: string };
  current_task: Task | null;
}

export interface Task {
  id: number;
  floor_id: number;
  mall_id: number;
  robot_id: number | null;
  status: TaskStatus;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface TaskDetail extends Task {
  floor: { id: number; name: string };
  robot: { id: number; name: string; code: string } | null;
}

export interface MaintenanceEvent {
  id: number;
  robot_id: number;
  type: MaintenanceType;
  description: string;
  status: MaintenanceStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MaintenanceEventDetail extends MaintenanceEvent {
  robot: { id: number; name: string; code: string };
}

export interface StatsTotals {
  malls: number;
  floors: number;
  robots: number;
  robots_idle: number;
  robots_executing: number;
  robots_fault: number;
  tasks: number;
  tasks_pending: number;
  tasks_executing: number;
  tasks_completed: number;
  maintenance: number;
  maintenance_open: number;
  maintenance_resolved: number;
}

export interface StatsByMall {
  mall_id: number;
  mall_name: string;
  floors: number;
  robots: number;
  robots_fault: number;
  tasks: number;
  tasks_completed: number;
  maintenance_open: number;
}

export interface Stats {
  totals: StatsTotals;
  by_mall: StatsByMall[];
}

/** 错误响应体：{"error":{"code","message","fields?"}}，fields 仅校验错误时出现。 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface CreateMallBody {
  name: string;
}
export interface UpdateMallBody {
  name?: string;
}
export interface FloorFilter {
  mall_id?: number;
}
export interface CreateFloorBody {
  mall_id: number;
  name: string;
}
export interface UpdateFloorBody {
  name?: string;
}
export interface RobotFilter {
  mall_id?: number;
  floor_id?: number;
  status?: RobotStatus;
}
export interface CreateRobotBody {
  floor_id: number;
  name: string;
  code: string;
}
export interface UpdateRobotBody {
  name?: string;
  floor_id?: number;
}
export interface TaskFilter {
  status?: TaskStatus;
  floor_id?: number;
  mall_id?: number;
}
export interface CreateTaskBody {
  floor_id: number;
}
export interface ReportRobotStatusBody {
  status: RobotReportStatus;
}
export interface MaintenanceEventFilter {
  robot_id?: number;
  status?: MaintenanceStatus;
}
export interface CreateMaintenanceEventBody {
  robot_id: number;
  type: MaintenanceType;
  description: string;
}
export interface ResolveMaintenanceEventBody {
  resolution: string;
}
