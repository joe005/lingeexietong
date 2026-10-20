import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 版本化 SQL 迁移执行器。
 *
 * 约定（架构基线 §4）：
 * - migrations/ 目录下按序号命名的 SQL 文件（自 001_init.sql 起），文件名字典序即应用序；
 * - schema_migrations 记录已应用版本；
 * - 服务启动时在事务中应用未执行的迁移（每个迁移一个原子事务）；
 * - 禁止 ORM 自动同步与运行时手工改 schema。
 */

const MIGRATION_FILE_PATTERN = /^\d+.*\.sql$/

/** 列出迁移目录中按文件名排序的 SQL 迁移文件名。 */
export function listMigrationFiles(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (err) {
    throw new Error(`无法读取迁移目录 ${dir}: ${err.message}`)
  }
  return entries
    .filter((name) => MIGRATION_FILE_PATTERN.test(name))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function ensureSchemaMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)
}

/**
 * 应用未执行的迁移。返回本次实际应用的版本列表。
 * 每个迁移在独立事务中执行（含写入 schema_migrations 记录），失败即整体回滚该迁移。
 */
export function applyMigrations(db, dir, { now = () => new Date().toISOString() } = {}) {
  ensureSchemaMigrationsTable(db)
  const files = listMigrationFiles(dir)
  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all()
  const appliedSet = new Set(appliedRows.map((row) => row.version))

  const selectVersion = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
  const recordVersion = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
  const runOne = db.transaction((file) => {
    const sql = readFileSync(join(dir, file), 'utf8')
    db.exec(sql)
    recordVersion.run(file, now())
  })

  const newlyApplied = []
  for (const file of files) {
    if (appliedSet.has(file) || selectVersion.get(file)) continue
    runOne(file)
    newlyApplied.push(file)
  }
  return newlyApplied
}
