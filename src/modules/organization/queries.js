/**
 * organization 模块私有表（malls / floors / robots）的读取查询。
 * 仅本模块可访问这些表；跨模块读取一律通过本工厂返回的查询接口注入。
 * Robot 行的 mall_id 经 floors JOIN 派生；current_task_id / current_task 属于 tasking
 * 模块数据，由 service 层通过注入的 tasking 查询组装，本层不触碰 tasks 表。
 */

export function createOrganizationQueries(db) {
  const MALL_WITH_COUNTS = `
    SELECT m.id, m.name, m.created_at,
      (SELECT COUNT(*) FROM floors f WHERE f.mall_id = m.id) AS floor_count,
      (SELECT COUNT(*) FROM robots r JOIN floors f2 ON r.floor_id = f2.id WHERE f2.mall_id = m.id) AS robot_count
    FROM malls m`

  const listMallsStmt = db.prepare(`${MALL_WITH_COUNTS} ORDER BY m.id`)
  const getMallStmt = db.prepare(`${MALL_WITH_COUNTS} WHERE m.id = ?`)

  const FLOOR_WITH_COUNT = `
    SELECT f.id, f.mall_id, f.name, f.created_at,
      (SELECT COUNT(*) FROM robots r WHERE r.floor_id = f.id) AS robot_count
    FROM floors f`

  const listFloorsByMallStmt = db.prepare(`${FLOOR_WITH_COUNT} WHERE f.mall_id = ? ORDER BY f.id`)
  const listFloorsStmt = db.prepare(`${FLOOR_WITH_COUNT} ORDER BY f.id`)
  const getFloorStmt = db.prepare(`${FLOOR_WITH_COUNT} WHERE f.id = ?`)

  const ROBOT_BASE = `
    SELECT r.id, r.floor_id, f.mall_id AS mall_id, r.name, r.code, r.status, r.created_at
    FROM robots r
    JOIN floors f ON f.id = r.floor_id`

  const getRobotStmt = db.prepare(`${ROBOT_BASE} WHERE r.id = ?`)
  const getRobotRefStmt = db.prepare('SELECT id, name, code FROM robots WHERE id = ?')
  const robotCodeExistsStmt = db.prepare('SELECT 1 FROM robots WHERE code = ?')
  const listFloorIdsByMallStmt = db.prepare('SELECT id FROM floors WHERE mall_id = ? ORDER BY id')
  const floorExistsStmt = db.prepare('SELECT 1 FROM floors WHERE id = ?')

  const robotListCache = new Map()
  function robotListStatement({ mallId, floorId, status }) {
    const key = `${mallId ? 'm' : '-'}${floorId ? 'f' : '-'}${status ? 's' : '-'}`
    if (!robotListCache.has(key)) {
      const where = []
      if (mallId) where.push('f.mall_id = ?')
      if (floorId) where.push('r.floor_id = ?')
      if (status) where.push('r.status = ?')
      const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : ''
      robotListCache.set(key, db.prepare(`${ROBOT_BASE}${whereSql} ORDER BY r.id`))
    }
    return robotListCache.get(key)
  }

  return {
    listMalls: () => listMallsStmt.all(),
    getMallById: (id) => getMallStmt.get(id),
    listFloorsByMall: (mallId) => listFloorsByMallStmt.all(mallId),
    listFloors: () => listFloorsStmt.all(),
    getFloorById: (id) => getFloorStmt.get(id),
    floorExists: (id) => Boolean(floorExistsStmt.get(id)),
    listFloorIdsByMall: (mallId) => listFloorIdsByMallStmt.all(mallId).map((row) => row.id),
    listRobots: (filter = {}) => {
      const stmt = robotListStatement(filter)
      const params = []
      if (filter.mallId !== undefined) params.push(filter.mallId)
      if (filter.floorId !== undefined) params.push(filter.floorId)
      if (filter.status !== undefined) params.push(filter.status)
      return stmt.all(...params)
    },
    getRobotById: (id) => getRobotStmt.get(id),
    getRobotRef: (id) => getRobotRefStmt.get(id),
    robotCodeExists: (code) => Boolean(robotCodeExistsStmt.get(code)),
  }
}
