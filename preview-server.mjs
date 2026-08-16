// 预览静态服务器：http://127.0.0.1:4173/ → preview.html + preview.js
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const port = Number(process.env.PREVIEW_PORT ?? 4173)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

http
  .createServer(async (req, res) => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
    const relative = pathname === '/' ? '/preview.html' : pathname
    const full = normalize(join(root, relative))
    if (!full.startsWith(root)) {
      res.writeHead(403).end('forbidden')
      return
    }
    try {
      const data = await readFile(full)
      res.writeHead(200, { 'Content-Type': types[extname(full)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found')
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`DSH 用户端预览已启动：http://127.0.0.1:${port}/`)
  })
