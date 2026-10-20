#!/usr/bin/env node
/**
 * 开发期并行启动辅助脚本：
 * - 后端：node src/server.js（PORT 透传，默认 3000）；
 * - 前端：frontend/ 存在时并行启动其 dev server（Vite，将 /api 代理至后端）；
 *   不存在时仅启动后端并提示。
 * 任一子进程退出即整体退出（SIGINT/SIGTERM 传递给全部子进程）。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontendPkg = resolve(rootDir, 'frontend', 'package.json')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const children = []

function start(what, command, args, { env = {} } = {}) {
  console.log(`[dev] 启动 ${what}: ${command} ${args.join(' ')}`)
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  child.on('exit', (code, signal) => {
    console.log(`[dev] ${what} 已退出（code=${code}, signal=${signal}）`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

let shuttingDown = false
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('后端服务', process.execPath, ['src/server.js'])

if (existsSync(frontendPkg)) {
  start('前端 dev server', npmCommand, ['--prefix', 'frontend', 'run', 'dev'])
} else {
  console.log('[dev] frontend/ 不存在，仅启动后端 API（http://localhost:' + (process.env.PORT ?? 3000) + '/api）')
}
