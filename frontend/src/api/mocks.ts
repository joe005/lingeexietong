/**
 * Mock 通道：按技术契约语义实现的内存版 ApiClient。
 *
 * - 状态机与事务语义对齐 docs/wi-t1000006/architecture-baseline.md §2：
 *   机器人 idle/executing/fault、任务 pending/executing/completed、
 *   运维事件 open/resolved，跨对象状态流转在单个方法内同步完成（原子语义）；
 * - 错误码、HTTP 状态与错误结构对齐 docs/wi-t1000006/technical-contract.md；
 * - 派生字段（计数、mall_id、current_task_id、统计聚合）与真实后端一致，
 *   由本通道在读取时实时计算。
 *
 * 仅用于页面数据流的独立验证（不依赖后端进程）与 dev:mock 演示；
 * 生产构建通过 vite define（__USE_MOCK__=false）静态剔除，不会进入产物。
 */
import { ApiRequestError } from './client';
import type { ApiClient } from './client';
import {
  createEmptyStore,
  createStandardSeed,
  type EventRow,
  type FloorRow,
  type MallRow,
  type MockStore,
  type RobotRow,
  type TaskRow,
} from './mock-data';
import type {
  MaintenanceEvent,
  MaintenanceEventDetail,
  MaintenanceType,
  Robot,
  RobotDetail,
  Stats,
  StatsByMall,
  Task,
  TaskDetail,
} from './types';

export interface MockClientOptions {
  /** 模拟网络延迟（毫秒）；测试传 0 即时返回。 */
  latencyMs?: number;
  /** 'standard'=标准种子；'empty'=空库；或直接传入存储。 */
  seed?: 'standard' | 'empty' | MockStore;
}

export type MockClient = ApiClient & { __store: MockStore };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function nowIso(): string {
  return new Date().toISOString();
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new ApiRequestError(400, 'VALIDATION_ERROR', '字段校验失败，请检查输入内容。', {
      [field]: `必须为 1..${maxLength} 个字符`,
    });
  }
  return value;
}

function requireInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ApiRequestError(400, 'VALIDATION_ERROR', '字段校验失败，请检查输入内容。', {
      [field]: '必须为整数',
    });
  }
  return value;
}

function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiRequestError(400, 'VALIDATION_ERROR', '字段校验失败，请检查输入内容。', {
      [field]: `必须为 ${allowed.join(' / ')} 之一`,
    });
  }
  return value as T;
}

function notFound(what: string): ApiRequestError {
  return new ApiRequestError(404, 'NOT_FOUND', `${what}不存在`);
}

/** 契约分配规则：目标楼层内空闲机器人按 code 升序取首个。 */
function pickIdleRobot(store: MockStore, floorId: number): RobotRow | null {
  const candidates = store.robots
    .filter((robot) => robot.floor_id === floorId && robot.status === 'idle')
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return candidates[0] ?? null;
}

function findFloor(store: MockStore, id: number): FloorRow {
  const floor = store.floors.find((row) => row.id === id);
  if (!floor) throw notFound('楼层');
  return floor;
}

function findRobotRow(store: MockStore, id: number): RobotRow {
  const robot = store.robots.find((row) => row.id === id);
  if (!robot) throw notFound('机器人');
  return robot;
}

function findTaskRow(store: MockStore, id: number): TaskRow {
  const task = store.tasks.find((row) => row.id === id);
  if (!task) throw notFound('任务');
  return task;
}

function findEventRow(store: MockStore, id: number): EventRow {
  const event = store.events.find((row) => row.id === id);
  if (!event) throw notFound('运维事件');
  return event;
}

// ---- 行 → 契约对象映射（派生字段实时计算，与真实服务端一致） ----

function floorRobotCount(store: MockStore, floorId: number): number {
  return store.robots.filter((robot) => robot.floor_id === floorId).length;
}

