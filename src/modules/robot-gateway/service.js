import { notFound, invalidStatusTransition, noExecutingTask } from '../../http/errors.js'

/**
 * robot-gateway 领域服务：承载「机器人 → 系统」上报数据流。
 * 无自有表；一切写库经 organization / tasking 的领域服务在同事务内完成（架构基线 §2 边界规则）。
 *
 * 状态机（服务端唯一事实源）：
 * - status=fault：任意状态 → fault；若其有执行中任务，该任务回退 pending 并解除关联（robot_id=null）；
 * - status=idle：仅 fault → idle（恢复上报）合法，其他起始状态 409 INVALID_STATUS_TRANSITION；
 * - task-completion：执行中任务 → completed（记录 completed_at），机器人 → idle。
 */
export function createRobotGatewayService({ db, organization, tasking, taskQueries }) {
  function requireRobotRow(robotId) {
    const row = organization.getRobotRow(robotId)
    if (!row) throw notFound(`机器人不存在（id=${robotId}）`)
    return row
  }

  function composeRobotResponse(robotId) {
    return organization.composeRobot(organization.getRobotRow(robotId))
  }

  function reportStatus(robotId, target) {
    requireRobotRow(robotId)
    if (target === 'fault') {
      db.transaction(() => {
        // 执行中任务回退 pending 并解除机器人关联；机器人转入 fault，同事务提交
        tasking.releaseExecutingTask(robotId)
        organization.setRobotStatus(robotId, 'fault')
      })()
      return composeRobotResponse(robotId)
    }
    // target === 'idle'（恢复上报）：仅 fault → idle 合法
    const row = organization.getRobotRow(robotId)
    if (row.status !== 'fault') throw invalidStatusTransition(row, 'idle')
    db.transaction(() => {
      organization.setRobotStatus(robotId, 'idle')
    })()
    return composeRobotResponse(robotId)
  }

  function reportTaskCompletion(robotId) {
    requireRobotRow(robotId)
    const { task, robot } = db.transaction(() => {
      const executing = taskQueries.getExecutingTaskByRobot(robotId)
      if (!executing) throw noExecutingTask(organization.getRobotRow(robotId))
      const completedTask = tasking.markTaskCompleted(executing.id)
      organization.setRobotStatus(robotId, 'idle')
      return { task: completedTask, robot: organization.getRobotRow(robotId) }
    })()
    return { task, robot: organization.composeRobot(robot) }
  }

  return { reportStatus, reportTaskCompletion }
}
