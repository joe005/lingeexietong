import { ApiError, validationError } from './errors.js'

/**
 * 请求体与查询参数校验助手。
 * 契约：字段缺失、类型或长度校验失败返回 400 VALIDATION_ERROR，并附带 fields 原因说明。
 */

/** 读取 JSON 请求体；空体或非法 JSON / 非对象返回 400。allowEmpty=true 时空请求体视为 {}（用于 PATCH）。 */
export async function readJsonObject(c, { allowEmpty = false } = {}) {
  const raw = await c.req.text()
  if (!raw.trim()) {
    if (allowEmpty) return {}
    throw validationError({ body: '请求体不能为空，必须为 JSON 对象' })
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw validationError({ body: '请求体不是合法的 JSON' })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw validationError({ body: '请求体必须为 JSON 对象' })
  }
  return parsed
}

/** 路径参数必须为正整数；否则按「对象不存在」返回 404。 */
export function pathId(c, key) {
  const raw = c.req.param(key)
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return value >= 1 ? value : null
}

/** 必填字符串字段：trim 后长度 1..max，返回 trim 值。 */
export function requireString(body, key, max) {
  const value = body[key]
  if (typeof value !== 'string') {
    throw validationError({ [key]: '必须为字符串' })
  }
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > max) {
    throw validationError({ [key]: `长度必须在 1..${max} 之间（去除首尾空白后）` })
  }
  return trimmed
}

/** 可选字符串字段：未提供（undefined）返回 undefined；提供则校验并返回 trim 值。 */
export function optionalString(body, key, max) {
  if (body[key] === undefined) return undefined
  return requireString(body, key, max)
}

/** 必填整数字段。 */
export function requireInt(body, key) {
  const value = body[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw validationError({ [key]: '必须为整数' })
  }
  return value
}

/** 可选整数字段：未提供返回 undefined；提供则必须为整数。 */
export function optionalInt(body, key) {
  if (body[key] === undefined) return undefined
  return requireInt(body, key)
}

/** 必填枚举字段。 */
export function requireEnum(body, key, allowed) {
  const value = body[key]
  if (!allowed.includes(value)) {
    throw validationError({ [key]: `必须为 ${allowed.join(' / ')}` })
  }
  return value
}

/** 查询参数整数（省略或空串视为未提供；提供则必须为整数）。 */
export function queryInt(c, key) {
  const raw = c.req.query(key)
  if (raw === undefined || raw === '') return undefined
  if (!/^-?\d+$/.test(raw)) {
    throw validationError({ [key]: '必须为整数' })
  }
  return Number(raw)
}

/** 查询参数枚举（省略或空串视为未提供；提供则必须为合法枚举值）。 */
export function queryEnum(c, key, allowed) {
  const raw = c.req.query(key)
  if (raw === undefined || raw === '') return undefined
  if (!allowed.includes(raw)) {
    throw validationError({ [key]: `必须为 ${allowed.join(' / ')}` })
  }
  return raw
}

export { ApiError }
