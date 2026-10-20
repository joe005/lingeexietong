import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req, seedWorld, ISO_TIME } from './helpers.js'

test('AC-01 服务端面：商场/楼层/机器人登记与层级读回', async () => {
  const env = createTestEnv()
  try {
    const { app } = env

    // 创建商场 A → 楼层 F1 → 机器人 R1
    const mallA = await req(app, 'POST', '/api/malls', { name: '商场A' })
    assert.equal(mallA.status, 201)
    assert.equal(mallA.body.mall.name, '商场A')
    assert.equal(mallA.body.mall.floor_count, 0)
    assert.equal(mallA.body.mall.robot_count, 0)
    assert.match(mallA.body.mall.created_at, ISO_TIME)
    assert.ok(Number.isInteger(mallA.body.mall.id))

    const f1 = await req(app, 'POST', '/api/floors', { mall_id: mallA.body.mall.id, name: 'F1' })
    assert.equal(f1.status, 201)
    assert.equal(f1.body.floor.mall_id, mallA.body.mall.id)

    const r1 = await req(app, 'POST', '/api/robots', { floor_id: f1.body.floor.id, name: '清洁1号', code: 'A1' })
    assert.equal(r1.status, 201)
    assert.deepEqual(
      { floor_id: r1.body.robot.floor_id, mall_id: r1.body.robot.mall_id, code: r1.body.robot.code, status: r1.body.robot.status, current_task_id: r1.body.robot.current_task_id },
      { floor_id: f1.body.floor.id, mall_id: mallA.body.mall.id, code: 'A1', status: 'idle', current_task_id: null }
    )

    // 商场 B → F2 → R2
    const mallB = await req(app, 'POST', '/api/malls', { name: '商场B' })
    const f2 = await req(app, 'POST', '/api/floors', { mall_id: mallB.body.mall.id, name: 'F2' })
    const r2 = await req(app, 'POST', '/api/robots', { floor_id: f2.body.floor.id, name: '清洁2号', code: 'B1' })
    assert.equal(r2.status, 201)

    // 商场列表统一查看 + 计数派生
    const malls = await req(app, 'GET', '/api/malls')
    assert.equal(malls.status, 200)
    assert.equal(malls.body.malls.length, 2)
    const summaryA = malls.body.malls.find((m) => m.name === '商场A')
    assert.deepEqual({ floor_count: summaryA.floor_count, robot_count: summaryA.robot_count }, { floor_count: 1, robot_count: 1 })

    // 商场详情按层级下钻
    const mallADetail = await req(app, 'GET', `/api/malls/${mallA.body.mall.id}`)
    assert.equal(mallADetail.status, 200)
    assert.equal(mallADetail.body.mall.floors.length, 1)
    assert.equal(mallADetail.body.mall.floors[0].name, 'F1')
    assert.equal(mallADetail.body.mall.floors[0].robot_count, 1)

    // 楼层详情含 mall 引用与机器人列表
    const f1Detail = await req(app, 'GET', `/api/floors/${f1.body.floor.id}`)
    assert.equal(f1Detail.status, 200)
    assert.deepEqual(f1Detail.body.floor.mall, { id: mallA.body.mall.id, name: '商场A' })
    assert.equal(f1Detail.body.floor.robots.length, 1)
    assert.equal(f1Detail.body.floor.robots[0].code, 'A1')

    // 机器人详情含 floor/mall 引用
    const r1Detail = await req(app, 'GET', `/api/robots/${r1.body.robot.id}`)
    assert.equal(r1Detail.status, 200)
    assert.deepEqual(r1Detail.body.robot.floor, { id: f1.body.floor.id, name: 'F1' })
    assert.deepEqual(r1Detail.body.robot.mall, { id: mallA.body.mall.id, name: '商场A' })
    assert.equal(r1Detail.body.robot.current_task, null)

    // 按楼层过滤 / 按商场过滤读回
    const robotsOnF1 = await req(app, 'GET', `/api/robots?floor_id=${f1.body.floor.id}`)
    assert.equal(robotsOnF1.body.robots.length, 1)
    const robotsInA = await req(app, 'GET', `/api/robots?mall_id=${mallA.body.mall.id}`)
    assert.equal(robotsInA.body.robots.length, 1)
    const floorsOfB = await req(app, 'GET', `/api/floors?mall_id=${mallB.body.mall.id}`)
    assert.equal(floorsOfB.body.floors.length, 1)
    assert.equal(floorsOfB.body.floors[0].name, 'F2')
  } finally {
    env.cleanup()
  }
})

