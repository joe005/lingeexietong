import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../src/api/client';
import { createMockClient } from '../src/api/mocks';
import type { ApiClient } from '../src/api/client';

type MockApiClient = ApiClient & { __store: unknown };

function newClient(seed: 'empty' | 'standard' = 'empty'): MockApiClient {
  return createMockClient({ seed }) as MockApiClient;
}

async function expectApiError(promise: Promise<unknown>, status: number, code: string): Promise<ApiRequestError> {
  try {
    await promise;
  } catch (cause) {
    expect(cause, `应抛出 ${code} 错误`).toBeInstanceOf(ApiRequestError);
    const error = cause as ApiRequestError;
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(0);
    return error;
  }
  throw new Error(`期望抛出 ${status} ${code}，但调用成功返回`);
}

describe('Mall / Floor / Robot 契约行为（AC-01 数据面语义）', () => {
  it('创建商场→楼层→机器人后可按层级读回，派生计数一致', async () => {
    const api = newClient();

    const { mall } = await api.createMall({ name: '商场 A' });
    expect(mall).toMatchObject({ name: '商场 A', floor_count: 0, robot_count: 0 });
    expect(typeof mall.id).toBe('number');
    expect(typeof mall.created_at).toBe('string');

    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    expect(floor).toMatchObject({ mall_id: mall.id, name: 'F1', robot_count: 0 });

    const { robot } = await api.createRobot({ floor_id: floor.id, name: 'R1', code: 'CB-A1' });
    // snake_case 派生字段原样返回：mall_id 由服务端派生
    expect(robot).toMatchObject({ floor_id: floor.id, mall_id: mall.id, name: 'R1', code: 'CB-A1', status: 'idle', current_task_id: null });

    const { malls } = await api.listMalls();
    expect(malls.find((item) => item.id === mall.id)).toMatchObject({ floor_count: 1, robot_count: 1 });

    const { mall: detail } = await api.getMall(mall.id);
    expect(detail.floors.map((item) => item.name)).toEqual(['F1']);
    expect(detail.floors[0]).toMatchObject({ robot_count: 1 });

    const { floor: floorDetail } = await api.getFloor(floor.id);
    expect(floorDetail.mall).toMatchObject({ id: mall.id, name: '商场 A' });
    expect(floorDetail.robots.map((item) => item.code)).toEqual(['CB-A1']);

    const { robot: robotDetail } = await api.getRobot(robot.id);
    expect(robotDetail.mall).toMatchObject({ id: mall.id, name: '商场 A' });
    expect(robotDetail.floor).toMatchObject({ id: floor.id, name: 'F1' });
    expect(robotDetail.current_task).toBeNull();
  });

  it('名称更新后可读回（PATCH malls / floors / robots）', async () => {
    const api = newClient();
    const { mall } = await api.createMall({ name: '旧名称' });
    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    const { robot } = await api.createRobot({ floor_id: floor.id, name: 'R1', code: 'CB-01' });

    await expect((await api.updateMall(mall.id, { name: '新名称' })).mall.name).toBe('新名称');
    await expect((await api.updateFloor(floor.id, { name: 'F2' })).floor.name).toBe('F2');
    await expect((await api.updateRobot(robot.id, { name: 'R1 改名' })).robot.name).toBe('R1 改名');
  });

  it('字段校验失败返回 400 VALIDATION_ERROR（含 fields）', async () => {
    const api = newClient();
    const error = await expectApiError(api.createMall({ name: '' }), 400, 'VALIDATION_ERROR');
    expect(error.fields).toBeTruthy();
    expect(Object.keys(error.fields!)).toContain('name');

    await expectApiError(api.createFloor({ mall_id: 1, name: '' }), 404, 'NOT_FOUND');
  });

  it('路径对象不存在返回 404 NOT_FOUND', async () => {
    const api = newClient('standard');
    await expectApiError(api.getMall(999), 404, 'NOT_FOUND');
    await expectApiError(api.getFloor(999), 404, 'NOT_FOUND');
    await expectApiError(api.getRobot(999), 404, 'NOT_FOUND');
    await expectApiError(api.getTask(999), 404, 'NOT_FOUND');
    await expectApiError(api.getMaintenanceEvent(999), 404, 'NOT_FOUND');
    await expectApiError(api.createFloor({ mall_id: 999, name: 'F1' }), 404, 'NOT_FOUND');
    await expectApiError(api.createRobot({ floor_id: 999, name: 'R', code: 'CB-X' }), 404, 'NOT_FOUND');
    await expectApiError(api.createTask({ floor_id: 999 }), 404, 'NOT_FOUND');
    await expectApiError(api.createMaintenanceEvent({ robot_id: 999, type: 'fault', description: 'x' }), 404, 'NOT_FOUND');
  });

  it('机器人编号重复返回 409 ROBOT_CODE_DUPLICATED', async () => {
    const api = newClient('standard');
    await expectApiError(
      api.createRobot({ floor_id: 1, name: '重复编号机器人', code: 'CB-001' }),
      409,
      'ROBOT_CODE_DUPLICATED',
    );
  });

  it('机器人列表支持 mall_id / floor_id / status 过滤', async () => {
    const api = newClient('standard');
    const { robots } = await api.listRobots({ mall_id: 2 });
    expect(robots.map((robot) => robot.mall_id)).toEqual([2]);

    const { robots: byFloor } = await api.listRobots({ floor_id: 1 });
    expect(byFloor.map((robot) => robot.code).sort()).toEqual(['CB-001', 'CB-002']);

    const { robots: byStatus } = await api.listRobots({ status: 'fault' });
    expect(byStatus.map((robot) => robot.status)).toEqual(['fault']);
  });

  it('执行任务中的机器人调整楼层归属返回 409 ROBOT_BUSY', async () => {
    const api = newClient('standard');
    // CB-003（id 3）在种子中执行任务中
    await expectApiError(api.updateRobot(3, { floor_id: 1 }), 409, 'ROBOT_BUSY');
    // 仅改名称不受影响
    const { robot } = await api.updateRobot(3, { name: '三号清洁机器人改' });
    expect(robot.name).toBe('三号清洁机器人改');
  });
});

