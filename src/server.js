#!/usr/bin/env node
/**
 * 服务入口：Node.js ≥ 20（ESM）。
 * 干净目录 `npm install && npm run build && npm start` 即可运行：
 * 自动创建数据目录、在事务中应用未执行迁移、监听 PORT（默认 3000）。
 */
import { serve } from '@hono/node-server'
import { openDatabase } from './db/client.js'
import { createApp } from './app.js'
import { DEFAULT_DB_PATH, DEFAULT_PORT, DEFAULT_PUBLIC_DIR } from './db/defaults.js'

const port = Number(process.env.PORT ?? DEFAULT_PORT)
if (!Number.isInteger(port) || port < 0) {
  console.error('[cleanbot-ops] PORT 必须为非负整数')
  process.exit(1)
}
const dbPath = process.env.DB_PATH ?? DEFAULT_DB_PATH

const { db, path: absDbPath, appliedMigrations } = openDatabase(dbPath)
const app = createApp({ db, publicDir: DEFAULT_PUBLIC_DIR })

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[cleanbot-ops] 服务已启动: http://localhost:${info.port}`)
  if (appliedMigrations.length > 0) {
    console.log(`[cleanbot-ops] 已应用迁移: ${appliedMigrations.join(', ')}`)
  }
  console.log(`[cleanbot-ops] 数据库: ${absDbPath}`)
})

function shutdown(signal) {
  console.log(`[cleanbot-ops] 收到 ${signal}，正在关闭…`)
  server.close(() => {
    db.close()
    process.exit(0)
  })
  // 兜底：等待中的连接超过 3 秒则强制退出
  setTimeout(() => {
    db.close()
    process.exit(0)
  }, 3000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
