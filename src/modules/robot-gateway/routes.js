import { Hono } from 'hono'
import { readJsonObject, pathId, requireEnum } from '../../http/validate.js'
import { notFound } from '../../http/errors.js'

const REPORTABLE_STATUSES = ['fault', 'idle']

export function createRobotGatewayRoutes({ service }) {
  const app = new Hono()

  app.post('/:robotId/status', async (c) => {
    const robotId = pathId(c, 'robotId')
    if (robotId === null) throw notFound(`机器人不存在（id=${c.req.param('robotId')}）`)
    const body = await readJsonObject(c)
    const status = requireEnum(body, 'status', REPORTABLE_STATUSES)
    const robot = service.reportStatus(robotId, status)
    return c.json({ robot })
  })

  app.post('/:robotId/task-completion', (c) => {
    const robotId = pathId(c, 'robotId')
    if (robotId === null) throw notFound(`机器人不存在（id=${c.req.param('robotId')}）`)
    const { task, robot } = service.reportTaskCompletion(robotId)
    return c.json({ task, robot })
  })

  return app
}
