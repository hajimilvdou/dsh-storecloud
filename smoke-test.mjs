// 冒烟测试：验证 shared 契约 + client core 纯函数 + MockDataSource + StoreClient 编排
import assert from 'node:assert/strict'
import { PROTOCOL_VERSION, SOFTWARE_NAME, API } from './packages/shared/dist/index.js'
import {
  topTrending,
  sortPlugins,
  searchPlugins,
  computeBadge,
  detectPluginUpdates,
  missingFromLibrary,
} from './packages/client/dist/core/index.js'
import { MockDataSource, MOCK_PLUGINS, MOCK_COMBOS } from './packages/client/dist/data/mock.js'
import { StoreClient } from './packages/client/dist/host.js'
import { Ledger } from './packages/client/dist/store/ledger.js'

// 1) 契约常量
assert.equal(PROTOCOL_VERSION, '1.0.0')
assert.equal(SOFTWARE_NAME, 'dsh-store')
assert.equal(API.manifest, '/api/v1/manifest')

// 2) 趋势榜：按日增降序，跳过 is_new
const trending = topTrending(MOCK_PLUGINS, 5)
assert.equal(trending.length, 5)
assert.ok(trending[0].stars_delta_day >= trending[1].stars_delta_day)
assert.ok(trending.every((p) => !p.is_new))

// 3) 排序
const byStars = sortPlugins(MOCK_PLUGINS, 'stars')
assert.ok(byStars[0].stars >= byStars[1].stars)

// 4) 搜索
const hits = searchPlugins(MOCK_PLUGINS, 'memory')
assert.ok(hits.length >= 1)
assert.equal(hits[0].id, 'dsh-memory')
assert.ok(searchPlugins(MOCK_PLUGINS, '记忆').some((p) => p.id === 'dsh-memory'), '中文简介应命中')
assert.ok(searchPlugins(MOCK_PLUGINS, 'memry').some((p) => p.id === 'dsh-memory'), '错拼应容错命中')
assert.ok(searchPlugins(MOCK_PLUGINS, 'liwei').every((p) => p.author === 'liwei'), '按作者搜索')

// 5) 通知 + 角标
const updates = detectPluginUpdates(
  [{ pkg: 'dsh-memory', version: '0.3.1', installed_at: '', source: 'single', combo_id: null, restore_point_id: null }],
  MOCK_PLUGINS,
)
assert.ok(updates.length >= 1, '应检出 dsh-memory 有更新')
const badge = computeBadge(updates, true)
assert.equal(badge.announcement, true)
assert.ok(badge.pending_count >= 1)

// 6) StoreClient 编排（内存存储 + no-op adapter）
const store = new Map()
const memStore = {
  async get(k) { return store.has(k) ? store.get(k) : null },
  async set(k, v) { store.set(k, v) },
  async remove(k) { store.delete(k) },
}
const ledger = new Ledger(memStore, 'smoke')
const adapter = {
  kind: 'headless',
  async mount() {},
  openPanel() {},
  closePanel() {},
  notify() {},
  setBadge() {},
  dispose() {},
}
const client = new StoreClient(new MockDataSource(), ledger, adapter)
await client.start()
assert.equal(client.listPlugins().length, MOCK_PLUGINS.length)
assert.equal(client.listCombos().length, MOCK_COMBOS.length)
assert.equal(client.getTrending().length, MOCK_PLUGINS.filter((p) => !p.is_new).length)
assert.equal(client.searchPlugins('memory')[0].id, 'dsh-memory')

// 7) 安装 → 台账写入
await client.install('dsh-memory')
assert.equal(client.ledger.listInstalls().length, 1)
assert.equal(client.ledger.listInstalls()[0].pkg, 'dsh-memory')

// 8) UI 桥接（mockBridge）：bootstrap / install / uninstall 走真实 MockDataSource + Ledger
const { mockBridge } = await import('./packages/client/dist/ui/bridge.js')
const bridge = mockBridge()
const s = await bridge.bootstrap()
assert.equal(s.plugins.length, MOCK_PLUGINS.length)
assert.equal(s.combos.length, MOCK_COMBOS.length)
assert.equal(s.announcements.length, 4)
assert.ok(Object.keys(s.installed).length >= 6)
const afterInstall = await bridge.install('dsh-vision')
assert.equal(afterInstall['dsh-vision'], '1.0.0')
const afterUninstall = await bridge.uninstall('dsh-vision')
assert.ok(!afterUninstall['dsh-vision'])

// 9) 发布组合前的库内校验（v3.1 S6：自制未上传插件必须剔除）
assert.deepEqual(missingFromLibrary(['dsh-memory', 'my-custom-tool'], MOCK_PLUGINS), ['my-custom-tool'])
assert.deepEqual(missingFromLibrary(['dsh-memory', 'dsh-skins'], MOCK_PLUGINS), [])

// 10) 库外插件上报（登录）
const rep = await bridge.reportMissing('my-local-tool', 'github.com/liwei/my-local-tool', '0.1.0')
assert.equal(rep.ok, true)
assert.ok(rep.message.includes('上报'))

console.log('✅ 冒烟测试全部通过')
