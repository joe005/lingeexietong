import { Hono } from 'hono'
import {
  readJsonObject,
  pathId,
  requireString,
  optionalString,
  requireInt,
  optionalInt,
  queryInt,
  queryEnum,
} from '../../http/validate.js'
import { notFound } from '../../http/errors.js'

const ROBOT_STATUSES = ['idle', 'executing', 'fault']

export function createOrganizationRoutes({ service }) {
  const app = new Hono()

  // ---- Mall API ----

  app.get('/malls', (c) => c.json({ malls: service.listMalls() }))

  app.post('/malls', async (c) => {
    const body = await readJsonObject(c)
    const name = requireString(body, 'name', 100)
    const mall = service.createMall({ name })
    return c.json({ mall }, 201)
  })

  app.get('/malls/:id', (c) => {
    const id = pathId(c, 'id')
    const mall = id === null ? null : service.getMall(id)
    if (!mall) throw notFound(`商场不存在（id=${c.req.param('id')}）`)
    return c.json({ mall })
  })

  app.patch('/malls/:id', async (c) => {
    const id = pathId(c, 'id')
    if (id === null) throw notFound(`商场不存在（id=${c.req.param('id')}）`)
    const body = await readJsonObject(c, { allowEmpty: true })
    const name = optionalString(body, 'name', 100)
    const mall = service.updateMall(id, { name })
    return c.json({ mall })
  })

  // ---- Floor API ----

  app.get('/floors', (c) => {
    const mallId = queryInt(c, 'mall_id')
    return c.json({ floors: service.listFloors({ mallId }) })
  })

  app.post('/floors', async (c) => {
    const body = await readJsonObject(c)
    const mall_id = requireInt(body, 'mall_id')
    const name = requireString(body, 'name', 100)
    const floor = service.createFloor({ mall_id, name })
    return c.json({ floor }, 201)
  })

  app.get('/floors/:id', (c) => {
    const id = pathId(c, 'id')
    const floor = id === null ? null : service.getFloor(id)
    if (!floor) throw notFound(`楼层不存在（id=${c.req.param('id')}）`)
    return c.json({ floor })
  })

  app.patch('/floors/:id', async (c) => {
    const id = pathId(c, 'id')
    if (id === null) throw notFound(`楼层不存在（id=${c.req.param('id')}）`)
    const body = await readJsonObject(c, { allowEmpty: true })
    const name = optionalString(body, 'name', 100)
    const floor = service.updateFloor(id, { name })
    return c.json({ floor })
  })

  // ---- Robot API ----

  app.get('/robots', (c) => {
    const mallId = queryInt(c, 'mall_id')
    const floorId = queryInt(c, 'floor_id')
    const status = queryEnum(c, 'status', ROBOT_STATUSES)
    return c.json({ robots: service.listRobots({ mallId, floorId, status }) })
  })

  app.post('/robots', async (c) => {
    const body = await readJsonObject(c)
    const floor_id = requireInt(body, 'floor_id')
    const name = requireString(body, 'name', 100)
    const code = requireString(body, 'code', 50)
    const robot = service.createRobot({ floor_id, name, code })
    return c.json({ robot }, 201)
  })

  app.get('/robots/:id', (c) => {
    const id = pathId(c, 'id')
    const robot = id === null ? null : service.getRobot(id)
    if (!robot) throw notFound(`机器人不存在（id=${c.req.param('id')}）`)
    return c.json({ robot })
  })

  app.patch('/robots/:id', async (c) => {
    const id = pathId(c, 'id')
    if (id === null) throw notFound(`机器人不存在（id=${c.req.param('id')}）`)
    const body = await readJsonObject(c, { allowEmpty: true })
    const name = optionalString(body, 'name', 100)
    const floor_id = optionalInt(body, 'floor_id')
    const robot = service.updateRobot(id, { name, floor_id })
    return c.json({ robot })
  })

  return app
}
