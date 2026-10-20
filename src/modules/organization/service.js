import { notFound, robotCodeDuplicated, robotBusy, toErrorBody } from '../../http/errors.js'

/**
 * organization 领域服务：商场/楼层/机器人登记、层级浏览、基本信息更新，
 * 以及供 tasking / robot-gateway 跨模块调用的机器人状态领域写接口。
 *
 * 边界规则（架构基线 §2）：
 * - robots 状态仅由 robot-gateway 上报与 tasking 下达/完成流转驱动，本服务只提供领域写接口，
 *   不在组织管理端点上暴露状态变更；
 * - 机器人执行任务中禁止调整楼层归属（ROBOT_BUSY）。
 */

export function createOrganizationService({ db, queries, taskQueries }) {
  const insertMallStmt = db.prepare('INSERT INTO malls (name, created_at) VALUES (?, ?)')
  const updateMallStmt = db.prepare('UPDATE malls SET name = ? WHERE id = ?')
  const insertFloorStmt = db.prepare('INSERT INTO floors (mall_id, name, created_at) VALUES (?, ?, ?)')
  const updateFloorStmt = db.prepare('UPDATE floors SET name = ? WHERE id = ?')
  const insertRobotStmt = db.prepare(
    "INSERT INTO robots (floor_id, name, code, status, created_at) VALUES (?, ?, ?, 'idle', ?)"
  )
  const updateRobotStmt = db.prepare('UPDATE robots SET name = ?, floor_id = ? WHERE id = ?')
  const updateRobotFloorStmt = db.prepare('UPDATE robots SET floor_id = ? WHERE id = ?')
  const updateRobotNameStmt = db.prepare('UPDATE robots SET name = ? WHERE id = ?')
  const setRobotStatusStmt = db.prepare('UPDATE robots SET status = ? WHERE id = ?')
  const findIdleRobotOnFloorStmt = db.prepare(
    "SELECT * FROM robots WHERE floor_id = ? AND status = 'idle' ORDER BY code ASC, id ASC LIMIT 1"
  )

  const now = () => new Date().toISOString()

  // ---- 行 → 契约对象映射（派生字段计算）----

  function mallSummary(row) {
    return { id: row.id, name: row.name, floor_count: row.floor_count, robot_count: row.robot_count, created_at: row.created_at }
  }

  function floorObject(row) {
    return { id: row.id, mall_id: row.mall_id, name: row.name, robot_count: row.robot_count, created_at: row.created_at }
  }

  /** Robot 契约对象；current_task_id 由注入的 tasking 查询派生（单一事实源：tasks 执行中记录）。 */
  function composeRobot(row) {
    const currentTaskId = taskQueries.getExecutingTaskIdByRobot(row.id) ?? null
    return {
      id: row.id,
      floor_id: row.floor_id,
      mall_id: row.mall_id,
      name: row.name,
      code: row.code,
      status: row.status,
      current_task_id: currentTaskId,
      created_at: row.created_at,
    }
  }

  function composeRobotDetail(row) {
    const robot = composeRobot(row)
    const floor = queries.getFloorById(row.floor_id)
    const mall = floor ? queries.getMallById(floor.mall_id) : undefined
    const currentTask = robot.current_task_id
      ? taskQueries.getTaskById(robot.current_task_id)
      : undefined
    return {
      ...robot,
      floor: floor ? { id: floor.id, name: floor.name } : null,
      mall: mall ? { id: mall.id, name: mall.name } : null,
      current_task: currentTask ? taskQueries.mapTask(currentTask) : null,
    }
  }

  // ---- Mall ----

  function listMalls() {
    return queries.listMalls().map(mallSummary)
  }

  function getMall(id) {
    const row = queries.getMallById(id)
    if (!row) return null
    const floors = queries.listFloorsByMall(id).map((f) => ({ id: f.id, name: f.name, robot_count: f.robot_count }))
    return { ...mallSummary(row), floors }
  }

  function createMall({ name }) {
    const info = insertMallStmt.run(name, now())
    return mallSummary(queries.getMallById(Number(info.lastInsertRowid)))
  }

  function updateMall(id, { name }) {
    const row = queries.getMallById(id)
    if (!row) throw notFound(`商场不存在（id=${id}）`)
    if (name !== undefined) updateMallStmt.run(name, id)
    return mallSummary(queries.getMallById(id))
  }

  // ---- Floor ----

  function listFloors(filter = {}) {
    const rows = filter.mallId !== undefined ? queries.listFloorsByMall(filter.mallId) : queries.listFloors()
    return rows.map(floorObject)
  }

  function getFloor(id) {
    const row = queries.getFloorById(id)
    if (!row) return null
    const mall = queries.getMallById(row.mall_id)
    const robots = queries.listRobots({ floorId: id }).map(composeRobot)
    return {
      ...floorObject(row),
      mall: mall ? { id: mall.id, name: mall.name } : null,
      robots,
    }
  }

  function createFloor({ mall_id, name }) {
    if (!queries.getMallById(mall_id)) throw notFound(`商场不存在（id=${mall_id}）`)
    const info = insertFloorStmt.run(mall_id, name, now())
    return floorObject(queries.getFloorById(Number(info.lastInsertRowid)))
  }

  function updateFloor(id, { name }) {
    const row = queries.getFloorById(id)
    if (!row) throw notFound(`楼层不存在（id=${id}）`)
    if (name !== undefined) updateFloorStmt.run(name, id)
    return floorObject(queries.getFloorById(id))
  }

  // ---- Robot ----

  function listRobots(filter = {}) {
    return queries.listRobots(filter).map(composeRobot)
  }

  function getRobot(id) {
    const row = queries.getRobotById(id)
    if (!row) return null
    return composeRobotDetail(row)
  }

  function createRobot({ floor_id, name, code }) {
    if (!queries.getFloorById(floor_id)) throw notFound(`楼层不存在（id=${floor_id}）`)
    if (queries.robotCodeExists(code)) throw robotCodeDuplicated(code)
    const info = insertRobotStmt.run(floor_id, name, code, now())
    return composeRobot(queries.getRobotById(Number(info.lastInsertRowid)))
  }

  function updateRobot(id, { name, floor_id }) {
    const row = queries.getRobotById(id)
    if (!row) throw notFound(`机器人不存在（id=${id}）`)
    if (floor_id !== undefined && floor_id !== row.floor_id) {
      // 服务端守卫：执行任务中禁止调整楼层归属
      if (row.status === 'executing') throw robotBusy(row)
      if (!queries.getFloorById(floor_id)) throw notFound(`楼层不存在（id=${floor_id}）`)
    }
    if (name !== undefined && floor_id !== undefined) {
      updateRobotStmt.run(name, floor_id, id)
    } else if (floor_id !== undefined) {
      updateRobotFloorStmt.run(floor_id, id)
    } else if (name !== undefined) {
      updateRobotNameStmt.run(name, id)
    }
    return composeRobot(queries.getRobotById(id))
  }

  // ---- 领域写接口（供 tasking / robot-gateway 跨模块调用）----

  function getRobotRow(id) {
    return queries.getRobotById(id) ?? null
  }

  /** 直接写入机器人状态；仅限任务流转与网关上报路径调用（状态机守卫在调用方）。 */
  function setRobotStatus(id, status) {
    const info = setRobotStatusStmt.run(status, id)
    if (info.changes !== 1) throw notFound(`机器人不存在（id=${id}）`)
    return queries.getRobotById(id)
  }

  /** 分配规则：目标楼层内空闲（idle）机器人按 code 升序取首个。 */
  function findFirstIdleRobotOnFloor(floorId) {
    return findIdleRobotOnFloorStmt.get(floorId) ?? null
  }

  return {
    // 映射与读取
    mallSummary,
    floorObject,
    composeRobot,
    composeRobotDetail,
    listMalls,
    getMall,
    listFloors,
    getFloor,
    listRobots,
    getRobot,
    // 登记/更新
    createMall,
    updateMall,
    createFloor,
    updateFloor,
    createRobot,
    updateRobot,
    // 领域写接口（跨模块注入）
    getRobotRow,
    setRobotStatus,
    findFirstIdleRobotOnFloor,
    // 跨模块读取透传（floorRef / robotRef，供 tasking、maintenance 组装契约对象）
    floorExists: queries.floorExists,
    listFloorIdsByMall: queries.listFloorIdsByMall,
    getRobotRef: queries.getRobotRef,
    getFloorRefById: queries.getFloorById,
    // 供错误层引用
    toErrorBody,
  }
}
