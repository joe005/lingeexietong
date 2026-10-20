import { Hono } from 'hono'
import { readJsonObject, pathId, requireInt, queryInt, queryEnum } from '../../http/validate.js'
import { notFound } from '../../http/errors.js'

const TASK_STATUSES = ['pending', 'executing', 'completed']

export function createTaskingRoutes({ service }) {
  const app = new Hono()

  app.get('/tasks', (c) => {
    const status = queryEnum(c, 'status', TASK_STATUSES)
    const floorId = queryInt(c, 'floor_id')
    const mallId = queryInt(c, 'mall_id')
    return c.json({ tasks: service.listTasks({ status, floorId, mallId }) })
  })

  app.post('/tasks', async (c) => {
    const body = await readJsonObject(c)
    const floor_id = requireInt(body, 'floor_id')
    const task = service.createTask({ floor_id })
    return c.json({ task }, 201)
  })

  app.post('/tasks/:id/dispatch', (c) => {
    const id = pathId(c, 'id')
    if (id === null) throw notFound(`任务不存在（id=${c.req.param('id')}）`)
    const task = service.dispatchTask(id)
    return c.json({ task })
  })

  app.get('/tasks/:id', (c) => {
    const id = pathId(c, 'id')
    const task = id === null ? null : service.getTaskDetail(id)
    if (!task) throw notFound(`任务不存在（id=${c.req.param('id')}）`)
    return c.json({ task })
  })

  return app
}
