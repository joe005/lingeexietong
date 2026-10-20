/**
 * Mock 通道存储与种子数据（集中管理，不散落在页面组件）。
 *
 * 仅用于不依赖后端进程的页面数据流验证与开发期 `npm run dev:mock`。
 * 存储行为（状态机、错误码、派生字段）由 mocks.ts 按契约实现；
 * 本文件只定义存储结构与初始记录。
 */
import type { MaintenanceType, RobotStatus, TaskStatus } from './types';

export interface MallRow {
  id: number;
  name: string;
  created_at: string;
}

export interface FloorRow {
  id: number;
  mall_id: number;
  name: string;
  created_at: string;
}

export interface RobotRow {
  id: number;
  floor_id: number;
  name: string;
  code: string;
  status: RobotStatus;
  created_at: string;
}

export interface TaskRow {
  id: number;
  floor_id: number;
  robot_id: number | null;
  status: TaskStatus;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface EventRow {
  id: number;
  robot_id: number;
  type: MaintenanceType;
  description: string;
  status: 'open' | 'resolved';
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MockStore {
  malls: MallRow[];
  floors: FloorRow[];
  robots: RobotRow[];
  tasks: TaskRow[];
  events: EventRow[];
  seq: { mall: number; floor: number; robot: number; task: number; event: number };
}

export function createEmptyStore(): MockStore {
  return {
    malls: [],
    floors: [],
    robots: [],
    tasks: [],
    events: [],
    seq: { mall: 0, floor: 0, robot: 0, task: 0, event: 0 },
  };
}

/**
 * 标准种子：覆盖多商场/多楼层/多机器人、三种机器人状态、三种任务状态、
 * 两种运维事件状态，用于监控页/任务页/运维页/分析页/模拟控制台的数据流验证。
 */
export function createStandardSeed(): MockStore {
  return {
    malls: [
      { id: 1, name: '星云广场', created_at: '2026-10-18T02:00:00.000Z' },
      { id: 2, name: '澜庭荟', created_at: '2026-10-19T03:30:00.000Z' },
    ],
    floors: [
      { id: 1, mall_id: 1, name: '首层 F1', created_at: '2026-10-18T02:10:00.000Z' },
      { id: 2, mall_id: 1, name: '地下一层 B1', created_at: '2026-10-18T02:20:00.000Z' },
      { id: 3, mall_id: 2, name: '首层 F1', created_at: '2026-10-19T03:40:00.000Z' },
    ],
    robots: [
      {
        id: 1,
        floor_id: 1,
        name: '一号清洁机器人',
        code: 'CB-001',
        status: 'idle',
        created_at: '2026-10-18T02:30:00.000Z',
      },
      {
        id: 2,
        floor_id: 1,
        name: '二号清洁机器人',
        code: 'CB-002',
        status: 'idle',
        created_at: '2026-10-18T02:35:00.000Z',
      },
      {
        id: 3,
        floor_id: 2,
        name: '三号清洁机器人',
        code: 'CB-003',
        status: 'executing',
        created_at: '2026-10-18T02:40:00.000Z',
      },
      {
        id: 4,
        floor_id: 3,
        name: '四号清洁机器人',
        code: 'CB-004',
        status: 'fault',
        created_at: '2026-10-19T04:00:00.000Z',
      },
    ],
    tasks: [
      {
        id: 1,
        floor_id: 1,
        robot_id: 1,
        status: 'completed',
        created_at: '2026-10-18T08:00:00.000Z',
        dispatched_at: '2026-10-18T08:05:00.000Z',
        completed_at: '2026-10-18T09:30:00.000Z',
      },
      {
        id: 2,
        floor_id: 2,
        robot_id: 3,
        status: 'executing',
        created_at: '2026-10-20T06:00:00.000Z',
        dispatched_at: '2026-10-20T06:02:00.000Z',
        completed_at: null,
      },
      {
        // 楼层 3 仅有 CB-004（异常），无可分配空闲机器人 → 保持待执行未分配
        id: 3,
        floor_id: 3,
        robot_id: null,
        status: 'pending',
        created_at: '2026-10-20T06:30:00.000Z',
        dispatched_at: null,
        completed_at: null,
      },
      {
        id: 4,
        floor_id: 3,
        robot_id: 4,
        status: 'completed',
        created_at: '2026-10-19T05:00:00.000Z',
        dispatched_at: '2026-10-19T05:05:00.000Z',
        completed_at: '2026-10-19T06:40:00.000Z',
      },
    ],
    events: [
      {
        id: 1,
        robot_id: 4,
        type: 'fault',
        description: '驱动轮电机异响，疑似卡阻，已停止作业',
        status: 'open',
        resolution: null,
        created_at: '2026-10-19T04:10:00.000Z',
        resolved_at: null,
      },
      {
        id: 2,
        robot_id: 1,
        type: 'maintenance',
        description: '例行尘盒清理与滤网更换',
        status: 'resolved',
        resolution: '已完成尘盒清理与滤网更换，恢复运行',
        created_at: '2026-10-17T09:00:00.000Z',
        resolved_at: '2026-10-17T10:20:00.000Z',
      },
    ],
    seq: { mall: 2, floor: 3, robot: 4, task: 4, event: 2 },
  };
}
