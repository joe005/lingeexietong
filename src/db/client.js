import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { applyMigrations } from './migrate.js'
import { DEFAULT_MIGRATIONS_DIR } from './defaults.js'

/**
 * 打开（并按需初始化）SQLite 数据库：
 * 1. 自动创建 DB_PATH 的父目录（干净目录启动无需人工准备）；
 * 2. 开启外键与 WAL，设置忙等待超时；
 * 3. 在事务中应用未执行的版本化迁移。
 */
export function openDatabase(dbPath, { migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}) {
  const absPath = resolve(dbPath)
  mkdirSync(dirname(absPath), { recursive: true })
  const db = new Database(absPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  const applied = applyMigrations(db, resolve(migrationsDir))
  return { db, path: absPath, appliedMigrations: applied }
}
