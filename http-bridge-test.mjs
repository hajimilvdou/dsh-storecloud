import http from 'node:http'
import assert from 'node:assert/strict'
import { httpBridge } from './packages/client/dist/ui/bridge.js'

/**
 * httpBridge 集成测试：不依赖真实外网，用两个本地假服务验证
 * GitHub 登录态 / 内置源 / 源添加与切源 / 云端插件与订阅组同步。
 */
const mem = () => {
  const m = new Map()
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    set: async (k, v) => m.set(k, v),
    remove: async (k) => m.delete(k),
  }
}

const pluginA = { id: 'p-a', version: '1.0.0', name: 'p-a', description: 'A', repo: 'o/a', repo_url: 'https://github.com/o/a', source: 'community', stars: 1, stars_delta_day: 0, trending_rank: null, likes: 0, downloads_7d: 0, quality_score: 50, tags: [], compat: 'dsh>=0', install: 'p-a', is_new: false, security: { level: 0, score: 50, risk_tags: [], blocked: false }, status: 'listed', updated_at: '' }
const pluginB = { ...pluginA, id: 'p-b', name: 'p-b', repo: 'o/b', repo_url: 'https://github.com/o/b', install: 'p-b' }
const combo = { id: 's1:c1', slug: 'c1', name: 'c1', description: 'combo', members: [{ pkg: 'p-b', version: '*' }], author: 'alice', author_github: 'alice', likes: 0, downloads_7d: 0, status: 'published', origin_server: 's1', version: 1, updated_at: '' }
const manifest = () => ({
  protocol_version: '1.0.0', software_version: '1.0.0', cluster_id: null, server_time: new Date().toISOString(),
  plugins_revision: '1', combos_revision: '1', latest_announcement_id: null,
  features: { trending: true, likes: true, combos: true, announcements: true, federation: false },
  nodes: [], client_plugin: null,
  client_config: { trending_size: 20, search_threshold: 0.4, onboarding_auto_open_times: 3, server_local_port: 0, ui_default_theme: 'system', ui_window_min: [360, 480], ui_window_max: [720, 900], data_heartbeat_min: 30, combos_refresh_min: 30, restore_max_points: 10, combo_limit: 3 },
})

function serve({ plugins, initialCloud }) {
  return new Promise((resolve) => {
    let cloud = initialCloud
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x')
      res.setHeader('Content-Type', 'application/json')
      if (url.pathname === '/health') return res.end(JSON.stringify({ ok: true }))
      if (url.pathname === '/api/v1/manifest') return res.end(JSON.stringify(manifest()))
      if (url.pathname === '/api/v1/plugins') return res.end(JSON.stringify({ revision: '1', items: plugins, full: true, tombstones: [] }))
      if (url.pathname === '/api/v1/combos') return res.end(JSON.stringify({ revision: '1', items: [combo], full: true, tombstones: [] }))
      if (url.pathname === '/api/v1/announcements') return res.end(JSON.stringify([]))
      if (url.pathname === '/api/v1/me/installs') {
        if (req.method === 'GET') return res.end(JSON.stringify(cloud))
        if (req.method === 'PUT') {
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            const parsed = JSON.parse(body)
            cloud = parsed.installs ?? []
            res.end(JSON.stringify(cloud))
          })
          return
        }
      }
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'not_found' }))
    })
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
}

function serveRpc() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json')
        const url = new URL(req.url, 'http://x')
        if (url.pathname === '/dsh-store/http') {
          // 模拟 host 半代理：把 {url, method, headers, body} 转发到目标服务器
          const j = JSON.parse(body)
          fetch(j.url, { method: j.method, headers: j.headers, body: j.body || undefined })
            .then(async (r) => {
              const text = await r.text()
              res.end(JSON.stringify({ status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' }, body: text }))
            })
            .catch((e) => res.end(JSON.stringify({ status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: String((e && e.message) || e) })))
          return
        }
        // 其他路径 = 本地安装 RPC（install/uninstall/installed 等）
        res.end(JSON.stringify({ ok: true, message: 'ok', output: '' }))
      })
    })
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }))
  })
}

const token = `h.${Buffer.from(JSON.stringify({ login: 'alice', name: null })).toString('base64url')}.s`
const tokenStore = { current: token }
const rpc = await serveRpc()
const first = await serve({ plugins: [pluginA], initialCloud: [{ target: 'p-cloud', type: 'plugin', version: '1.0.0' }, { target: 'c-cloud', type: 'combo', version: '1' }] })
const base1 = `http://127.0.0.1:${first.port}`
const bridge = httpBridge({ baseUrl: base1, tokenStore, sourceStore: mem(), rpcBase: `http://127.0.0.1:${rpc.port}/dsh-store/rpc` })

const s0 = await bridge.bootstrap()
// bootstrap 为「缓存秒开 + 后台同步」设计：登录态经乐观恢复立即生效，
// 完整数据（云端清单等）在后台 load 完成后经 subscribe 通知；测试用 refresh 等待就绪。
assert.equal(s0.account.login, 'alice', 'GitHub token 登录态应生效（乐观恢复）')
const s1 = await bridge.refresh()
assert.equal(s1.account.login, 'alice', 'GitHub token 登录态应生效')
assert.equal(s1.sources.some((x) => x.url === base1 && x.builtin && x.role === 'primary'), true, '内置源应出现在源列表并为主源')
assert.deepEqual(s1.cloud.plugins, ['p-cloud'], '登录后应拉取云端插件清单')
assert.deepEqual(s1.cloud.combos, ['c-cloud'], '登录后应拉取云端订阅组清单')

await bridge.install('p-a')
const c1 = await bridge.pushCloud()
assert.ok(c1.plugins.includes('p-a'), '上传后云端插件应包含新装插件')
await bridge.installCombo('c1')
const c2 = await bridge.pushCloud()
assert.ok(c2.combos.includes('c1'), '安装组合后云端订阅组应同步')

const second = await serve({ plugins: [pluginB], initialCloud: [] })
const base2 = `http://127.0.0.1:${second.port}`
const sources1 = await bridge.addSource(base2, '')
assert.ok(sources1.some((x) => x.url === base2 && x.status === 'connected'), '新增源应通过 /health 校验并显示已连接')
const custom = sources1.find((x) => x.url === base2)
const s2 = await bridge.switchSource(custom.id)
assert.equal(s2.plugins[0].id, 'p-b', '切源后应拉取新源数据')
assert.ok(s2.sources.some((x) => x.url === base1 && x.builtin && x.role === 'backup'), '切源后原默认源应保留在候选列表')

first.srv.close()
second.srv.close()
rpc.srv.close()
console.log('✅ httpBridge 集成测试通过：GitHub 登录态 / 内置源 / 源添加 / 切源 / 云端插件与订阅组')
