/**
 * 统一错误结构与错误码（技术契约「通用约定」）：
 * 响应体形如 {"error":{"code":"<CODE>","message":"<人类可读说明>","fields":{"<字段>":"<原因>"}}}；
 * fields 仅校验错误（VALIDATION_ERROR）时出现。
 */

export class ApiError extends Error {
  constructor(status, code, message, fields = undefined) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export function validationError(fields, message = '请求参数校验失败') {
  return new ApiError(400, 'VALIDATION_ERROR', message, fields)
}

export function notFound(message = '请求的对象不存在') {
  return new ApiError(404, 'NOT_FOUND', message)
}

export function robotCodeDuplicated(code) {
  return new ApiError(409, 'ROBOT_CODE_DUPLICATED', `机器人编号已存在：${code}`)
}

export function robotBusy(robot) {
  return new ApiError(
    409,
    'ROBOT_BUSY',
    `机器人执行任务中，不能调整楼层归属（${robot.code} 当前状态为 ${robot.status}）`
  )
}

export function taskNotDispatchable(task) {
  return new ApiError(409, 'TASK_NOT_DISPATCHABLE', `任务当前状态不允许下达（任务 ${task.id} 状态为 ${task.status}）`)
}

export function noAvailableRobot() {
  return new ApiError(409, 'NO_AVAILABLE_ROBOT', '目标楼层无可分配的空闲机器人')
}

export function invalidStatusTransition(robot, target) {
  return new ApiError(
    409,
    'INVALID_STATUS_TRANSITION',
    `机器人状态转换非法：${robot.code} 当前状态为 ${robot.status}，不允许转入 ${target}`
  )
}

export function noExecutingTask(robot) {
  return new ApiError(409, 'NO_EXECUTING_TASK', `机器人当前没有执行中的任务（${robot.code}）`)
}

export function eventAlreadyResolved(event) {
  return new ApiError(409, 'EVENT_ALREADY_RESOLVED', `运维事件已处理（事件 ${event.id}）`)
}

/** 转换为契约错误响应体。 */
export function toErrorBody(err) {
  const body = { error: { code: err.code, message: err.message } }
  if (err.fields) body.error.fields = err.fields
  return body
}
