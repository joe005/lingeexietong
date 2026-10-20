import { Hono } from 'hono'

export function createAnalyticsRoutes({ queries }) {
  const app = new Hono()
  app.get('/stats', (c) => c.json({ stats: queries.computeStats() }))
  return app
}