function mallSummary(store: MockStore, mall: MallRow) {
  const floors = store.floors.filter((floor) => floor.mall_id === mall.id);
  const floorIds = new Set(floors.map((floor) => floor.id));
  const robotCount = store.robots.filter((robot) => floorIds.has(robot.floor_id)).length;
  return { id: mall.id, name: mall.name, floor_count: floors.length, robot_count: robotCount, created_at: mall.created_at };
}

function floorToApi(store: MockStore, floor: FloorRow) {
  return {
    id: floor.id,
    mall_id: floor.mall_id,
    name: floor.name,
    robot_count: floorRobotCount(store, floor.id),
    created_at: floor.created_at,
  };
}

function taskToApi(store: MockStore, task: TaskRow): Task {
  const floor = store.floors.find((row) => row.id === task.floor_id);
  return {
    id: task.id,
    floor_id: task.floor_id,
    mall_id: floor ? floor.mall_id : -1,
    robot_id: task.robot_id,
    status: task.status,
    created_at: task.created_at,
    dispatched_at: task.dispatched_at,
    completed_at: task.completed_at,
  };
}

function executingTaskOf(store: MockStore, robotId: number): TaskRow | null {
  return store.tasks.find((task) => task.robot_id === robotId && task.status === 'executing') ?? null;
}

function robotToApi(store: MockStore, robot: RobotRow): Robot {
  const floor = store.floors.find((row) => row.id === robot.floor_id);
  const executing = executingTaskOf(store, robot.id);
  return {
    id: robot.id,
    floor_id: robot.floor_id,
    mall_id: floor ? floor.mall_id : -1,
    name: robot.name,
    code: robot.code,
    status: robot.status,
    current_task_id: executing ? executing.id : null,
    created_at: robot.created_at,
  };
}

function eventToApi(event: EventRow): MaintenanceEvent {
  return {
    id: event.id,
    robot_id: event.robot_id,
    type: event.type,
    description: event.description,
    status: event.status,
    resolution: event.resolution,
    created_at: event.created_at,
    resolved_at: event.resolved_at,
  };
}

function computeStats(store: MockStore): Stats {
  const countBy = <T>(items: T[], predicate: (item: T) => boolean) => items.filter(predicate).length;

  const totals = {
    malls: store.malls.length,
    floors: store.floors.length,
    robots: store.robots.length,
    robots_idle: countBy(store.robots, (robot) => robot.status === 'idle'),
    robots_executing: countBy(store.robots, (robot) => robot.status === 'executing'),
    robots_fault: countBy(store.robots, (robot) => robot.status === 'fault'),
    tasks: store.tasks.length,
    tasks_pending: countBy(store.tasks, (task) => task.status === 'pending'),
    tasks_executing: countBy(store.tasks, (task) => task.status === 'executing'),
    tasks_completed: countBy(store.tasks, (task) => task.status === 'completed'),
    maintenance: store.events.length,
    maintenance_open: countBy(store.events, (event) => event.status === 'open'),
    maintenance_resolved: countBy(store.events, (event) => event.status === 'resolved'),
  };

  const byMall: StatsByMall[] = store.malls.map((mall) => {
    const floors = store.floors.filter((floor) => floor.mall_id === mall.id);
    const floorIds = new Set(floors.map((floor) => floor.id));
    const robots = store.robots.filter((robot) => floorIds.has(robot.floor_id));
    const robotIds = new Set(robots.map((robot) => robot.id));
    const tasks = store.tasks.filter((task) => floorIds.has(task.floor_id));
    return {
      mall_id: mall.id,
      mall_name: mall.name,
      floors: floors.length,
      robots: robots.length,
      robots_fault: countBy(robots, (robot) => robot.status === 'fault'),
      tasks: tasks.length,
      tasks_completed: countBy(tasks, (task) => task.status === 'completed'),
      maintenance_open: countBy(store.events, (event) => robotIds.has(event.robot_id) && event.status === 'open'),
    };
  });

  return { totals, by_mall: byMall };
}

