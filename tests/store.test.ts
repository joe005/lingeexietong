import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXECUTION_DURATION_MS,
  assignRobot,
  busyRobotIds,
  createPlan,
  executionFor,
  planById,
  refreshCompletions,
  reportForPlan,
  resetStoreForTests,
} from '../src/store/store';
import { storage } from '../src/lib/storage';
import { findZone } from '../src/data/zones';
import { SEED_ROBOTS } from '../src/data/robots';

const STORAGE_KEY = 'cleaning-robot-ops:v1';
const ZONE = findZone('1F-atrium')!;

function readPersistedState(): {
  plans: Record<string, unknown>[];
  robots: { id: string }[];
  reports: Record<string, unknown>[];
} {
  const raw = storage.getItem(STORAGE_KEY);
  expect(raw).toBeTruthy();
  return JSON.parse(raw as string);
}

beforeEach(() => {
  resetStoreForTests();
});

describe('初始数据', () => {
  it('内置可供分配的机器人清单', () => {
    expect(busyRobotIds().size).toBe(0);
    const persisted = readPersistedState();
    expect(persisted.robots.map((robot) => robot.id)).toEqual(SEED_ROBOTS.map((robot) => robot.id));
  });
});

describe('创建清洁计划（AC-01）', () => {
  it('创建后字段与输入一致并可持久化读回', () => {
    const scheduled = '2026-10-20T22:00';
    const plan = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: scheduled,
      cleaningMode: ' 深度清洁 ',
    });

    expect(plan.floor).toBe('1F');
    expect(plan.zoneName).toBe(ZONE.name);
    expect(plan.cleaningMode).toBe('深度清洁');
    expect(plan.status).toBe('pending');
    expect(plan.robotId).toBeNull();

    const persisted = readPersistedState();
    const stored = persisted.plans.find((item) => item.id === plan.id);
    expect(stored).toBeDefined();
    expect(stored!.floor).toBe('1F');
    expect(stored!.zoneName).toBe(ZONE.name);
    expect(stored!.cleaningMode).toBe('深度清洁');
    expect(new Date(stored!.scheduledTime as string).toISOString()).toBe(new Date(scheduled).toISOString());
  });

  it('区域与楼层不匹配时拒绝创建', () => {
    expect(() =>
      createPlan({ floor: '2F', zoneId: ZONE.id, scheduledTime: '2026-10-20T22:00', cleaningMode: '标准清洁' }),
    ).toThrow();
  });

  it('清洁模式为空时拒绝创建', () => {
    expect(() =>
      createPlan({ floor: '1F', zoneId: ZONE.id, scheduledTime: '2026-10-20T22:00', cleaningMode: '   ' }),
    ).toThrow();
  });
});

describe('分配机器人（AC-02）', () => {
  it('分配后计划进入执行状态并可读回关联', () => {
    const plan = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: '2026-10-20T22:00',
      cleaningMode: '深度清洁',
    });
    const robot = SEED_ROBOTS[0];
    const execution = assignRobot(plan.id, robot.id);

    expect(execution.planId).toBe(plan.id);
    expect(execution.robotId).toBe(robot.id);
    expect(planById(plan.id)?.status).toBe('executing');
    expect(planById(plan.id)?.robotId).toBe(robot.id);
    expect(busyRobotIds().has(robot.id)).toBe(true);

    const persisted = readPersistedState();
    const stored = persisted.plans.find((item) => item.id === plan.id);
    expect(stored!.status).toBe('executing');
    expect(stored!.robotId).toBe(robot.id);
    expect(executionFor(plan.id)?.robotId).toBe(robot.id);
  });

  it('执行中的机器人不能再次分配', () => {
    const planA = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: '2026-10-20T22:00',
      cleaningMode: '深度清洁',
    });
    const planB = createPlan({
      floor: '1F',
      zoneId: '1F-corridor',
      scheduledTime: '2026-10-20T23:00',
      cleaningMode: '标准清洁',
    });
    assignRobot(planA.id, SEED_ROBOTS[0].id);
    expect(() => assignRobot(planB.id, SEED_ROBOTS[0].id)).toThrow();
  });

  it('非待分配计划不能重复分配', () => {
    const plan = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: '2026-10-20T22:00',
      cleaningMode: '深度清洁',
    });
    assignRobot(plan.id, SEED_ROBOTS[0].id);
    expect(() => assignRobot(plan.id, SEED_ROBOTS[1].id)).toThrow();
  });
});

describe('完成并生成作业报告（AC-04）', () => {
  it('执行结束后生成含可观察结果的报告', () => {
    const plan = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: '2026-10-20T22:00',
      cleaningMode: '深度清洁',
    });
    const robot = SEED_ROBOTS[1];
    assignRobot(plan.id, robot.id);

    const reports = refreshCompletions(Date.now() + EXECUTION_DURATION_MS + 10_000);
    expect(reports).toHaveLength(1);

    const report = reportForPlan(plan.id);
    expect(report).toBeDefined();
    expect(report!.robotName).toBe(robot.name);
    expect(report!.floor).toBe('1F');
    expect(report!.zoneName).toBe(ZONE.name);
    expect(report!.cleanedAreaSqm).toBe(ZONE.areaSqm);
    expect(report!.exceptions.length).toBeGreaterThan(0);
    expect(planById(plan.id)?.status).toBe('completed');
    expect(executionFor(plan.id)).toBeUndefined();

    const persisted = readPersistedState();
    const stored = persisted.reports.find((item) => item.planId === plan.id);
    expect(stored).toBeDefined();
    expect(stored!.cleanedAreaSqm).toBe(ZONE.areaSqm);
  });

  it('执行未结束时不会生成报告', () => {
    const plan = createPlan({
      floor: '1F',
      zoneId: ZONE.id,
      scheduledTime: '2026-10-20T22:00',
      cleaningMode: '深度清洁',
    });
    assignRobot(plan.id, SEED_ROBOTS[0].id);
    const reports = refreshCompletions(Date.now() + 1000);
    expect(reports).toHaveLength(0);
    expect(reportForPlan(plan.id)).toBeUndefined();
  });
});
