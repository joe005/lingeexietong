/**
 * maintenance 模块私有表（maintenance_events）的读取查询。
 * EventDetail.robot 经注入的 organization robotRef 组装，本层不触碰 robots 表。
 */

export function createMaintenanceQueries(db, { robotRef }) {
  const EVENT_COLUMNS =
    'id, robot_id, type, description, status, resolution, created_at, resolved_at'

  const getEventByIdStmt = db.prepare(`SELECT ${EVENT_COLUMNS} FROM maintenance_events WHERE id = ?`)
  const getRobotRefStmt = robotRef

  const listCache = new Map()
  function listStatement({ robotId, status }) {
    const key = `${robotId ? 'r' : '-'}${status ? 's' : '-'}`
    if (!listCache.has(key)) {
      const where = []
      if (robotId) where.push('robot_id = ?')
      if (status) where.push('status = ?')
      const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
      listCache.set(key, db.prepare(`SELECT ${EVENT_COLUMNS} FROM maintenance_events${whereSql} ORDER BY id`))
    }
    return listCache.get(key)
  }

  function mapEvent(row) {
    return {
      id: row.id,
      robot_id: row.robot_id,
      type: row.type,
      description: row.description,
      status: row.status,
      resolution: row.resolution ?? null,
      created_at: row.created_at,
      resolved_at: row.resolved_at ?? null,
    }
  }

  function mapEventDetail(row) {
    const robot = getRobotRefStmt(row.robot_id)
    return {
      ...mapEvent(row),
      robot: robot ? { id: robot.id, name: robot.name, code: robot.code } : null,
    }
  }

  return {
    mapEvent,
    mapEventDetail,
    getEventById: (id) => getEventByIdStmt.get(id),
    robotExists: (id) => Boolean(getRobotRefStmt(id)),
    listEvents: (filter = {}) => {
      const stmt = listStatement(filter)
      const params = []
      if (filter.robotId !== undefined) params.push(filter.robotId)
      if (filter.status !== undefined) params.push(filter.status)
      return stmt.all(...params).map(mapEvent)
    },
  }
}
