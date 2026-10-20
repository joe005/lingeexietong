/**
 * analytics 模块：任务执行 / 机器人运行 / 运维记录的实时聚合统计。
 * 本模块无自有表，按架构基线 §2 的定位对全部业务表做只读聚合（查询时实时计算，
 * 无缓存与预聚合存储，保证与系统内实际记录一致）。
 */
export function createAnalyticsQueries(db) {
  const totalsStmt = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM malls) AS malls,
      (SELECT COUNT(*) FROM floors) AS floors,
      (SELECT COUNT(*) FROM robots) AS robots,
      (SELECT COUNT(*) FROM robots WHERE status = 'idle') AS robots_idle,
      (SELECT COUNT(*) FROM robots WHERE status = 'executing') AS robots_executing,
      (SELECT COUNT(*) FROM robots WHERE status = 'fault') AS robots_fault,
      (SELECT COUNT(*) FROM tasks) AS tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'pending') AS tasks_pending,
      (SELECT COUNT(*) FROM tasks WHERE status = 'executing') AS tasks_executing,
      (SELECT COUNT(*) FROM tasks WHERE status = 'completed') AS tasks_completed,
      (SELECT COUNT(*) FROM maintenance_events) AS maintenance,
      (SELECT COUNT(*) FROM maintenance_events WHERE status = 'open') AS maintenance_open,
      (SELECT COUNT(*) FROM maintenance_events WHERE status = 'resolved') AS maintenance_resolved
  `)

  const byMallStmt = db.prepare(`
    SELECT
      m.id AS mall_id,
      m.name AS mall_name,
      (SELECT COUNT(*) FROM floors f WHERE f.mall_id = m.id) AS floors,
      (SELECT COUNT(*) FROM robots r JOIN floors f ON r.floor_id = f.id WHERE f.mall_id = m.id) AS robots,
      (SELECT COUNT(*) FROM robots r JOIN floors f ON r.floor_id = f.id WHERE f.mall_id = m.id AND r.status = 'fault') AS robots_fault,
      (SELECT COUNT(*) FROM tasks t JOIN floors f ON t.floor_id = f.id WHERE f.mall_id = m.id) AS tasks,
      (SELECT COUNT(*) FROM tasks t JOIN floors f ON t.floor_id = f.id WHERE f.mall_id = m.id AND t.status = 'completed') AS tasks_completed,
      (SELECT COUNT(*) FROM maintenance_events e
         JOIN robots r ON e.robot_id = r.id
         JOIN floors f ON r.floor_id = f.id
         WHERE f.mall_id = m.id AND e.status = 'open') AS maintenance_open
    FROM malls m
    ORDER BY m.id
  `)

  return {
    computeStats() {
      const totals = totalsStmt.get()
      const byMall = byMallStmt.all()
      return { totals, by_mall: byMall }
    },
  }
}