test('对象基本信息更新：商场/楼层改名与机器人楼层归属调整', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const renamedMall = await req(app, 'PATCH', `/api/malls/${world.mallA.id}`, { name: '商场A（新）' })
    assert.equal(renamedMall.status, 200)
    assert.equal(renamedMall.body.mall.name, '商场A（新）')

    const renamedFloor = await req(app, 'PATCH', `/api/floors/${world.floorA.id}`, { name: 'F1-东区' })
    assert.equal(renamedFloor.status, 200)
    assert.equal(renamedFloor.body.floor.name, 'F1-东区')

    // 机器人楼层归属调整到商场B的F2（机器人空闲，允许）
    const moved = await req(app, 'PATCH', `/api/robots/${world.robotR1.id}`, { floor_id: world.floorB.id })
    assert.equal(moved.status, 200)
    assert.equal(moved.body.robot.floor_id, world.floorB.id)
    assert.equal(moved.body.robot.mall_id, world.mallB.id)

    // 仅改名（执行中也允许，见 tasking 测试）
    const renamedRobot = await req(app, 'PATCH', `/api/robots/${world.robotR1.id}`, { name: '清洁1号（改）' })
    assert.equal(renamedRobot.status, 200)
    assert.equal(renamedRobot.body.robot.name, '清洁1号（改）')
    assert.equal(renamedRobot.body.robot.floor_id, world.floorB.id)
  } finally {
    env.cleanup()
  }
})

test('机器人编号全局唯一：重复登记返回 409 ROBOT_CODE_DUPLICATED', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)
    const dup = await req(app, 'POST', '/api/robots', { floor_id: world.floorA.id, name: '重复编号', code: 'A1' })
    assert.equal(dup.status, 409)
    assert.equal(dup.body.error.code, 'ROBOT_CODE_DUPLICATED')
    assert.ok(dup.body.error.message.length > 0)
    assert.equal(dup.body.error.fields, undefined)
  } finally {
    env.cleanup()
  }
})

test('校验错误返回 400 VALIDATION_ERROR 且带 fields 原因', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const missingName = await req(app, 'POST', '/api/malls', {})
    assert.equal(missingName.status, 400)
    assert.equal(missingName.body.error.code, 'VALIDATION_ERROR')
    assert.ok(missingName.body.error.fields.name, '应指明 name 字段原因')

    const badType = await req(app, 'POST', '/api/floors', { mall_id: 'x', name: 'F9' })
    assert.equal(badType.status, 400)
    assert.equal(badType.body.error.code, 'VALIDATION_ERROR')
    assert.ok(badType.body.error.fields.mall_id)

    const tooLong = await req(app, 'POST', '/api/robots', { floor_id: world.floorA.id, name: '超'.repeat(101), code: 'X1' })
    assert.equal(tooLong.status, 400)
    assert.ok(tooLong.body.error.fields.name)

    const blank = await req(app, 'POST', '/api/malls', { name: '   ' })
    assert.equal(blank.status, 400)
    assert.ok(blank.body.error.fields.name)

    // 非法 JSON 请求体
    const res = await app.request('/api/malls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    })
    assert.equal(res.status, 400)
    const parsed = await res.json()
    assert.equal(parsed.error.code, 'VALIDATION_ERROR')

    // 查询参数非法枚举
    const badStatus = await req(app, 'GET', '/api/robots?status=broken')
    assert.equal(badStatus.status, 400)
    assert.equal(badStatus.body.error.code, 'VALIDATION_ERROR')
    assert.ok(badStatus.body.error.fields.status)
  } finally {
    env.cleanup()
  }
})

test('不存在的对象返回 404 NOT_FOUND（含非法路径 id）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    for (const [method, path, body] of [
      ['GET', '/api/malls/999'],
      ['PATCH', '/api/malls/999', { name: 'X' }],
      ['GET', '/api/floors/999'],
      ['PATCH', '/api/floors/999', { name: 'X' }],
      ['GET', '/api/robots/999'],
      ['PATCH', '/api/robots/999', { name: 'X' }],
      ['GET', '/api/malls/abc'],
    ]) {
      const res = await req(app, method, path, body)
      assert.equal(res.status, 404, `${method} ${path} 应为 404`)
      assert.equal(res.body.error.code, 'NOT_FOUND')
    }

    // 楼层挂到不存在的商场 / 机器人挂到不存在的楼层
    const floor404 = await req(app, 'POST', '/api/floors', { mall_id: 999, name: 'F9' })
    assert.equal(floor404.status, 404)
    const robot404 = await req(app, 'POST', '/api/robots', { floor_id: 999, name: 'X', code: 'X1' })
    assert.equal(robot404.status, 404)

    // PATCH 机器人指向不存在的楼层
    const world = await seedWorld(app)
    const move404 = await req(app, 'PATCH', `/api/robots/${world.robotR1.id}`, { floor_id: 999 })
    assert.equal(move404.status, 404)
  } finally {
    env.cleanup()
  }
})
