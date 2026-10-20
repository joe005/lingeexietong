import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req, seedWorld } from './helpers.js'

test('空库统计全为 0（无虚构数据）', async () => {
  const env = createTestEnv()
  try {
    const stats = await req(env.app, 'GET', '/api/stats')
    assert.equal(stats.status, 200)
    assert.deepEqual(stats.body.stats.totals, {
      malls: 0,
      floors: 0,
      robots: 0,
      robots_idle: 0,
      robots_executing: 0,
      robots_fault: 0,
      tasks: 0,
      tasks_pending: 0,
      tasks_executing: 0,
      tasks_completed: 0,
      maintenance: 0,
      maintenance_open: 0,
      maintenance_resolved: 0,
    })
    assert.deepEqual(stats.body.stats.by_mall, [])
  } finally {
    env.cleanup()
  }
})

test('AC-05 服务端面：统计与系统内实际记录一致（实时聚合）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    // 产出运营记录：任务1完成、任务2执行中（R2）、任务3待执行、R3 故障、2 个运维事件（1 已处理）
    const task1 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id }) // 预分配 R1
    await req(app, 'POST', `/api/tasks/${task1.body.task.id}/dispatch`)
    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)

    const task2 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id }) // R1 已 idle，再分配 R1？
    // R1 完成任务后回到 idle，此任务再次预分配 R1；先让 R1 进入执行中
    await req(app, 'POST', `/api/tasks/${task2.body.task.id}/dispatch`)

    const task3 = await req(app, 'POST', '/api/tasks', { floor_id: world.floorB.id }) // R3
    await req(app, 'POST', `/api/robot-gateway/${world.robotR3.id}/status`, { status: 'fault' })

    const events = await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR1.id,
      type: 'maintenance',
      description: '滤网更换',
    })
    await req(app, 'POST', '/api/maintenance-events', {
      robot_id: world.robotR3.id,
      type: 'fault',
      description: '驱动故障待处理',
    })
    await req(app, 'POST', `/api/maintenance-events/${events.body.event.id}/resolve`, { resolution: '已更换滤网' })

    // 直查数据库作为对照事实源
    const dbTotals = {
      malls: env.db.prepare('SELECT COUNT(*) n FROM malls').get().n,
      floors: env.db.prepare('SELECT COUNT(*) n FROM floors').get().n,
      robots: env.db.prepare('SELECT COUNT(*) n FROM robots').get().n,
      robots_idle: env.db.prepare("SELECT COUNT(*) n FROM robots WHERE status='idle'").get().n,
      robots_executing: env.db.prepare("SELECT COUNT(*) n FROM robots WHERE status='executing'").get().n,
      robots_fault: env.db.prepare("SELECT COUNT(*) n FROM robots WHERE status='fault'").get().n,
      tasks: env.db.prepare('SELECT COUNT(*) n FROM tasks').get().n,
      tasks_pending: env.db.prepare("SELECT COUNT(*) n FROM tasks WHERE status='pending'").get().n,
      tasks_executing: env.db.prepare("SELECT COUNT(*) n FROM tasks WHERE status='executing'").get().n,
      tasks_completed: env.db.prepare("SELECT COUNT(*) n FROM tasks WHERE status='completed'").get().n,
      maintenance: env.db.prepare('SELECT COUNT(*) n FROM maintenance_events').get().n,
      maintenance_open: env.db.prepare("SELECT COUNT(*) n FROM maintenance_events WHERE status='open'").get().n,
      maintenance_resolved: env.db.prepare("SELECT COUNT(*) n FROM maintenance_events WHERE status='resolved'").get().n,
    }

    const stats = await req(app, 'GET', '/api/stats')
    assert.equal(stats.status, 200)
    assert.deepEqual(stats.body.stats.totals, dbTotals)

    // 状态推演校验：R1 完成任务 1 后被任务 2 占用（executing），R2 idle，R3 fault
    assert.equal(dbTotals.robots_idle, 1)
    assert.equal(dbTotals.robots_executing, 1)
    assert.equal(dbTotals.robots_fault, 1)
    assert.equal(dbTotals.tasks_completed, 1)
    assert.equal(dbTotals.tasks_executing, 1)
    // task3 因 R3 故障回退 pending？——task3 尚未 dispatch，本来就 pending
    assert.equal(dbTotals.tasks_pending, 1)
    assert.equal(dbTotals.maintenance_open, 1)
    assert.equal(dbTotals.maintenance_resolved, 1)

    // by_mall 与记录对照
    const byMall = stats.body.stats.by_mall
    assert.equal(byMall.length, 2)
    const rowA = byMall.find((m) => m.mall_id === world.mallA.id)
    const rowB = byMall.find((m) => m.mall_id === world.mallB.id)
    assert.deepEqual(
      {
        mall_name: rowA.mall_name,
        floors: rowA.floors,
        robots: rowA.robots,
        robots_fault: rowA.robots_fault,
        tasks: rowA.tasks,
        tasks_completed: rowA.tasks_completed,
        maintenance_open: rowA.maintenance_open,
      },
      {
        mall_name: '商场A',
        floors: 1,
        robots: 2,
        robots_fault: 0,
        tasks: 2,
        tasks_completed: 1,
        maintenance_open: 0,
      }
    )
    assert.deepEqual(
      {
        mall_name: rowB.mall_name,
        floors: rowB.floors,
        robots: rowB.robots,
        robots_fault: rowB.robots_fault,
        tasks: rowB.tasks,
        tasks_completed: rowB.tasks_completed,
        maintenance_open: rowB.maintenance_open,
      },
      {
        mall_name: '商场B',
        floors: 1,
        robots: 1,
        robots_fault: 1,
        tasks: 1,
        tasks_completed: 0,
        maintenance_open: 1,
      }
    )
  } finally {
    env.cleanup()
  }
})

test('统计随状态流转实时变化（无缓存与预聚合）', async () => {
  const env = createTestEnv()
  try {
    const { app } = env
    const world = await seedWorld(app)

    const before = (await req(app, 'GET', '/api/stats')).body.stats.totals
    assert.equal(before.tasks_pending, 0)

    const task = await req(app, 'POST', '/api/tasks', { floor_id: world.floorA.id })
    const afterCreate = (await req(app, 'GET', '/api/stats')).body.stats.totals
    assert.equal(afterCreate.tasks_pending, 1)

    await req(app, 'POST', `/api/tasks/${task.body.task.id}/dispatch`)
    const afterDispatch = (await req(app, 'GET', '/api/stats')).body.stats.totals
    assert.equal(afterDispatch.tasks_pending, 0)
    assert.equal(afterDispatch.tasks_executing, 1)
    assert.equal(afterDispatch.robots_executing, 1)

    await req(app, 'POST', `/api/robot-gateway/${world.robotR1.id}/task-completion`)
    const afterDone = (await req(app, 'GET', '/api/stats')).body.stats.totals
    assert.equal(afterDone.tasks_executing, 0)
    assert.equal(afterDone.tasks_completed, 1)
    assert.equal(afterDone.robots_executing, 0)
    assert.equal(afterDone.robots_idle, 3)
  } finally {
    env.cleanup()
  }
})
