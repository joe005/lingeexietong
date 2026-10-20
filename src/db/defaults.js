import { fileURLToPath } from 'node:url'

/** 项目内 SQL 迁移目录（不依赖进程 cwd，从任意目录启动均可定位）。 */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url))

/** 默认数据库文件（相对进程 cwd，可用环境变量 DB_PATH 覆盖）。 */
export const DEFAULT_DB_PATH = './data/cleanbot-ops.db'

/** 默认监听端口（可用环境变量 PORT 覆盖）。 */
export const DEFAULT_PORT = 3000

/** 前端构建产物静态托管目录（相对进程 cwd；T02 前端构建输出至根 public/）。 */
export const DEFAULT_PUBLIC_DIR = './public'