describe('Task 契约行为（AC-03 数据面语义）', () => {
  it('创建任务即尝试分配：目标楼层空闲机器人按 code 升序取首个', async () => {
    const api = newClient();
    const { mall } = await api.createMall({ name: 'M' });
    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    await api.createRobot({ floor_id: floor.id, name: 'R2', code: 'CB-002' });
    await api.createRobot({ floor_id: floor.id, name: 'R1', code: 'CB-001' });

    const { task } = await api.createTask({ floor_id: floor.id });
    expect(task.status).toBe('pending');
    expect(task.mall_id).toBe(mall.id);
    // code 升序首个 = CB-002？否：CB-001 < CB-002，分配 CB-002 对应机器人 id 1（先创建）
    expect(task.robot_id).toBe(2); // CB-001 是后创建的 robot id 2
    expect(task.dispatched_at).toBeNull();
    expect(task.completed_at).toBeNull();
  });

  it('目标楼层无空闲机器人时任务保持待执行且未分配', async () => {
    const api = newClient('standard');
    // 楼层 3（澜庭荟）唯一机器人 CB-004 异常
    const { task } = await api.createTask({ floor_id: 3 });
    expect(task.status).toBe('pending');
    expect(task.robot_id).toBeNull();
  });

  it('下达：任务 pending→executing，机器人 idle→executing，记录 dispatched_at', async () => {
    const api = newClient();
    const { mall } = await api.createMall({ name: 'M' });
    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    const { robot } = await api.createRobot({ floor_id: floor.id, name: 'R1', code: 'CB-001' });
    const { task } = await api.createTask({ floor_id: floor.id });

    const { task: dispatched } = await api.dispatchTask(task.id);
    expect(dispatched.status).toBe('executing');
    expect(dispatched.dispatched_at).toBeTruthy();
    expect(dispatched.robot_id).toBe(robot.id);

    const { robot: busyRobot } = await api.getRobot(robot.id);
    expect(busyRobot.status).toBe('executing');
    expect(busyRobot.current_task_id).toBe(task.id);
  });

  it('重复下达返回 409 TASK_NOT_DISPATCHABLE；已分配机器人被占用时重新分配', async () => {
    const api = newClient();
    const { mall } = await api.createMall({ name: 'M' });
    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    const robotA = (await api.createRobot({ floor_id: floor.id, name: 'A', code: 'CB-001' })).robot;
    const robotB = (await api.createRobot({ floor_id: floor.id, name: 'B', code: 'CB-002' })).robot;
    const { task } = await api.createTask({ floor_id: floor.id });

    const { task: dispatched } = await api.dispatchTask(task.id);
    expect(dispatched.robot_id).toBe(robotA.id);

    await expectApiError(api.dispatchTask(task.id), 409, 'TASK_NOT_DISPATCHABLE');

    // 机器人 A 上报故障 → 任务回退 pending 并解除关联；A 保持异常，
    // 再下达时按分配规则（code 升序首个空闲）重新分配同楼层机器人 B
    await api.reportRobotStatus(robotA.id, { status: 'fault' });
    const rolled = (await api.getTask(task.id)).task;
    expect(rolled.status).toBe('pending');
    expect(rolled.robot_id).toBeNull();

    const reDispatched = (await api.dispatchTask(task.id)).task;
    expect(reDispatched.status).toBe('executing');
    expect(reDispatched.robot_id).toBe(robotB.id);
    expect((await api.getRobot(robotB.id)).robot.status).toBe('executing');
    expect((await api.getRobot(robotA.id)).robot.status).toBe('fault');
  });

  it('下达时目标楼层无可分配空闲机器人返回 409 NO_AVAILABLE_ROBOT', async () => {
    const api = newClient('standard');
    // 楼层 3 唯一机器人 CB-004 处于 fault
    const { task } = await api.createTask({ floor_id: 3 });
    await expectApiError(api.dispatchTask(task.id), 409, 'NO_AVAILABLE_ROBOT');
  });

  it('任务详情返回 floor 与 robot 关联信息', async () => {
    const api = newClient('standard');
    const { task } = await api.getTask(1);
    expect(task.floor).toMatchObject({ name: '首层 F1' });
    expect(task.robot).toMatchObject({ code: 'CB-001' });
    expect(task.status).toBe('completed');
    expect(task.completed_at).toBeTruthy();

    const pending = (await api.getTask(3)).task;
    expect(pending.robot).toBeNull();
  });
});

