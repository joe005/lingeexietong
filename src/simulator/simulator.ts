import type { ActiveExecution, ReportExceptionRecord } from '../types';

/**
 * 前端模拟执行器：以纯函数按“执行起点 + 经过时间”推导实时数据。
 * 进度在异常窗口内暂停，位置/面积/异常状态均由进度推导，刷新页面后可无缝恢复。
 */

export interface ExceptionWindow {
  kind: string;
  label: string;
  detail: string;
  /** 窗口起点（占名义时长比例） */
  startFrac: number;
  /** 窗口终点（占名义时长比例） */
  endFrac: number;
}

/** 演示用异常节奏：执行中期出现两类可观察异常，处理期间进度暂停。 */
export const EXCEPTION_WINDOWS: ExceptionWindow[] = [
  {
    kind: 'obstacle',
    label: '障碍物绕行',
    detail: '检测到地面障碍物，机器人减速绕行',
    startFrac: 0.35,
    endFrac: 0.45,
  },
  {
    kind: 'bin-full',
    label: '垃圾箱清理',
    detail: '垃圾箱满载，机器人自动返回清空',
    startFrac: 0.7,
    endFrac: 0.78,
  },
];

/** 区域内的清洁路线站点，当前位置按进度推进。 */
export const STATIONS: string[] = ['入口', '北侧通道', '中央区域', '南侧通道', '出口'];

export type SimEventKind = 'start' | 'station' | 'exception-start' | 'exception-end' | 'complete';

export interface SimEvent {
  atMs: number;
  kind: SimEventKind;
  message: string;
}

export interface ExecutionSnapshot {
  planId: string;
  robotId: string;
  startedAt: number;
  elapsedMs: number;
  progressPct: number;
  zoneAreaSqm: number;
  cleanedAreaSqm: number;
  stationIndex: number;
  stationName: string;
  activeException: ExceptionWindow | null;
  finished: boolean;
  pausedMs: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 截至某时刻累计的异常暂停时长。 */
export function pausedMsAt(elapsedMs: number, durationMs: number): number {
  let paused = 0;
  for (const window of EXCEPTION_WINDOWS) {
    const start = window.startFrac * durationMs;
    const end = window.endFrac * durationMs;
    if (elapsedMs <= start) continue;
    paused += Math.min(elapsedMs, end) - start;
  }
  return paused;
}

/** 全部异常窗口的总暂停时长（执行完成所需名义时长）。 */
export function totalPauseMs(durationMs: number): number {
  return pausedMsAt(durationMs, durationMs);
}

/** 某时刻的任务进度（%）：异常窗口内暂停。 */
export function progressAt(elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0) return 0;
  const effective = elapsedMs - pausedMsAt(elapsedMs, durationMs);
  if (effective >= durationMs) return 100;
  return (effective / durationMs) * 100;
}

function stationIndexOf(progressPct: number): number {
  return Math.min(STATIONS.length - 1, Math.floor((progressPct / 100) * STATIONS.length));
}

/** 由“有效推进时长”反推名义时间（用于事件时间线）。 */
function nominalTimeForEffective(effectiveNeeded: number, durationMs: number): number {
  let nominal = effectiveNeeded;
  for (let i = 0; i < 8; i += 1) {
    nominal = effectiveNeeded + pausedMsAt(nominal, durationMs);
  }
  return nominal;
}

export function snapshotAt(execution: ActiveExecution, zoneAreaSqm: number, now: number): ExecutionSnapshot {
  const elapsedMs = Math.max(0, now - execution.startedAt);
  const durationMs = execution.durationMs;
  const progressPct = progressAt(elapsedMs, durationMs);
  const stationIndex = stationIndexOf(progressPct);
  const activeException =
    EXCEPTION_WINDOWS.find((window) => {
      const start = window.startFrac * durationMs;
      const end = window.endFrac * durationMs;
      return elapsedMs >= start && elapsedMs < end;
    }) ?? null;
  return {
    planId: execution.planId,
    robotId: execution.robotId,
    startedAt: execution.startedAt,
    elapsedMs,
    progressPct,
    zoneAreaSqm,
    cleanedAreaSqm: round1((zoneAreaSqm * progressPct) / 100),
    stationIndex,
    stationName: STATIONS[stationIndex],
    activeException,
    finished: progressPct >= 100,
    pausedMs: pausedMsAt(elapsedMs, durationMs),
  };
}

/** 截至某时刻应展示的执行事件（确定性推导，按时间排序）。 */
export function eventsUpTo(execution: ActiveExecution, elapsedMs: number): SimEvent[] {
  const durationMs = execution.durationMs;
  const events: SimEvent[] = [{ atMs: 0, kind: 'start', message: '任务开始执行' }];

  for (let i = 1; i < STATIONS.length; i += 1) {
    const atMs = nominalTimeForEffective((i / STATIONS.length) * durationMs, durationMs);
    if (atMs <= elapsedMs) {
      events.push({ atMs, kind: 'station', message: `进入${STATIONS[i]}` });
    }
  }

  for (const exceptionWindow of EXCEPTION_WINDOWS) {
    const start = exceptionWindow.startFrac * durationMs;
    const end = exceptionWindow.endFrac * durationMs;
    if (elapsedMs >= start) {
      events.push({
        atMs: start,
        kind: 'exception-start',
        message: `异常：${exceptionWindow.label}（${exceptionWindow.detail}）`,
      });
    }
    if (elapsedMs >= end) {
      events.push({ atMs: end, kind: 'exception-end', message: `异常解除：${exceptionWindow.label}已处理，恢复清洁` });
    }
  }

  if (progressAt(elapsedMs, durationMs) >= 100) {
    events.push({
      atMs: durationMs + totalPauseMs(durationMs),
      kind: 'complete',
      message: '任务完成，作业报告已生成',
    });
  }

  return events.sort((a, b) => a.atMs - b.atMs);
}

/** 报告中的异常记录：按异常窗口起点时间落档。 */
export function reportExceptionRecords(durationMs: number): ReportExceptionRecord[] {
  return EXCEPTION_WINDOWS.map((window) => ({
    atMs: Math.round(window.startFrac * durationMs),
    kind: window.kind,
    label: window.label,
    detail: window.detail,
  }));
}