export function createMockClient(options: MockClientOptions = {}): MockClient {
  const latencyMs = options.latencyMs ?? 0;
  const seed = options.seed ?? 'standard';
  const store: MockStore =
    seed === 'empty' ? createEmptyStore() : seed === 'standard' ? createStandardSeed() : seed;
  const wait = () => (latencyMs > 0 ? delay(latencyMs) : Promise.resolve());

  const client: MockClient = {
    __store: store,

    async listMalls() {
      await wait();
      return { malls: store.malls.map((mall) => mallSummary(store, mall)) };
    },

    async createMall(body) {
      await wait();
      const name = requireText(body?.name, 'name', 100);
      const mall: MallRow = { id: ++store.seq.mall, name, created_at: nowIso() };
      store.malls.push(mall);
      return { mall: mallSummary(store, mall) };
    },

    async getMall(id) {
      await wait();
      const mall = store.malls.find((row) => row.id === requireInt(id, 'id'));
      if (!mall) throw notFound('商场');
      const floors = store.floors
        .filter((floor) => floor.mall_id === mall.id)
        .map((floor) => ({ id: floor.id, name: floor.name, robot_count: floorRobotCount(store, floor.id) }));
      return { mall: { ...mallSummary(store, mall), floors } };
    },

    async updateMall(id, body) {
      await wait();
      const mall = store.malls.find((row) => row.id === requireInt(id, 'id'));
      if (!mall) throw notFound('商场');
      if (body?.name !== undefined) mall.name = requireText(body.name, 'name', 100);
      return { mall: mallSummary(store, mall) };
    },

    async listFloors(filter) {
      await wait();
      const floors = store.floors
        .filter((floor) => filter?.mall_id === undefined || floor.mall_id === filter.mall_id)
        .map((floor) => floorToApi(store, floor));
      return { floors };
    },

    async createFloor(body) {
      await wait();
      const mallId = requireInt(body?.mall_id, 'mall_id');
      const mall = store.malls.find((row) => row.id === mallId);
      if (!mall) throw notFound('商场');
      const name = requireText(body?.name, 'name', 100);
      const floor: FloorRow = { id: ++store.seq.floor, mall_id: mallId, name, created_at: nowIso() };
      store.floors.push(floor);
      return { floor: floorToApi(store, floor) };
    },

    async getFloor(id) {
      await wait();
      const floor = findFloor(store, requireInt(id, 'id'));
      const mall = store.malls.find((row) => row.id === floor.mall_id);
      return {
        floor: {
          ...floorToApi(store, floor),
          mall: { id: mall?.id ?? -1, name: mall?.name ?? '' },
          robots: store.robots
            .filter((robot) => robot.floor_id === floor.id)
            .map((robot) => robotToApi(store, robot)),
        },
      };
    },

    async updateFloor(id, body) {
      await wait();
      const floor = findFloor(store, requireInt(id, 'id'));
      if (body?.name !== undefined) floor.name = requireText(body.name, 'name', 100);
      return { floor: floorToApi(store, floor) };
    },

    async listRobots(filter) {
      await wait();
      const robots = store.robots
        .filter((robot) => {
          if (filter?.floor_id !== undefined && robot.floor_id !== filter.floor_id) return false;
          if (filter?.status !== undefined && robot.status !== filter.status) return false;
          if (filter?.mall_id !== undefined) {
            const floor = store.floors.find((row) => row.id === robot.floor_id);
            if (!floor || floor.mall_id !== filter.mall_id) return false;
          }
          return true;
        })
        .map((robot) => robotToApi(store, robot));
      return { robots };
    },

    async createRobot(body) {
      await wait();
      const floorId = requireInt(body?.floor_id, 'floor_id');
      findFloor(store, floorId);
      const name = requireText(body?.name, 'name', 100);
      const code = requireText(body?.code, 'code', 50);
      if (store.robots.some((robot) => robot.code === code)) {
        throw new ApiRequestError(409, 'ROBOT_CODE_DUPLICATED', `机器人编号 ${code} 已存在。`);
      }
      const robot: RobotRow = { id: ++store.seq.robot, floor_id: floorId, name, code, status: 'idle', created_at: nowIso() };
      store.robots.push(robot);
      return { robot: robotToApi(store, robot) };
    },

    async getRobot(id) {
      await wait();
      const robot = findRobotRow(store, requireInt(id, 'id'));
      const floor = store.floors.find((row) => row.id === robot.floor_id);
      const mall = store.malls.find((row) => row.id === floor?.mall_id);
      const executing = executingTaskOf(store, robot.id);
      const detail: RobotDetail = {
        ...robotToApi(store, robot),
        floor: { id: floor?.id ?? -1, name: floor?.name ?? '' },
        mall: { id: mall?.id ?? -1, name: mall?.name ?? '' },
        current_task: executing ? taskToApi(store, executing) : null,
      };
      return { robot: detail };
    },

    async updateRobot(id, body) {
      await wait();
      const robot = findRobotRow(store, requireInt(id, 'id'));
      if (body?.floor_id !== undefined) {
        const floorId = requireInt(body.floor_id, 'floor_id');
        findFloor(store, floorId);
        if (robot.status === 'executing') {
          throw new ApiRequestError(409, 'ROBOT_BUSY', '机器人执行任务中，暂不能调整楼层归属。');
        }
        robot.floor_id = floorId;
      }
      if (body?.name !== undefined) robot.name = requireText(body.name, 'name', 100);
      return { robot: robotToApi(store, robot) };
    },

    async listTasks(filter) {
      await wait();
      const tasks = store.tasks
        .filter((task) => {
          if (filter?.status !== undefined && task.status !== filter.status) return false;
          if (filter?.floor_id !== undefined && task.floor_id !== filter.floor_id) return false;
          if (filter?.mall_id !== undefined) {
            const floor = store.floors.find((row) => row.id === task.floor_id);
            if (!floor || floor.mall_id !== filter.mall_id) return false;
          }
          return true;
        })
        .map((task) => taskToApi(store, task));
      return { tasks };
    },

    async createTask(body) {
      await wait();
      const floorId = requireInt(body?.floor_id, 'floor_id');
      findFloor(store, floorId);
      const task: TaskRow = {
        id: ++store.seq.task,
        floor_id: floorId,
        robot_id: null,
        status: 'pending',
        created_at: nowIso(),
        dispatched_at: null,
        completed_at: null,
      };
      // 契约语义：创建即按分配规则尝试分配目标楼层空闲机器人（code 升序首个）
      const candidate = pickIdleRobot(store, floorId);
      if (candidate) task.robot_id = candidate.id;
      store.tasks.push(task);
      return { task: taskToApi(store, task) };
    },

    async dispatchTask(id) {
      await wait();
      const task = findTaskRow(store, requireInt(id, 'id'));
      if (task.status !== 'pending') {
        throw new ApiRequestError(409, 'TASK_NOT_DISPATCHABLE', '任务当前状态不允许下达。');
      }
      let robot = task.robot_id !== null ? store.robots.find((row) => row.id === task.robot_id) ?? null : null;
      if (!robot || robot.status !== 'idle') {
        robot = pickIdleRobot(store, task.floor_id);
        task.robot_id = robot ? robot.id : null;
      }
      if (!robot || task.robot_id === null) {
        throw new ApiRequestError(409, 'NO_AVAILABLE_ROBOT', '目标楼层暂无可分配的空闲机器人。');
      }
      // 同事务：任务 pending→executing 且机器人 idle→executing
      task.status = 'executing';
      task.dispatched_at = nowIso();
      robot.status = 'executing';
      return { task: taskToApi(store, task) };
    },

    async getTask(id) {
      await wait();
      const task = findTaskRow(store, requireInt(id, 'id'));
      const floor = store.floors.find((row) => row.id === task.floor_id);
      const robot = task.robot_id !== null ? store.robots.find((row) => row.id === task.robot_id) : undefined;
      const detail: TaskDetail = {
        ...taskToApi(store, task),
        floor: { id: floor?.id ?? -1, name: floor?.name ?? '' },
        robot: robot ? { id: robot.id, name: robot.name, code: robot.code } : null,
      };
      return { task: detail };
    },

    async reportRobotStatus(robotId, body) {
      await wait();
      const robot = findRobotRow(store, requireInt(robotId, 'robotId'));
      const status = requireOneOf(body?.status, 'status', ['fault', 'idle'] as const);
      if (status === 'fault') {
        // 任意状态→fault；若其有执行中任务，任务回退 pending 并解除机器人关联
        robot.status = 'fault';
        for (const task of store.tasks) {
          if (task.robot_id === robot.id && task.status === 'executing') {
            task.status = 'pending';
            task.robot_id = null;
          }
        }
      } else {
        // 仅 fault→idle（恢复上报）合法
        if (robot.status !== 'fault') {
          throw new ApiRequestError(409, 'INVALID_STATUS_TRANSITION', '仅处于异常状态的机器人可以上报恢复。');
        }
        robot.status = 'idle';
      }
      return { robot: robotToApi(store, robot) };
    },

    async reportRobotTaskCompletion(robotId) {
      await wait();
      const robot = findRobotRow(store, requireInt(robotId, 'robotId'));
      const task = executingTaskOf(store, robot.id);
      if (!task) {
        throw new ApiRequestError(409, 'NO_EXECUTING_TASK', '该机器人当前没有执行中的任务。');
      }
      // 同事务：任务→completed（记录 completed_at），机器人→idle
      task.status = 'completed';
      task.completed_at = nowIso();
      robot.status = 'idle';
      return { task: taskToApi(store, task), robot: robotToApi(store, robot) };
    },

    async listMaintenanceEvents(filter) {
      await wait();
      const events = store.events
        .filter((event) => {
          if (filter?.robot_id !== undefined && event.robot_id !== filter.robot_id) return false;
          if (filter?.status !== undefined && event.status !== filter.status) return false;
          return true;
        })
        .map((event) => eventToApi(event));
      return { events };
    },

    async createMaintenanceEvent(body) {
      await wait();
      const robotId = requireInt(body?.robot_id, 'robot_id');
      findRobotRow(store, robotId);
      const type = requireOneOf<MaintenanceType>(body?.type, 'type', ['fault', 'maintenance']);
      const description = requireText(body?.description, 'description', 500);
      const event: EventRow = {
        id: ++store.seq.event,
        robot_id: robotId,
        type,
        description,
        status: 'open',
        resolution: null,
        created_at: nowIso(),
        resolved_at: null,
      };
      store.events.push(event);
      return { event: eventToApi(event) };
    },

    async getMaintenanceEvent(id) {
      await wait();
      const event = findEventRow(store, requireInt(id, 'id'));
      const robot = findRobotRow(store, event.robot_id);
      const detail: MaintenanceEventDetail = {
        ...eventToApi(event),
        robot: { id: robot.id, name: robot.name, code: robot.code },
      };
      return { event: detail };
    },

    async resolveMaintenanceEvent(id, body) {
      await wait();
      const event = findEventRow(store, requireInt(id, 'id'));
      if (event.status !== 'open') {
        throw new ApiRequestError(409, 'EVENT_ALREADY_RESOLVED', '该运维事件已处理。');
      }
      const resolution = requireText(body?.resolution, 'resolution', 500);
      event.status = 'resolved';
      event.resolution = resolution;
      event.resolved_at = nowIso();
      return { event: eventToApi(event) };
    },

    async getStats() {
      await wait();
      return { stats: computeStats(store) };
    },
  };

  return client;
}
