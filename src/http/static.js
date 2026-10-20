import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

/**
 * 静态托管前端构建产物目录（默认 public/）：
 * - 目录不存在时服务正常启动并仅提供 API（createApp 决定是否挂载本中间件）；
 * - 命中文件按扩展名返回，目录回退 index.html；
 * - SPA 客户端路由：非 /api 的 GET 未命中文件时回退 index.html（存在时）；
 * - 路径规范化后必须仍在托管目录内，阻止目录穿越。
 */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function statIfExists(filePath) {
  try {
    return statSync(filePath)
  } catch {
    return null
  }
}

/** 静态文件中间件：命中文件返回，否则放行给后续路由/fallback。 */
export function createStaticMiddleware({ root }) {
  const rootDir = resolve(root)
  return async (c, next) => {
    if (c.req.method !== 'GET') return next()
    const url = new URL(c.req.url)
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return next()
    }
    if (pathname.includes('\0')) return next()

    const filePath = normalize(join(rootDir, pathname))
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) return next()

    let target = filePath
    let stat = statIfExists(target)
    if (stat && stat.isDirectory()) {
      target = join(target, 'index.html')
      stat = statIfExists(target)
    }
    if (!stat || !stat.isFile()) return next()

    const contentType = MIME_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream'
    const body = await readFile(target)
    return c.body(body, 200, { 'Content-Type': contentType })
  }
}

/** SPA fallback：非 /api 的 GET 在响应为 404 时改写为 index.html（存在时）。 */
export function createSpaFallback({ root }) {
  const indexFile = join(resolve(root), 'index.html')
  return async (c, next) => {
    await next()
    if (c.req.method !== 'GET') return
    if (c.req.path === '/api' || c.req.path.startsWith('/api/')) return
    if (c.res.status !== 404) return
    if (!existsSync(indexFile)) return
    const html = await readFile(indexFile)
    c.res = new Response(html, {
      status: 200,
      headers: { 'Content-Type': MIME_TYPES['.html'] },
    })
  }
}
