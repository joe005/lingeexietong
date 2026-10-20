import { Hono } from 'hono'
import { readJsonObject, pathId, requireString, requireInt, requireEnum, queryInt, queryEnum } from '../../http/validate.js'
import { notFound } from '../../http/errors.js'

const EVENT_TYPES = ['fault', 'maintenance']
const EVENT_STATUSES = ['open', 'resolved']

export function createMaintenanceRoutes({ service }) {
  const app = new Hono()

  app.get('/maintenance-events', (c) => {
    const robotId = queryInt(c, 'robot_id')
    const status = queryEnum(c, 'status', EVENT_STATUSES)
    return c.json({ events: service.listEvents({ robotId, status }) })
  })

  app.post('/maintenance-events', async (c) => {
    const body = await readJsonObject(c)
    const robot_id = requireInt(body, 'robot_id')
    const type = requireEnum(body, 'type', EVENT_TYPES)
    const description = requireString(body, 'description', 500)
    const event = service.createEvent({ robot_id, type, description })
    return c.json({ event }, 201)
  })

  app.get('/maintenance-events/:id', (c) => {
    const id = pathId(c, 'id')
    const event = id === null ? null : service.getEventDetail(id)
    if (!event) throw notFound(`运维事件不存在（id=${c.req.param('id')}）`)
    return c.json({ event })
  })

  app.post('/maintenance-events/:id/resolve', async (c) => {
    const id = pathId(c, 'id')
    if (id === null) throw notFound(`运维事件不存在（id=${c.req.param('id')}）`)
    const body = await readJsonObject(c)
    const resolution = requireString(body, 'resolution', 500)
    const event = service.resolveEvent(id, { resolution })
    return c.json({ event })
  })

  return app
}
