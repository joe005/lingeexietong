/**
 * tasking 模块私有表（tasks）的读取查询与行 → 契约对象映射。
 * Task.mall_id 经注入的 organization floorRef 派生（不直接触碰 floors 表）；
 * 列表按 mall_id 过滤时同样通过注入的 floorRef 把商场解析为楼层集合。
 */

export function createTaskingQueries(db, { floorRef }) {
  const TASK_COLUMNS = 'id, floor_id, robot_id, status, created_at, dispatched_at, completed_at'

  const getTaskByIdStmt = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`)
  const getExecutingTaskByRobotStmt = db.prepare(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE robot_id = ? AND status = 'executing' ORDER BY id LIMIT 1`
  )
  const getExecutingTaskIdByRobotStmt = db.prepare(
    `SELECT id FROM tasks WHERE robot_id = ? AND status = 'executing' ORDER BY id LIMIT 1`
  )

  const listCache = new Map()
  function listStatement({ status, floorId, floorIds }) {
    const key = `${status ? 's' : '-'}${floorId ? 'f' : '-'}${floorIds ? 'm' : '-'}`
    if (!listCache.has(key)) {
      const where = []
      if (status) where.push('status = ?')
      if (floorId) where.push('floor_id = ?')
      if (floorIds) where.push(`floor_id IN (${floorIds.map(() => '?').join(', ')})`)
      const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
      listCache.set(key, db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks${whereSql} ORDER BY id`))
    }
    return listCache.get(key)
  }

  /** 行 → Task 契约对象（mall_id 为服务端派生字段）。 */
  function mapTask(row) {
    const floor = row ? floorRef.getFloorById(row.floor_id) : undefined
    return {
      id: row.id,
      floor_id: row.floor_id,
      mall_id: floor ? floor.mall_id : null,
      robot_id: row.robot_id,
      status: row.status,
      created_at: row.created_at,
      dispatched_at: row.dispatched_at ?? null,
      completed_at: row.completed_at ?? null,
    }
  }

  return {
    mapTask,
    getTaskById: (id) => getTaskByIdStmt.get(id),
    mapTaskById: (id) => {
      const row = getTaskByIdStmt.get(id)
      return row ? mapTask(row) : null
    },
    getExecutingTaskByRobot: (robotId) => getExecutingTaskByRobotStmt.get(robotId) ?? null,
    getExecutingTaskIdByRobot: (robotId) => getExecutingTaskIdByRobotStmt.get(robotId)?.id ?? null,
    listTasks: (filter = {}) => {
      const status = filter.status
      const floorId = filter.floorId
      const floorIds = filter.floorIds
      if (status === undefined && floorId === undefined && floorIds === undefined) {
        return listStatement({}).all().map(mapTask)
      }
      if (floorIds !== undefined) {
        if (floorIds.length === 0) return []
        const stmt = listStatement({ status, floorIds })
        const params = []
        if (status !== undefined) params.push(status)
        params.push(...floorIds)
        return stmt.all(...params).map(mapTask)
      }
      const stmt = listStatement({ status, floorId })
      const params = []
      if (status !== undefined) params.push(status)
      if (floorId !== undefined) params.push(floorId)
      return stmt.all(...params).map(mapTask)
    },
  }
}