describe('Robot Report 契约行为（AC-02 状态变化数据面）', () => {
  it('上报故障：任意状态→fault，执行中任务回退 pending 并解除机器人关联', async () => {
    const api = newClient('standard');
    const { robot } = await api.reportRobotStatus(3, { status: 'fault' }); // CB-003 executing
    expect(robot.status).toBe('fault');
    expect(robot.current_task_id).toBeNull();

    const { task } = await api.getTask(2);
    expect(task.status).toBe('pending');
    expect(task.robot_id).toBeNull();
    expect(task.dispatched_at).not.toBeNull(); // 历史下达时间保留
  });

  it('上报恢复：仅 fault→idle 合法；其他起始状态返回 409 INVALID_STATUS_TRANSITION', async () => {
    const api = newClient('standard');
    const { robot } = await api.reportRobotStatus(4, { status: 'idle' }); // CB-004 fault → idle
    expect(robot.status).toBe('idle');

    await expectApiError(api.reportRobotStatus(1, { status: 'idle' }), 409, 'INVALID_STATUS_TRANSITION'); // 空闲机器人
    const executing = await api.reportRobotStatus(2, { status: 'executing' as 'fault' }).catch(() => null);
    expect(executing).toBeNull(); // 非法枚举被拒绝（不产生状态变更）
  });

  it('上报任务完成：任务 completed（记录 completed_at），机器人 idle', async () => {
    const api = newClient('standard');
    const result = await api.reportRobotTaskCompletion(3); // CB-003 executing task 2
    expect(result.task.status).toBe('completed');
    expect(result.task.completed_at).toBeTruthy();
    expect(result.robot.status).toBe('idle');
    expect(result.robot.current_task_id).toBeNull();

    const { robot } = await api.getRobot(3);
    expect(robot.current_task).toBeNull();
  });

  it('无执行中任务时上报完成返回 409 NO_EXECUTING_TASK', async () => {
    const api = newClient('standard');
    await expectApiError(api.reportRobotTaskCompletion(1), 409, 'NO_EXECUTING_TASK');
  });
});

