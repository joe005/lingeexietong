import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../src/db/client.js'
import { listMigrationFiles, applyMigrations } from '../src/db/migrate.js'
import { DEFAULT_MIGRATIONS_DIR } from '../src/db/defaults.js'

test('迁移目录提供自 001 起的有序 SQL 文件', () => {
  const files = listMigrationFiles(DEFAULT_MIGRATIONS_DIR)
  assert.ok(files.length >= 1, '至少存在一个迁移文件')
  assert.equal(files[0], '001_init.sql')
})

test('openDatabase 自动创建 DB_PATH 父目录并完成初始迁移', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cleanbot-mig-'))
  try {
    const dbPath = join(dir, 'nested', 'deeper', 'app.db')
    const { db, appliedMigrations } = openDatabase(dbPath)
    assert.deepEqual(appliedMigrations, ['001_init.sql'])
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name)
    for (const expected of ['malls', 'floors', 'robots', 'tasks', 'maintenance_events', 'schema_migrations']) {
      assert.ok(tables.includes(expected), `缺少表 ${expected}`)
    }
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('迁移幂等：重复打开同一数据库不再应用已执行迁移，数据保持', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cleanbot-mig-'))
  try {
    const dbPath = join(dir, 'app.db')
    const first = openDatabase(dbPath)
    first.db.prepare('INSERT INTO malls (name, created_at) VALUES (?, ?)').run('持久商场', new Date().toISOString())
    first.db.close()

    const second = openDatabase(dbPath)
    assert.deepEqual(second.appliedMigrations, [])
    const count = second.db.prepare('SELECT COUNT(*) AS n FROM malls').get()
    assert.equal(count.n, 1, '重复打开不应破坏既有数据')
    const versions = second.db.prepare('SELECT version FROM schema_migrations').all()
    assert.deepEqual(versions.map((v) => v.version), ['001_init.sql'])
    second.db.close()

    // 直接重复调用 applyMigrations 亦为幂等
    const third = openDatabase(dbPath)
    assert.deepEqual(applyMigrations(third.db, DEFAULT_MIGRATIONS_DIR), [])
    third.db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('外键约束已启用', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cleanbot-mig-'))
  try {
    const { db } = openDatabase(join(dir, 'app.db'))
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1)
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
