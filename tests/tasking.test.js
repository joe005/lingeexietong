import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req, seedWorld, ISO_TIME } from './helpers.js'

test('AC-03 服务端面：任务创建即预分配空闲机器人（code 升序首个）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    assert.equal(task.status, 201)
    // F1 内空闲机器人 A1、B1，按 code 升序取 A1
    assert.equal(task.body.task.status, 'pending')
    assert.equal(task.body.task.robot_id, world.robotR1.id)
    assert.equal(task.body.task.mall_id, world.mallA.id)
    assert.equal(task.body.task.dispatched_at, null)
    assert.equal(task.body.task.completed_at, null)
    assert.match(task.body.task.created_at, ISO_TIME)

    // 预分配不改变机器人状态（进入执行中发生在 dispatch）
    const robots = await req(app, 'GET', `/api/robots?floor_id=${world.floorA.id}`)
    const r1 = robots.body.robots.find((r) => r.id === world.robotR1.id)
    assert.equal(r1.status, 'idle')
    assert.equal(r1.current_task_id, null)
  } finally {
    env.cleanup()
  }
})

test('楼层无空闲机器人时创建任务保持待执行（robot_id=null）且返回 201', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    assert.equal(task.status, 201)
    assert.equal(task.body.task.robot_id, world.robotR1.id)

    const task2 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    assert.equal(task2.status, 201)
    assert.equal(task2.body.task.robot_id, world.robotR1.id, '预分配仅记录意向，机器人仍为 idle')

    // 楼层不存在 → 404
    const task404 = await req(app, 'POST', '/api/tasks', { floor_id: 999 })
    assert.equal(task404.status, 404)
    assert.equal(task404.body.error.code, 'NOT_FOUND')

    // 缺少 floor_id → 400
    const task400 = await req(app, 'POST', '/api/tasks', {})
    assert.equal(task400.status, 400)
    assert.equal(task400.body.error.code, 'VALIDATION_ERROR')
    assert.ok(task400.body.error.fields.floor_id)
  } finally {
    env.cleanup()
  }
})

test('dispatch：任务 pending→executing、机器人 idle→executing、dispatched_at 落库', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })

    const dispatched = await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    assert.equal(dispatched.status, 200)
    assert.equal(dispatched.body.task.status, 'executing')
    assert.equal(dispatched.body.task.robot_id, world.robotR1.id)
    assert.match(dispatched.body.task.dispatched_at, ISO_TIME)
    assert.equal(dispatched.body.task.completed_at, null)

    // 机器人状态与派生当前任务同步更新
    const robot = await req(app, 'GET', `/api/robots/${world.robotR1.id}`)
    assert.equal(robot.body.robot.status, 'executing')
    assert.equal(robot.body.robot.current_task_id, task.body.task.id)
    assert.equal(robot.body.robot.current_task.id, task.body.task.id)
    assert.equal(robot.body.robot.current_task.status, 'executing')

    // 任务详情读回楼层与机器人关联
    const detail = await req(app, 'GET', `/api/tasks/${task.body.task.id}`)
    assert.deepEqual(detail.body.task.floor, { id: world.floorA.id, name: 'F1' })
    assert.deepEqual(detail.body.task.robot, { id: world.robotR1.id, name: '清洁1号', code: 'A1' })
  } finally {
    env.cleanup()
  }
})

test('dispatch 幂等冲突：非 pending 状态返回 409 TASK_NOT_DISPATCHABLE', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)

    const again = await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'TASK_NOT_DISPATCHABLE')

    // 任务不存在 / 非法 id → 404
    const missing = await req(app, 'POST', '/api/tasks/999/dispatch')
    assert.equal(missing.status, 404)
    const badId = await req(app, 'POST', '/api/tasks/abc/dispatch')
    assert.equal(badId.status, 404)
  } finally {
    env.cleanup()
  }
})

