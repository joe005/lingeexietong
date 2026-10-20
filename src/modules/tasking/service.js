import { notFound, taskNotDispatchable, noAvailableRobot } from '../../http/errors.js'

/**
 * tasking 领域服务：任务创建（含预分配）、下达、完成与回退写库。
 *
 * 分配规则（架构基线 §2，最小确定性实现）：
 * 目标楼层内空闲（idle）机器人按 code 升序取首个。
 *
 * 跨表状态流转（tasks + robots）一律在 better-sqlite3 同步事务中原子提交；
 * 对 robots 表的写入经注入的 organization 领域服务完成（表 owner 唯一写入口）。
 */

export function createTaskingService({ db, taskQueries, organization }) {
  const insertTaskStmt = db.prepare(
    "INSERT INTO tasks (floor_id, robot_id, status, created_at) VALUES (?, NULL, 'pending', ?)"
  )
  const assignRobotStmt = db.prepare('UPDATE tasks SET robot_id = ? WHERE id = ?')
  const dispatchTaskStmt = db.prepare(
    "UPDATE tasks SET status = 'executing', robot_id = ?, dispatched_at = ? WHERE id = ?"
  )
  const completeTaskStmt = db.prepare(
    "UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?"
  )
  const releaseRobotStmt = db.prepare(
    "UPDATE tasks SET status = 'pending', robot_id = NULL WHERE robot_id = ? AND status = 'executing'"
  )

  const now = () => new Date().toISOString()

  /**
   * POST /api/tasks 语义：创建任务（pending）并立即按分配规则预分配目标楼层
   * 空闲机器人；无可分配时 robot_id=null 保持待执行（不报错）。
   * 预分配只记录意向，不改机器人状态；机器人进入执行中发生在 dispatch。
   */
  function createTask({ floor_id }) {
    if (!organization.floorExists(floor_id)) throw notFound(`楼层不存在（id=${floor_id}）`)
    return db.transaction(() => {
      const info = insertTaskStmt.run(floor_id, now())
      const taskId = Number(info.lastInsertRowid)
      const robot = organization.findFirstIdleRobotOnFloor(floor_id)
      if (robot) assignRobotStmt.run(robot.id, taskId)
      return taskQueries.mapTaskById(taskId)
    })()
  }

  /**
   * dispatch 语义：任务 pending → executing（记录 dispatched_at）；
   * 若未分配或原分配机器人已非空闲（含已不在目标楼层），重新按分配规则分配；
   * 分配成功后机器人 idle → executing；任务与机器人状态变更在同事务内原子提交。
   * 无可分配机器人时任务保持待执行并抛 409 NO_AVAILABLE_ROBOT（无写副作用）。
   */
  function dispatchTask(id) {
    return db.transaction(() => {
      const row = taskQueries.getTaskById(id)
      if (!row) throw notFound(`任务不存在（id=${id}）`)
      if (row.status !== 'pending') throw taskNotDispatchable(taskQueries.mapTask(row))

      let robot = null
      if (row.robot_id !== null) {
        const assigned = organization.getRobotRow(row.robot_id)
        if (assigned && assigned.status === 'idle' && assigned.floor_id === row.floor_id) {
          robot = assigned
        }
      }
      if (!robot) {
        robot = organization.findFirstIdleRobotOnFloor(row.floor_id)
      }
      if (!robot) throw noAvailableRobot()

      dispatchTaskStmt.run(robot.id, now(), id)
      organization.setRobotStatus(robot.id, 'executing')
      return taskQueries.mapTaskById(id)
    })()
  }

  /** 机器人故障上报时的任务回退：执行中任务 → pending 并解除机器人关联（同事务由调用方保证）。 */
  function releaseExecutingTask(robotId) {
    const info = releaseRobotStmt.run(robotId)
    return info.changes
  }

  /** 任务完成：执行中 → completed 并记录 completed_at（同事务由调用方保证）。 */
  function markTaskCompleted(taskId) {
    const info = completeTaskStmt.run(now(), taskId)
    if (info.changes !== 1) throw notFound(`任务不存在（id=${taskId}）`)
    return taskQueries.mapTaskById(taskId)
  }

  function getTaskDetail(id) {
    const row = taskQueries.getTaskById(id)
    if (!row) return null
    const task = taskQueries.mapTask(row)
    const robot = task.robot_id !== null ? organization.getRobotRef(task.robot_id) : null
    const floor = organization.getFloorRefById(task.floor_id)
    return {
      ...task,
      floor: floor ? { id: floor.id, name: floor.name } : null,
      robot: robot ? { id: robot.id, name: robot.name, code: robot.code } : null,
    }
  }

  function listTasks({ status, floorId, mallId }) {
    const floorIds = mallId !== undefined ? organization.listFloorIdsByMall(mallId) : undefined
    return taskQueries.listTasks({ status, floorId, floorIds })
  }

  return { createTask, dispatchTask, releaseExecutingTask, markTaskCompleted, getTaskDetail, listTasks }
}
