#!/usr/bin/env node
/**
 * 聚合构建：调用 frontend/ 子包构建（Vite 产物输出至根 public/）。
 * 根 package.json 是配置唯一 owner；本脚本负责聚合调度：
 * - frontend/ 存在 → `npm --prefix frontend run build`；
 * - frontend/ 不存在（本阶段后端先行交付）→ 跳过前端构建并成功退出，
 *   服务端为 Node.js 直运行、无需构建，保证干净目录 `npm install && npm run build && npm start` 可运行。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontendPkg = resolve(rootDir, 'frontend', 'package.json')

if (!existsSync(frontendPkg)) {
  console.log('[build] frontend/ 子包不存在，跳过前端构建（服务端无需构建，直接 npm start 运行）')
  process.exit(0)
}

console.log('[build] 构建前端子包（frontend/ → public/）…')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npmCommand, ['--prefix', 'frontend', 'run', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
})
if (result.error) {
  console.error('[build] 无法启动前端构建:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