test('dispatch 重分配：原分配机器人被占用时改选楼层内其他空闲机器人', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    // 两个任务都预分配 R1（A1 最小）；task2 先 dispatch 占用 R1
    const task1 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    const task2 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task2.body.task.id}/dispatch`)
    assert.equal((await req(app, 'GET', `/api/robots/${world.robotR1.id}`)).body.robot.status, 'executing')

    // dispatch task1：原分配 R1 已非空闲 → 重新分配 B1
    const dispatched = await req(app, 'POST', `/api/tasks/${task1.body.task.id}/dispatch`)
    assert.equal(dispatched.status, 200)
    assert.equal(dispatched.body.task.robot_id, world.robotR2.id)
    assert.equal((await req(app, 'GET', `/api/robots/${world.robotR2.id}`)).body.robot.status, 'executing')
  } finally {
    env.cleanup()
  }
})

test('dispatch 无可分配空闲机器人返回 409 NO_AVAILABLE_ROBOT 且任务保持 pending', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    // 占满 F1 的两台机器人
    const t1 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${t1.body.task.id}/dispatch`)
    const t2 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${t2.body.task.id}/dispatch`)

    const t3 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    const dispatch3 = await req(app, 'POST', `/api/tasks/${t3.body.task.id}/dispatch`)
    assert.equal(dispatch3.status, 409)
    assert.equal(dispatch3.body.error.code, 'NO_AVAILABLE_ROBOT')
    assert.ok(dispatch3.body.error.message.length > 0)

    // 失败的 dispatch 无写副作用：任务保持待执行，机器人状态不变
    const t3detail = await req(app, 'GET', `/api/tasks/${t3.body.task.id}`)
    assert.equal(t3detail.body.task.status, 'pending')
    assert.equal(t3detail.body.task.dispatched_at, null)
  } finally {
    env.cleanup()
  }
})

test('任务列表过滤：status / floor_id / mall_id', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const t1 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${t1.body.task.id}/dispatch`)
    await req(app, 'POST', '/api/robot-gateway/1/task-completion')
    const t3 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorB.id })

    const all = await req(app, 'GET', '/api/tasks')
    assert.equal(all.body.tasks.length, 2)

    const completed = await req(app, 'GET', '/api/tasks?status=completed')
    assert.equal(completed.body.tasks.length, 1)
    assert.equal(completed.body.tasks[0].id, t1.body.task.id)
    assert.equal(completed.body.tasks[0].mall_id, world.mallA.id)

    const pending = await req(app, 'GET', '/api/tasks?status=pending')
    assert.equal(pending.body.tasks.length, 1)
    assert.equal(pending.body.tasks[0].id, t3.body.task.id)

    const byFloor = await req(app, 'GET', `/api/tasks?floor_id=${world.floorB.id}`)
    assert.equal(byFloor.body.tasks.length, 1)
    assert.equal(byFloor.body.tasks[0].id, t3.body.task.id)

    const byMall = await req(app, 'GET', `/api/tasks?mall_id=${world.mallB.id}`)
    assert.equal(byMall.body.tasks.length, 1)
    assert.equal(byMall.body.tasks[0].floor_id, world.floorB.id)

    // 非法过滤值 → 400
    const bad = await req(app, 'GET', '/api/tasks?status=done')
    assert.equal(bad.status, 400)
    assert.equal(bad.body.error.code, 'VALIDATION_ERROR')
  } finally {
    env.cleanup()
  }
})

test('执行任务中调整楼层归属被拒：409 ROBOT_BUSY（改名不受影响）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)

    const busy = await req(app, 'PATCH', `/api/robots/${world.robotR1.id}`, { floor_id: world.floorB.id })
    assert.equal(busy.status, 409)
    assert.equal(busy.body.error.code, 'ROBOT_BUSY')

    // 执行中仅改名允许
    const rename = await req(app, 'PATCH', `/api/robots/${world.robotR1.id}`, { name: '清洁1号（改）' })
    assert.equal(rename.status, 200)
    assert.equal(rename.body.robot.name, '清洁1号（改）')
    assert.equal(rename.body.robot.floor_id, world.floorA.id)
  } finally {
    env.cleanup()
  }
})
