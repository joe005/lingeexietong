import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req, seedWorld, ISO_TIME } from './helpers.js'

test('fault 上报：机器人转入 fault，执行中任务回退 pending 并解除关联', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    assert.equal((await req(app, 'GET', `/api/robots/${world.robotR1.id}`)).body.robot.status, 'executing')

    const report = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'fault' })
    assert.equal(report.status, 200)
    assert.equal(report.body.robot.status, 'fault')
    assert.equal(report.body.robot.current_task_id, null)

    // 任务回退待执行且解除机器人关联
    const taskDetail = await req(app, 'GET', `/api/tasks/${task.body.task.id}`)
    assert.equal(taskDetail.body.task.status, 'pending')
    assert.equal(taskDetail.body.task.robot_id, null)
    assert.equal(taskDetail.body.task.robot, null)

    // 恢复后重新 dispatch 可再次分配（回到 idle 的 R1 code 最小）
    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'idle' })
    const redispatch = await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    assert.equal(redispatch.status, 200)
    assert.equal(redispatch.body.task.status, 'executing')
    assert.equal(redispatch.body.task.robot_id, world.robotR1.id)
  } finally {
    env.cleanup()
  }
})

test('idle 上报仅对 fault 机器人合法，其他起始状态 409 INVALID_STATUS_TRANSITION', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    // idle → idle 非法
    const fromIdle = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'idle' })
    assert.equal(fromIdle.status, 409)
    assert.equal(fromIdle.body.error.code, 'INVALID_STATUS_TRANSITION')

    // executing → idle 非法（需经任务完成上报流转）
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    const fromExecuting = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'idle' })
    assert.equal(fromExecuting.status, 409)
    assert.equal(fromExecuting.body.error.code, 'INVALID_STATUS_TRANSITION')

    // fault → idle 合法（恢复上报）
    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'fault' })
    const recover = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'idle' })
    assert.equal(recover.status, 200)
    assert.equal(recover.body.robot.status, 'idle')

    // 已恢复后再报恢复 → 409
    const again = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'idle' })
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'INVALID_STATUS_TRANSITION')
  } finally {
    env.cleanup()
  }
})

test('fault 重报幂等：已处于 fault 的机器人再次上报 fault 返回 200', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    await req(app, 'POST', `/api/robot-gateway/${world.robotR3.id}/status`, { status: 'fault' })
    const again = await req(app, 'POST', `/api/robot-gateway/${world.robotR3.id}/status`, { status: 'fault' })
    assert.equal(again.status, 200)
    assert.equal(again.body.robot.status, 'fault')
  } finally {
    env.cleanup()
  }
})

test('task-completion：任务完成、机器人回 idle、记录可读回', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)

    const completion = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)
    assert.equal(completion.status, 200)
    assert.equal(completion.body.task.status, 'completed')
    assert.equal(completion.body.task.id, task.body.task.id)
    assert.match(completion.body.task.completed_at, ISO_TIME)
    assert.equal(completion.body.robot.status, 'idle')
    assert.equal(completion.body.robot.current_task_id, null)

    // 完成记录读回：关联楼层与执行机器人
    const detail = await req(app, 'GET', `/api/tasks/${task.body.task.id}`)
    assert.equal(detail.body.task.status, 'completed')
    assert.deepEqual(detail.body.task.floor, { id: world.floorA.id, name: 'F1' })
    assert.deepEqual(detail.body.task.robot, { id: world.robotR1.id, name: '清洁1号', code: 'A1' })
  } finally {
    env.cleanup()
  }
})

test('无执行中任务时上报完成返回 409 NO_EXECUTING_TASK', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const res = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'NO_EXECUTING_TASK')

    // 完成后再次上报同样 409（状态已变更，不做静默重放）
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)
    const again = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'NO_EXECUTING_TASK')
  } finally {
    env.cleanup()
  }
})

test('上报端点入参校验：未知机器人 404、非法 status 值 400、非法路径 id 404', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const missing = await req(app, 'POST', '/api/robot-gateway/999/status', { status: 'fault' })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error.code, 'NOT_FOUND')

    const badStatus = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'executing' })
    assert.equal(badStatus.status, 400)
    assert.equal(badStatus.body.error.code, 'VALIDATION_ERROR')
    assert.ok(badStatus.body.error.fields.status)

    const noBody = await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, {})
    assert.equal(noBody.status, 400)
    assert.equal(noBody.body.error.code, 'VALIDATION_ERROR')
    assert.ok(noBody.body.error.fields.status)

    const badId = await req(app, 'POST', '/api/robot-gateway/abc/status', { status: 'fault' })
    assert.equal(badId.status, 404)

    const missingCompletion = await req(app, 'POST', '/api/robot-gateway/999/task-completion')
    assert.equal(missingCompletion.status, 404)
  } finally {
    env.cleanup()
  }
})

test('AC-02 服务端面：状态变化经监控读取面可见（dispatch 与 fault 上报后 robots 列表即时反映）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)

    const monitoring = await req(app, 'GET', `/api/robots?mall_id=${world.mallA.id}`)
    const r1 = monitoring.body.robots.find((r) => r.id === world.robotR1.id)
    const r2 = monitoring.body.robots.find((r) => r.id === world.robotR2.id)
    assert.equal(r1.status, 'executing')
    assert.equal(r1.current_task_id, task.body.task.id)
    assert.equal(r1.mall_id, world.mallA.id)
    assert.equal(r2.status, 'idle')

    // 状态过滤
    const executingOnly = await req(app, 'GET', '/api/robots?status=executing')
    assert.equal(executingOnly.body.robots.length, 1)
    assert.equal(executingOnly.body.robots[0].id, world.robotR1.id)

    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/status`, { status: 'fault' })
    const afterFault = await req(app, 'GET', `/api/robots?status=fault`)
    assert.equal(afterFault.body.robots.length, 1)
    assert.equal(afterFault.body.robots[0].id, world.robotR1.id)
    assert.equal(afterFault.body.robots[0].status, 'fault')
  } finally {
    env.cleanup()
  }
})
