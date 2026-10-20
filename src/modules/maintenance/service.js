import { notFound, eventAlreadyResolved } from '../../http/errors.js'

/**
 * maintenance 领域服务：运维事件登记、处理关闭与历史查询。
 * 纯记录域：登记与处理运维事件不改变机器人运行状态（与运行状态域解耦，架构基线 §2）。
 */
export function createMaintenanceService({ db, queries }) {
  const insertEventStmt = db.prepare(
    "INSERT INTO maintenance_events (robot_id, type, description, status, created_at) VALUES (?, ?, ?, 'open', ?)"
  )
  const resolveEventStmt = db.prepare(
    "UPDATE maintenance_events SET status = 'resolved', resolution = ?, resolved_at = ? WHERE id = ?"
  )

  const now = () => new Date().toISOString()

  function createEvent({ robot_id, type, description }) {
    if (!queries.robotExists(robot_id)) throw notFound(`机器人不存在（id=${robot_id}）`)
    const info = insertEventStmt.run(robot_id, type, description, now())
    return queries.mapEvent(queries.getEventById(Number(info.lastInsertRowid)))
  }

  function resolveEvent(id, { resolution }) {
    const row = queries.getEventById(id)
    if (!row) throw notFound(`运维事件不存在（id=${id}）`)
    if (row.status !== 'open') throw eventAlreadyResolved(queries.mapEvent(row))
    resolveEventStmt.run(resolution, now(), id)
    return queries.mapEvent(queries.getEventById(id))
  }

  function getEventDetail(id) {
    const row = queries.getEventById(id)
    return row ? queries.mapEventDetail(row) : null
  }

  function listEvents(filter = {}) {
    return queries.listEvents(filter)
  }

  return { createEvent, resolveEvent, getEventDetail, listEvents }
}
