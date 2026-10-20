import { Hono } from 'hono'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApiError, toErrorBody } from './http/errors.js'
import { createStaticMiddleware, createSpaFallback } from './http/static.js'
import { DEFAULT_PUBLIC_DIR } from './db/defaults.js'

import { createOrganizationQueries } from './modules/organization/queries.js'
import { createOrganizationService } from './modules/organization/service.js'
import { createOrganizationRoutes } from './modules/organization/routes.js'

import { createTaskingQueries } from './modules/tasking/queries.js'
import { createTaskingService } from './modules/tasking/service.js'
import { createTaskingRoutes } from './modules/tasking/routes.js'

import { createRobotGatewayService } from './modules/robot-gateway/service.js'
import { createRobotGatewayRoutes } from './modules/robot-gateway/routes.js'

import { createMaintenanceQueries } from './modules/maintenance/queries.js'
import { createMaintenanceService } from './modules/maintenance/service.js'
import { createMaintenanceRoutes } from './modules/maintenance/routes.js'

import { createAnalyticsQueries } from './modules/analytics/queries.js'
import { createAnalyticsRoutes } from './modules/analytics/routes.js'

/**
 * 组装 Hono 应用：/api JSON API + 前端构建产物静态托管（public/ 不存在时仅提供 API）。
 * 模块间依赖在此处显式接线（避免模块相互 import）：
 * - organization 持有 malls/floors/robots，tasking 持有 tasks；
 * - 跨模块读取经注入的查询接口（floorRef / robotRef / taskQueries）；
 * - 跨模块写入一律调用被写模块的领域服务（setRobotStatus 等）。
 */
export function createApp({ db, publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  const orgQueries = createOrganizationQueries(db)
  const taskQueries = createTaskingQueries(db, { floorRef: orgQueries })
  const organization = createOrganizationService({ db, queries: orgQueries, taskQueries })
  const tasking = createTaskingService({ db, taskQueries, organization })
  const robotGateway = createRobotGatewayService({ db, organization, tasking, taskQueries })
  const maintenance = createMaintenanceService({
    db,
    queries: createMaintenanceQueries(db, { robotRef: orgQueries.getRobotRef }),
  })
  const analytics = createAnalyticsQueries(db)

  const app = new Hono()

  // 统一错误结构：{"error":{"code","message","fields"?}}
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(toErrorBody(err), err.status)
    }
    console.error('[api] 未处理错误:', err)
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } }, 500)
  })

  // ---- /api JSON API（端点与字段形状以技术契约为唯一依据）----
  app.route('/api', createOrganizationRoutes({ service: organization }))
  app.route('/api', createTaskingRoutes({ service: tasking }))
  app.route('/api/robot-gateway', createRobotGatewayRoutes({ service: robotGateway }))
  app.route('/api', createMaintenanceRoutes({ service: maintenance }))
  app.route('/api', createAnalyticsRoutes({ queries: analytics }))

  // ---- 静态托管（目录不存在时仅提供 API）----
  const staticRoot = resolve(publicDir)
  if (existsSync(staticRoot)) {
    app.use('*', createStaticMiddleware({ root: staticRoot }))
    app.use('*', createSpaFallback({ root: staticRoot }))
  }

  app.notFound((c) => {
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) {
      return c.json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404)
    }
    return c.text('Not Found', 404, { 'Content-Type': 'text/plain; charset=utf-8' })
  })

  return app
}
