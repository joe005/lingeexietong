import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../src/db/client.js'
import { createApp } from '../src/app.js'
import { DEFAULT_MIGRATIONS_DIR } from '../src/db/defaults.js'

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
export const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/**
 * 每个测试文件独立的隔离环境：临时目录中的独立 SQLite 文件 + 注入 publicDir 的应用实例。
 * withPublic 为 { 相对路径: 内容 } 时在临时目录创建静态产物目录。
 */
export function createTestEnv({ withPublic = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cleanbot-test-'))
  const dbPath = join(dir, 'app.db')
  const { db } = openDatabase(dbPath, { migrationsDir: DEFAULT_MIGRATIONS_DIR })
  let publicDir = null
  if (withPublic) {
    publicDir = join(dir, 'public')
    for (const [name, content] of Object.entries(withPublic)) {
      const file = join(publicDir, name)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    }
  }
  const app = createApp({ db, publicDir: publicDir ?? join(dir, 'public-not-present') })
  return {
    app,
    db,
    dir,
    dbPath,
    publicDir,
    cleanup() {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** 发送 JSON 请求并解析响应；body 为 undefined 时不发送请求体。 */
export async function req(app, method, path, body) {
  const init = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await app.request(path, init)
  const text = await res.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }
  return { status: res.status, headers: res.headers, body: parsed, text }
}

/** 领域数据搭建：商场A(F1: R1/R2) + 商场B(F2: R3)，返回关键 id。 */
export async function seedWorld(app) {
  const mallA = await req(app, 'POST', '/api/malls', { name: '商场A' })
  const floorA = await req(app, 'POST', '/api/floors', { mall_id: mallA.body.mall.id, name: 'F1' })
  const mallB = await req(app, 'POST', '/api/malls', { name: '商场B' })
  const floorB = await req(app, 'POST', '/api/floors', { mall_id: mallB.body.mall.id, name: 'F2' })
  const r1 = await req(app, 'POST', '/api/robots', { floor_id: floorA.body.floor.id, name: '清洁1号', code: 'A1' })
  const r2 = await req(app, 'POST', '/api/robots', { floor_id: floorA.body.floor.id, name: '清洁2号', code: 'B1' })
  const r3 = await req(app, 'POST', '/api/robots', { floor_id: floorB.body.floor.id, name: '清洁3号', code: 'C1' })
  return {
    mallA: mallA.body.mall,
    floorA: floorA.body.floor,
    mallB: mallB.body.mall,
    floorB: floorB.body.floor,
    robotR1: r1.body.robot,
    robotR2: r2.body.robot,
    robotR3: r3.body.robot,
  }
}
