import { SEED_ROBOTS } from '../data/robots';
import { findZone } from '../data/zones';
import { storage } from '../lib/storage';
import { reportExceptionRecords, snapshotAt } from '../simulator/simulator';
import type { ActiveExecution, AppState, Plan, Report, Robot } from '../types';

const STORAGE_KEY = 'cleaning-robot-ops:v1';

/** 单次模拟执行的名义时长（毫秒）；异常窗口内进度暂停，实际完成略晚于该值。 */
export const EXECUTION_DURATION_MS = 45_000;

function seedState(): AppState {
  return {
    version: 1,
    plans: [],
    robots: SEED_ROBOTS.map((robot) => ({ ...robot })),
    executions: [],
    reports: [],
  };
}

function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AppState>;
  return (
    Array.isArray(candidate.plans) &&
    Array.isArray(candidate.robots) &&
    Array.isArray(candidate.executions) &&
    Array.isArray(candidate.reports)
  );
}

function persist(next: AppState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function loadState(): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isAppState(parsed)) return parsed;
      console.warn('运营数据格式无法识别，已重置为初始演示数据。');
    } catch {
      console.warn('运营数据读取失败，已重置为初始演示数据。');
    }
  }
  const seeded = seedState();
  persist(seeded);
  return seeded;
}

let state: AppState = loadState();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(next: AppState): void {
  state = next;
  persist(next);
  listeners.forEach((listener) => listener());
}

/** 仅供单元测试：清空并重新播种演示数据。 */
export function resetStoreForTests(): void {
  commit(seedState());
}

export interface CreatePlanInput {
  floor: string;
  zoneId: string;
  scheduledTime: string;
  cleaningMode: string;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPlan(input: CreatePlanInput): Plan {
  const zone = findZone(input.zoneId);
  if (!zone) throw new Error('区域不存在，请重新选择。');
  if (zone.floor !== input.floor) throw new Error('区域与楼层不匹配，请重新选择。');
  if (!input.scheduledTime) throw new Error('请设置作业时间。');
  const cleaningMode = input.cleaningMode.trim();
  if (!cleaningMode) throw new Error('请填写清洁模式。');
  const plan: Plan = {
    id: createId('plan'),
    floor: zone.floor,
    zoneId: zone.id,
    zoneName: zone.name,
    zoneAreaSqm: zone.areaSqm,
    scheduledTime: new Date(input.scheduledTime).toISOString(),
    cleaningMode,
    status: 'pending',
    robotId: null,
    createdAt: new Date().toISOString(),
  };
  commit({ ...state, plans: [plan, ...state.plans] });
  return plan;
}

export function busyRobotIds(): Set<string> {
  return new Set(state.executions.map((execution) => execution.robotId));
}

export function robotById(robotId: string): Robot | undefined {
  return state.robots.find((robot) => robot.id === robotId);
}

export function planById(planId: string): Plan | undefined {
  return state.plans.find((plan) => plan.id === planId);
}

export function executionFor(planId: string): ActiveExecution | undefined {
  return state.executions.find((execution) => execution.planId === planId);
}

export function reportForPlan(planId: string): Report | undefined {
  return state.reports.find((report) => report.planId === planId);
}

/** 分配机器人：计划进入执行状态，模拟执行随即开始，看板数据实时更新。 */
export function assignRobot(planId: string, robotId: string): ActiveExecution {
  const plan = planById(planId);
  if (!plan) throw new Error('计划不存在。');
  if (plan.status !== 'pending') throw new Error('只有待分配的计划可以分配机器人。');
  const robot = robotById(robotId);
  if (!robot) throw new Error('机器人不存在。');
  if (busyRobotIds().has(robotId)) throw new Error('该机器人正在执行其他任务，请选择其他机器人。');
  const execution: ActiveExecution = {
    planId,
    robotId,
    startedAt: Date.now(),
    durationMs: EXECUTION_DURATION_MS,
  };
  commit({
    ...state,
    plans: state.plans.map((item) => (item.id === planId ? { ...item, status: 'executing', robotId } : item)),
    executions: [...state.executions, execution],
  });
  return execution;
}

function buildReport(current: AppState, planId: string): Report | null {
  const execution = current.executions.find((item) => item.planId === planId);
  const plan = current.plans.find((item) => item.id === planId);
  if (!execution || !plan) return null;
  const robot = current.robots.find((item) => item.id === execution.robotId);
  const completedAt = new Date().toISOString();
  return {
    id: createId('report'),
    planId,
    robotId: execution.robotId,
    robotName: robot?.name ?? execution.robotId,
    floor: plan.floor,
    zoneName: plan.zoneName,
    zoneAreaSqm: plan.zoneAreaSqm,
    scheduledTime: plan.scheduledTime,
    cleaningMode: plan.cleaningMode,
    startedAt: new Date(execution.startedAt).toISOString(),
    completedAt,
    durationMs: Math.max(0, Date.now() - execution.startedAt),
    cleanedAreaSqm: plan.zoneAreaSqm,
    exceptions: reportExceptionRecords(execution.durationMs),
    createdAt: completedAt,
  };
}

function applyCompletion(current: AppState, planId: string, report: Report): AppState {
  return {
    ...current,
    plans: current.plans.map((item) => (item.id === planId ? { ...item, status: 'completed' } : item)),
    executions: current.executions.filter((item) => item.planId !== planId),
    reports: [report, ...current.reports.filter((item) => item.planId !== planId)],
  };
}

/** 手动结束某个执行（当前界面由自动完成驱动，保留该入口供测试与扩展使用）。 */
export function completeExecution(planId: string): Report {
  const report = buildReport(state, planId);
  if (!report) throw new Error('执行不存在。');
  commit(applyCompletion(state, planId, report));
  return report;
}

/** 定时检查：推进到 100% 的执行自动完成并生成作业报告。 */
export function refreshCompletions(now: number = Date.now()): Report[] {
  const finished = state.executions.filter((execution) => {
    const plan = state.plans.find((item) => item.id === execution.planId);
    return plan ? snapshotAt(execution, plan.zoneAreaSqm, now).finished : false;
  });
  if (finished.length === 0) return [];
  let next = state;
  const reports: Report[] = [];
  for (const execution of finished) {
    const report = buildReport(next, execution.planId);
    if (!report) continue;
    reports.push(report);
    next = applyCompletion(next, execution.planId, report);
  }
  commit(next);
  return reports;
}