describe('Maintenance 契约行为（AC-04 数据面语义）', () => {
  it('登记事件（fault/maintenance）后 open 可读回，处理关闭后 resolved 可查', async () => {
    const api = newClient();
    const { mall } = await api.createMall({ name: 'M' });
    const { floor } = await api.createFloor({ mall_id: mall.id, name: 'F1' });
    const { robot } = await api.createRobot({ floor_id: floor.id, name: 'R1', code: 'CB-001' });

    const { event } = await api.createMaintenanceEvent({
      robot_id: robot.id,
      type: 'fault',
      description: '驱动轮异响',
    });
    expect(event).toMatchObject({ robot_id: robot.id, type: 'fault', status: 'open', resolution: null, resolved_at: null });

    // 登记运维事件不改变机器人运行状态（记录域与运行状态域解耦）
    expect((await api.getRobot(robot.id)).robot.status).toBe('idle');

    const { event: resolved } = await api.resolveMaintenanceEvent(event.id, { resolution: '已更换电机' });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolution).toBe('已更换电机');
    expect(resolved.resolved_at).toBeTruthy();

    await expectApiError(api.resolveMaintenanceEvent(event.id, { resolution: '再次处理' }), 409, 'EVENT_ALREADY_RESOLVED');

    const { events } = await api.listMaintenanceEvents({ status: 'resolved' });
    expect(events.some((item) => item.id === event.id)).toBe(true);

    const { event: detail } = await api.getMaintenanceEvent(event.id);
    expect(detail.robot).toMatchObject({ code: 'CB-001' });
  });

  it('type 校验：非 fault/maintenance 返回 400 VALIDATION_ERROR', async () => {
    const api = newClient('standard');
    await expectApiError(
      api.createMaintenanceEvent({ robot_id: 1, type: 'other' as 'fault', description: 'x' }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('按机器人与状态过滤事件列表', async () => {
    const api = newClient('standard');
    const { events } = await api.listMaintenanceEvents({ robot_id: 4 });
    expect(events.map((item) => item.robot_id)).toEqual([4]);

    const { events: open } = await api.listMaintenanceEvents({ status: 'open' });
    expect(open.every((item) => item.status === 'open')).toBe(true);
  });
});

describe('Stats 契约行为（AC-05 数据面语义）', () => {
  it('标准种子下 totals 与 by_mall 与实际记录一致', async () => {
    const api = newClient('standard');
    const { stats } = await api.getStats();

    expect(stats.totals).toEqual({
      malls: 2,
      floors: 3,
      robots: 4,
      robots_idle: 2,
      robots_executing: 1,
      robots_fault: 1,
      tasks: 4,
      tasks_pending: 1,
      tasks_executing: 1,
      tasks_completed: 2,
      maintenance: 2,
      maintenance_open: 1,
      maintenance_resolved: 1,
    });

    expect(stats.by_mall).toEqual([
      {
        mall_id: 1,
        mall_name: '星云广场',
        floors: 2,
        robots: 3,
        robots_fault: 0,
        tasks: 2,
        tasks_completed: 1,
        maintenance_open: 0,
      },
      {
        mall_id: 2,
        mall_name: '澜庭荟',
        floors: 1,
        robots: 1,
        robots_fault: 1,
        tasks: 2,
        tasks_completed: 1,
        maintenance_open: 1,
      },
    ]);
  });

  it('写操作后统计随之变化（无缓存）', async () => {
    const api = newClient('empty');
    const before = (await api.getStats()).stats.totals.malls;
    await api.createMall({ name: '新商场' });
    const after = (await api.getStats()).stats.totals.malls;
    expect(after).toBe(before + 1);
  });
});
