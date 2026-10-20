/** 运营看板核心数据模型：清洁计划、机器人、执行与作业报告。 */

export interface Robot {
  id: string;
  name: string;
  model: string;
  batteryPct: number;
}

export interface Zone {
  id: string;
  floor: string;
  name: string;
  /** 区域清洁面积（㎡），用于统计已清洁面积 */
  areaSqm: number;
}

export type PlanStatus = 'pending' | 'executing' | 'completed';

export interface Plan {
  id: string;
  floor: string;
  zoneId: string;
  zoneName: string;
  zoneAreaSqm: number;
  /** ISO 时间串 */
  scheduledTime: string;
  cleaningMode: string;
  status: PlanStatus;
  robotId: string | null;
  /** ISO 时间串 */
  createdAt: string;
}

export interface ActiveExecution {
  planId: string;
  robotId: string;
  /** epoch ms，执行起点；刷新页面后按此恢复模拟进度 */
  startedAt: number;
  /** 名义执行时长（不含异常暂停） */
  durationMs: number;
}

export interface ReportExceptionRecord {
  atMs: number;
  kind: string;
  label: string;
  detail: string;
}

export interface Report {
  id: string;
  planId: string;
  robotId: string;
  robotName: string;
  floor: string;
  zoneName: string;
  zoneAreaSqm: number;
  scheduledTime: string;
  cleaningMode: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  /** 完成时已清洁面积，等于区域总面积 */
  cleanedAreaSqm: number;
  exceptions: ReportExceptionRecord[];
  createdAt: string;
}

export interface AppState {
  version: number;
  plans: Plan[];
  robots: Robot[];
  /** 仅保存执行中的任务；完成后移入 reports */
  executions: ActiveExecution[];
  reports: Report[];
}
