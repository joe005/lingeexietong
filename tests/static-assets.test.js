import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestEnv, req } from './helpers.js'

const INDEX_HTML = '<!doctype html><html><body>cleanbot spa</body></html>'

test('public/ 存在时托管构建产物并支持 SPA 客户端路由回退', async () => {
  const env = createTestEnv({
    withPublic: {
      'index.html': INDEX_HTML,
      'assets/app.js': 'console.log("app")',
    },
  })
  try {
    const { app } = env

    // 首页命中 index.html
    const home = await app.request('/')
    assert.equal(home.status, 200)
    assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(await home.text(), INDEX_HTML)

    // 静态资源命中
    const asset = await app.request('/assets/app.js')
    assert.equal(asset.status, 200)
    assert.equal(asset.headers.get('content-type'), 'text/javascript; charset=utf-8')
    assert.equal(await asset.text(), 'console.log("app")')

    // SPA 客户端路由（无对应文件）回退 index.html，而非 404
    for (const route of ['/malls', '/monitor', '/tasks', '/maintenance', '/analytics', '/robot-sim']) {
      const res = await app.request(route)
      assert.equal(res.status, 200, `${route} 应回退 index.html`)
      assert.equal(await res.text(), INDEX_HTML)
    }

    // /api 404 不被 SPA 回退改写
    const api404 = await app.request('/api/unknown')
    assert.equal(api404.status, 404)
    assert.equal((await api404.json()).error.code, 'NOT_FOUND')

    // API 正常工作
    const stats = await req(app, 'GET', '/api/stats')
    assert.equal(stats.status, 200)
  } finally {
    env.cleanup()
  }
})

test('路径穿越被拒绝（不逃出托管目录）', async () => {
  const env = createTestEnv({ withPublic: { 'index.html': INDEX_HTML } })
  try {
    for (const path of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/package.json']) {
      const res = await env.app.request(path)
      // 逃逸路径不返回项目文件（回退 index.html 或 404，均非 package.json 内容）
      const body = await res.text()
      assert.ok(!body.includes('"dependencies"'), `${path} 不应读到项目文件`)
    }
  } finally {
    env.cleanup()
  }
})

test('public/ 不存在时服务仅提供 API，非 /api 路径 404', async () => {
  const env = createTestEnv()
  try {
    const stats = await req(env.app, 'GET', '/api/stats')
    assert.equal(stats.status, 200)

    const home = await env.app.request('/')
    assert.equal(home.status, 404)
    assert.equal(await home.text(), 'Not Found')
  } finally {
    env.cleanup()
  }
})
