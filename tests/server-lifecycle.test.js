import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from './helpers.js'

/** 以隔离 DB_PATH 与随机空闲端口（PORT=0）启动真实服务，返回受控进程句柄。 */
function startServer(dbPath) {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: '0', DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stdoutChunks = []
  const stderrChunks = []
  child.stdout.on('data', (chunk) => stdoutChunks.push(String(chunk)))
  child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)))

  const portPromise = new Promise((resolvePort, rejectPort) => {
    const timer = setTimeout(() => rejectPort(new Error('服务启动超时（15s）')), 15000)
    function poll() {
      const text = stdoutChunks.join('')
      const match = text.match(/服务已启动: http:\/\/localhost:(\d+)/)
      if (match) {
        clearTimeout(timer)
        resolvePort(Number(match[1]))
        return
      }
      if (child.exitCode !== null) {
        clearTimeout(timer)
        rejectPort(new Error(`服务提前退出（code=${child.exitCode}）：${stderrChunks.join('') || stdoutChunks.join('')}`))
        return
      }
      setTimeout(poll, 50)
    }
    poll()
  })

  const exited = new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }))
  })

  async function stop() {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
      const result = await Promise.race([
        exited,
        new Promise((resolveTimeout) => setTimeout(() => resolveTimeout({ code: null, signal: 'timeout' }), 8000)),
      ])
      if (result.signal === 'timeout') child.kill('SIGKILL')
      return result
    }
    return { code: child.exitCode, signal: null }
  }

  return { child, portPromise, stop, getStderr: () => stderrChunks.join('') }
}

async function waitForApi(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/stats`)
      if (res.ok) return await res.json()
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  throw new Error(`API 就绪等待超时: ${lastError?.message}`)
}

test('真实服务生命周期：启动→迁移→API→停机→数据持久化→重启幂等', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cleanbot-lifecycle-'))
  const dbPath = join(dir, 'nested', 'app.db') // 验证 DB_PATH 父目录自动创建
  let server
  try {
    server = startServer(dbPath)
    const port = await server.portPromise

    // 启动即完成迁移并就绪
    const initialStats = await waitForApi(port)
    assert.equal(initialStats.stats.totals.malls, 0)

    // 真实 HTTP 写入与读回
    const created = await fetch(`http://127.0.0.1:${port}/api/malls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '商场A' }),
    })
    assert.equal(created.status, 201)
    const mall = (await created.json()).mall
    assert.equal(mall.name, '商场A')

    const listRes = await fetch(`http://127.0.0.1:${port}/api/malls`)
    const list = await listRes.json()
    assert.equal(list.malls.length, 1)

    // API 未知路径返回契约 404 JSON；public/ 缺失时非 /api 路径为普通 404
    const apiUnknown = await fetch(`http://127.0.0.1:${port}/api/unknown`)
    assert.equal(apiUnknown.status, 404)
    assert.equal((await apiUnknown.json()).error.code, 'NOT_FOUND')
    const home = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(home.status, 404)

    // 优雅停机（SIGTERM，退出码 0）
    const stopped = await server.stop()
    assert.equal(stopped.code, 0, `服务应正常退出（signal=${stopped.signal}）stderr=${server.getStderr()}`)
    server = null

    // 重启同一数据库：迁移幂等、数据仍在
    const second = startServer(dbPath)
    try {
      const port2 = await second.portPromise
      const stats = await waitForApi(port2)
      assert.equal(stats.stats.totals.malls, 1, '重启后数据持久')
      const again = await fetch(`http://127.0.0.1:${port2}/api/malls`)
      const body = await again.json()
      assert.equal(body.malls[0].name, '商场A')
    } finally {
      const stop2 = await second.stop()
      assert.equal(stop2.code, 0)
    }
  } finally {
    if (server) await server.stop()
    rmSync(dir, { recursive: true, force: true })
  }
})
