import { describe, expect, it } from 'vitest';
import {
  EXCEPTION_WINDOWS,
  STATIONS,
  eventsUpTo,
  pausedMsAt,
  progressAt,
  snapshotAt,
  totalPauseMs,
} from '../src/simulator/simulator';
import type { ActiveExecution } from '../src/types';

const DURATION = 45_000;
const ZONE_AREA = 860;

function execution(startedAt = 0): ActiveExecution {
  return { planId: 'plan-1', robotId: 'R-01', startedAt, durationMs: DURATION };
}

describe('progressAt', () => {
  it('起点不计进度', () => {
    expect(progressAt(0, DURATION)).toBe(0);
  });

  it('随执行时间单调不减', () => {
    let previous = -1;
    for (let t = 0; t <= DURATION + totalPauseMs(DURATION) + 1000; t += 250) {
      const value = progressAt(t, DURATION);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('异常窗口内进度暂停', () => {
    const first = EXCEPTION_WINDOWS[0];
    const start = first.startFrac * DURATION;
    const end = first.endFrac * DURATION;
    const atStart = progressAt(start, DURATION);
    const midWindow = progressAt((start + end) / 2, DURATION);
    expect(midWindow).toBeCloseTo(atStart, 5);
  });

  it('含暂停的总时长后达到 100%', () => {
    const total = DURATION + totalPauseMs(DURATION);
    expect(progressAt(total, DURATION)).toBe(100);
    expect(progressAt(total + 5000, DURATION)).toBe(100);
  });
});

describe('pausedMsAt', () => {
  it('窗口结束后累计整段暂停', () => {
    const first = EXCEPTION_WINDOWS[0];
    const end = first.endFrac * DURATION;
    expect(pausedMsAt(end, DURATION)).toBeCloseTo((first.endFrac - first.startFrac) * DURATION, 5);
  });

  it('窗口内累计部分暂停', () => {
    const first = EXCEPTION_WINDOWS[0];
    const start = first.startFrac * DURATION;
    expect(pausedMsAt(start + 1000, DURATION)).toBeCloseTo(1000, 6);
  });
});

describe('snapshotAt', () => {
  it('已清洁面积随进度累计', () => {
    const snapshot = snapshotAt(execution(), ZONE_AREA, DURATION / 2);
    expect(snapshot.progressPct).toBeGreaterThan(0);
    expect(snapshot.cleanedAreaSqm).toBeCloseTo((ZONE_AREA * snapshot.progressPct) / 100, 1);
  });

  it('异常窗口内展示当前异常', () => {
    const first = EXCEPTION_WINDOWS[0];
    const start = first.startFrac * DURATION;
    const snapshot = snapshotAt(execution(), ZONE_AREA, start + 500);
    expect(snapshot.activeException?.kind).toBe(first.kind);
  });

  it('位置站点随推进变化且来自路线定义', () => {
    const stations = new Set<string>();
    for (let t = 0; t <= DURATION + totalPauseMs(DURATION); t += 1000) {
      stations.add(snapshotAt(execution(), ZONE_AREA, t).stationName);
    }
    expect(stations.size).toBeGreaterThan(1);
    for (const name of stations) {
      expect(STATIONS).toContain(name);
    }
  });

  it('结束后 finished 为 true、进度 100、面积等于区域面积', () => {
    const snapshot = snapshotAt(execution(), ZONE_AREA, DURATION + totalPauseMs(DURATION) + 1000);
    expect(snapshot.finished).toBe(true);
    expect(snapshot.progressPct).toBe(100);
    expect(snapshot.cleanedAreaSqm).toBe(ZONE_AREA);
  });
});

describe('eventsUpTo', () => {
  it('事件按时间排序且包含开始与完成', () => {
    const events = eventsUpTo(execution(), DURATION + totalPauseMs(DURATION) + 1000);
    const times = events.map((event) => event.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(events[0].kind).toBe('start');
    expect(events.some((event) => event.kind === 'complete')).toBe(true);
  });

  it('异常事件在执行窗口内出现', () => {
    const first = EXCEPTION_WINDOWS[0];
    const end = first.endFrac * DURATION;
    const events = eventsUpTo(execution(), end + 100);
    expect(events.some((event) => event.kind === 'exception-start' && event.message.includes(first.label))).toBe(true);
    expect(events.some((event) => event.kind === 'exception-end')).toBe(true);
  });
});
