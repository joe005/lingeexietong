import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req, seedWorld, ISO_TIME } from './helpers.js'

test('AC-04 服务端面：运维事件登记、处理关闭与历史读回', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const created = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'fault',
      description: '左轮驱动异常，清洁途中停止',
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.event.status, 'open')
    assert.equal(created.body.event.resolution, null)
    assert.equal(created.body.event.resolved_at, null)
    assert.match(created.body.event.created_at, ISO_TIME)
    assert.equal(created.body.event.robot_id, world.robotR1.id)

    const maintenance2 = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR2.id,
      type: 'maintenance',
      description: '例行滤网更换',
    })
    assert.equal(maintenance2.status, 201)
    assert.equal(maintenance2.body.event.type, 'maintenance')

    // 处理并关闭
    const resolved = await req(app, 'POST', `/api/maintenance-events/${created.body.event.id}/resolve`, {
      resolution: '更换左轮驱动模块并复测通过',
    })
    assert.equal(resolved.status, 200)
    assert.equal(resolved.body.event.status, 'resolved')
    assert.equal(resolved.body.event.resolution, '更换左轮驱动模块并复测通过')
    assert.match(resolved.body.event.resolved_at, ISO_TIME)

    // 历史记录保持可读回，事件与机器人关联
    const list = await req(app, 'GET', '/api/maintenance-events')
    assert.equal(list.body.events.length, 2)
    const detail = await req(app, 'GET', `/api/maintenance-events/${created.body.event.id}`)
    assert.equal(detail.status, 200)
    assert.equal(detail.body.event.status, 'resolved')
    assert.deepEqual(detail.body.event.robot, { id: world.robotR1.id, name: '清洁1号', code: 'A1' })

    // 按机器人过滤的历史
    const byRobot = await req(app, 'GET', `/api/maintenance-events?robot_id=${world.robotR2.id}`)
    assert.equal(byRobot.body.events.length, 1)
    assert.equal(byRobot.body.events[0].type, 'maintenance')
  } finally {
    env.cleanup()
  }
})

test('resolve 幂等冲突：已处理事件再次处理返回 409 EVENT_ALREADY_RESOLVED', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const event = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'fault',
      description: '传感器报错',
    })
    await req(app, 'POST', `/api/maintenance-events/${event.body.event.id}/resolve`, { resolution: '已更换传感器' })

    const again = await req(app, 'POST', `/api/maintenance-events/${event.body.event.id}/resolve`, { resolution: '重复处理' })
    assert.equal(again.status, 409)
    assert.equal(again.body.error.code, 'EVENT_ALREADY_RESOLVED')
  } finally {
    env.cleanup()
  }
})

test('登记与处理运维事件不改变机器人运行状态（记录域解耦）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const before = await req(app, 'GET', `/api/robots/${world.robotR1.id}`)

    await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'fault',
      description: '报障但机器人仍在运行',
    })
    await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'maintenance',
      description: '计划保养',
    })
    const events = await req(app, 'GET', '/api/maintenance-events')
    const last = events.body.events[events.body.events.length - 1]
    await req(app, 'POST', `/api/maintenance-events/${last.id}/resolve`, { resolution: '保养完成' })

    const after = await req(app, 'GET', `/api/robots/${world.robotR1.id}`)
    assert.equal(after.body.robot.status, before.body.robot.status)
    assert.equal(after.body.robot.current_task_id, before.body.robot.current_task_id)
  } finally {
    env.cleanup()
  }
})

test('状态过滤与入参校验、错误码', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'fault',
      description: '待处理故障',
    })
    await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR2.id,
      type: 'maintenance',
      description: '已处理保养',
    })
    const events = await req(app, 'GET', '/api/maintenance-events')
    const resolvedId = events.body.events[1].id
    await req(app, 'POST', `/api/maintenance-events/${resolvedId}/resolve`, { resolution: '完成' })

    const openOnly = await req(app, 'GET', '/api/maintenance-events?status=open')
    assert.equal(openOnly.body.events.length, 1)
    assert.equal(openOnly.body.events[0].status, 'open')
    const resolvedOnly = await req(app, 'GET', '/api/maintenance-events?status=resolved')
    assert.equal(resolvedOnly.body.events.length, 1)
    assert.equal(resolvedOnly.body.events[0].status, 'resolved')

    // 未知机器人 → 404；事件不存在 → 404
    const robot404 = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: 999,
      type: 'fault',
      description: 'X',
    })
    assert.equal(robot404.status, 404)
    const event404 = await req(app, 'GET', '/api/maintenance-events/999')
    assert.equal(event404.status, 404)
    const resolve404 = await req(app, 'POST', '/api/maintenance-events/999/resolve', { resolution: 'X' })
    assert.equal(resolve404.status, 404)

    // 校验：type 枚举、description 长度、resolution 必填
    const badType = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'other',
      description: 'X',
    })
    assert.equal(badType.status, 400)
    assert.ok(badType.body.error.fields.type)
    const tooLong = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'fault',
      description: '长'.repeat(501),
    })
    assert.equal(tooLong.status, 400)
    assert.ok(tooLong.body.error.fields.description)
    const emptyResolution = await req(app, 'POST', `/api/maintenance-events/${events.body.events[0].id}/resolve`, {})
    assert.equal(emptyResolution.status, 400)
    assert.ok(emptyResolution.body.error.fields.resolution)

    // 查询参数非法枚举
    const badFilter = await req(app, 'GET', '/api/maintenance-events?status=closed')
    assert.equal(badFilter.status, 400)
    assert.equal(badFilter.body.error.code, 'VALIDATION_ERROR')
  } finally {
    env.cleanup()
  }
})
