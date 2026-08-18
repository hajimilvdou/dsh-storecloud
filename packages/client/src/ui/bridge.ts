import { API, type Announcement, type Combo, type Delta, type InstallRecord, type Plugin, type ServerSource } from '@dsh-store/shared'
import { MOCK_SOURCES, MockDataSource } from '../data/mock.js'
import { HttpDataSource, type FetchLike } from '../data/http.js'
import { isUpdateAvailable } from '../core/versions.js'
import { Ledger, type KeyValueStore } from '../store/ledger.js'
import { DSH_STORE_VERSION } from '../generated-version.js'

/**
 * 客户端 UI 与数据层之间的桥接接口（transport 无关）：
 * - 生产：Client 半通过 host RPC 实现此接口，数据来自 Host 的 StoreClient；
 * - 预览/测试：用 mockBridge() 直接跑 MockDataSource + Ledger。
 */
export interface AccountInfo {
  login: string
  name: string | null
  registered_at: string
  combo_quota: string
}

export interface CloudList {
  plugins: string[]
  combos: string[]
  /** 云端已保存的 Agent（kind=preset 的市场条目 id）。 */
  agents: string[]
}

export interface StoreState {
  plugins: Plugin[]
  combos: Combo[]
  announcements: Announcement[]
  /** 已安装清单：包名 → 安装版本。 */
  installed: Record<string, string>
  /** 订阅关系：组合名 → 是否订阅。 */
  subscriptions: Record<string, boolean>
  /** 我已点赞的目标：target（插件包名 / 组合联邦 id）→ 是否已赞（登录后初始化，点赞/取消即时更新）。 */
  liked: Record<string, boolean>
  sources: ServerSource[]
  account: AccountInfo
  cloud: CloudList
  /** 当前数据主源（含代理前缀），登录链接与源展示以它为准。 */
  serverUrl: string
  /** 已确认的更新提醒：包名 → 已确认版本（同一版本只提醒一次，新版本重新提醒）。 */
  acked: Record<string, string>
  /** 客户端插件版本推送（服务端下发；与本地 CLIENT_PLUGIN_VERSION 比对提示更新）。 */
  clientPlugin: { version: string; install: string } | null
  /** 服务端下发的数据心跳间隔（分钟，默认 30）；客户端据此周期重拉 bootstrap。 */
  heartbeatMin: number
  /** 插件组审核开关：true=发布需审核；false=发布直接上线。缺省 true(保守)。 */
  comboReviewEnabled: boolean
  /** 趋势榜条数(服务端下发,缺省 20)。 */
  trendingSize: number
  /** 功能开关(管理端配置中心下发)：趋势榜/组合/公告。 */
  features: { trending: boolean; combos: boolean; announcements: boolean }
  /** 最近一次数据同步结果：null=成功；非空=失败原因（界面显示横幅 + 重试）。 */
  syncError: string | null
  /** 是否正在联网同步（load 进行中）：用于"正在连接"横幅的显示时机。 */
  syncing: boolean
  /**
   * 客户端插件真实安装版本：优先来自 host 半 /version RPC（读已装包 package.json，git/npm/tgz
   * 安装都准确）；RPC 不可用时回落构建注入的 DSH_STORE_VERSION。更新判断以它为准。
   */
  clientVersion: string
}

/**
 * 客户端插件（商城面板）自身版本（构建时从根 package.json 注入，版本号单点事实来源）。
 * 运行时真实版本经 host 半 /version RPC 获取（见 StoreState.clientVersion）。
 */
export const CLIENT_PLUGIN_VERSION = DSH_STORE_VERSION

export interface StoreBridge {
  bootstrap(): Promise<StoreState>
  /** 仅本机快速恢复（读缓存/台账，不联网、不启动后台同步）：预览首帧秒开用，
   *  毫秒级返回，避免进商城黑屏；后续由 bootstrap() 补全/启动后台同步。 */
  bootstrapLocal(): Promise<StoreState>
  /** 强制重拉服务端数据（周期心跳用；与 bootstrap 结果同构）。 */
  refresh(): Promise<StoreState>
  /**
   * 组合在线刷新（组合在线模式）：打开组合页/组合操作后调用——
   * 直接向服务器拉取组合全量（会话内 60s 复用，覆盖任何本地缓存），
   * 保证「我的组合/推荐组合」始终是服务器权威数据，不依赖本地持久缓存与 revision 增量。
   */
  refreshCombos(): Promise<StoreState>
  /**
   * 订阅数据变化：bootstrap 的后台全量/增量同步、refresh、换源等完成后通知。
   * 返回取消订阅函数。HTTP 桥接在后台同步完成后调用；未实现时可省略。
   */
  subscribe?(cb: (s: StoreState) => void): () => void
  /** 把本地已装插件 + 订阅组上传为云端清单（登录时可用），返回最新云端清单。 */
  pushCloud(): Promise<CloudList>
  install(pkg: string): Promise<Record<string, string>>
  /** 点赞 / 取消点赞（登录）：切换式，返回最新计数与是否已赞。 */
  like(pkg: string): Promise<{ count: number; liked: boolean }>
  /** 安装 Agent(Preset)：Host 侧负责复制到 ~/.dsh/.agent-presets/<presetName>。 */
  installPreset(pkg: string, presetName?: string): Promise<Record<string, string>>
  uninstall(pkg: string): Promise<Record<string, string>>
  update(pkg: string): Promise<Record<string, string>>
  installCombo(name: string): Promise<{ installed: Record<string, string>; subscriptions: Record<string, boolean>; manual: ManualInstallItem[] }>
  unsubscribe(name: string): Promise<{ installed: Record<string, string>; subscriptions: Record<string, boolean> }>
  removeAnnouncement(id: string): Promise<Announcement[]>
  addSource(url: string, password: string): Promise<ServerSource[]>
  removeSource(id: string): Promise<ServerSource[]>
  pingSource(id: string): Promise<ServerSource[]>
  /** 切换主源：数据层改从该源拉取并全量重载（本地台账与登录态保留）。 */
  switchSource(id: string): Promise<StoreState>
  addCombo(name: string, desc: string, members: ComboMemberInput[]): Promise<Combo[]>
  /** 编辑自己的组合（名称/描述/成员）。 */
  updateCombo(id: string, name: string, desc: string, members: ComboMemberInput[]): Promise<Combo[]>
  /** 删除自己的组合（仅作者本人）。 */
  removeCombo(id: string): Promise<Combo[]>
  /** 库外插件上报（登录）：提交后进管理端"待确认"清单。 */
  reportMissing(pkg: string, repoUrl: string | null, version: string): Promise<{ ok: boolean; message: string }>
  restorePlugins(plugins: string[]): Promise<{ installed: Record<string, string>; subscriptions: Record<string, boolean> }>
  restoreSubscriptions(combos: string[]): Promise<{ installed: Record<string, string>; subscriptions: Record<string, boolean> }>
  /** 从云端恢复已装 Agent（按市场条目 id，多键匹配去重；rpc /preset 安装）。 */
  restoreAgents(agents: string[]): Promise<{ installed: Record<string, string>; subscriptions: Record<string, boolean> }>
  /** 手动挑选上传（服务端 meInstalls 是全量替换语义 → 合并"云端已有 + 所选新增"后整体 PUT），
   *  让用户决定哪些插件/Agent/组合进云端，而不必全量上传。 */
  uploadSelected(scope: { plugins?: string[]; agents?: string[]; combos?: string[] }): Promise<CloudList>
  /** 从云端删除指定项（仅移除云端清单，不影响本地安装）；服务端全量替换语义 → 云端剩余项整体 PUT。 */
  deleteFromCloud(scope: { plugins?: string[]; agents?: string[]; combos?: string[] }): Promise<CloudList>
  ackUpdate(pkg: string): Promise<Record<string, string>>
  ackAll(): Promise<Record<string, string>>
  /** 客户端插件自身在线更新：复用插件更新机制 = dsh plugin add <spec>@<version>。 */
  updateClientPlugin(spec: string, version: string): Promise<{ ok: boolean; message: string }>
  /** 注销账号（联动服务器清理点赞/云端清单；组合删除或匿名保留）。 */
  deleteAccount(combos: 'delete' | 'anonymize'): Promise<{ ok: boolean; message: string }>
}

/** 手动安装项：组合一键安装时跳过,交由用户逐个打开插件页面安装。 */
export interface ManualInstallItem {
  pkg: string
  /** 插件展示名（查不到用包名）。 */
  name: string
  /** 打开地址：插件仓库页,无则 GitHub 搜索页兜底。 */
  url: string
}

/** 组合成员输入：包名字符串(全 auto)或 {pkg, install_mode} 对象。 */
export type ComboMemberInput = string | { pkg: string; install_mode?: 'auto' | 'manual' }

/** Agent 安装状态（多键匹配）：市场条目的 id 可能与实际安装 key（包名/仓库短名/预设名）不一致，
 *  依次尝试 id / name / preset_name / 仓库短名，命中返回该安装 key；全部未命中返回 null（未安装）。
 *  保证「本地装了、市场里有」的条目一定能正确识别（Agent 库显示 / 云端上传去重 / 恢复跳过）。 */
export function agentInstalledKey(a: Plugin, installed: Record<string, string>): string | null {
  const cands = [a.id, a.name, a.preset_name, a.repo ? a.repo.split('/').pop() ?? '' : '']
  const seen = new Set<string>()
  for (const k of cands) {
    if (!k || seen.has(k)) continue
    seen.add(k)
    if (installed[k]) return k
  }
  return null
}

/** 缓存压缩（保留完整字段，解决全量数据超 localStorage 配额）：
 *  gzip 压缩后 base64 存储，`gz:` 前缀标记。
 *  环境适配：浏览器(CompressionStream) / 打包应用端(Chromium/WebKit WebView 也有) /
 *  老内核或无 web API 的 Node 壳（无 Blob/Response/CompressionStream）→ 自动检测并回落原始 JSON。
 *  任一环节失败都不抛错、不阻塞会话，仅本次不写入缓存。 */
function hasWebCompression(): boolean {
  try {
    if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') return false
    // 试跑一次，确保 Blob/Response 管道在宿主环境可用（打包端裁剪内核可能只拆其一）
    const c = new CompressionStream('gzip')
    void new Blob([]).stream().pipeThrough(c)
    return true
  } catch {
    return false
  }
}
function toBase64(u8: Uint8Array): string {
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode(...Array.from(u8.subarray(i, i + CH)))
  if (typeof btoa === 'function') return btoa(bin)
  const buf = (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (e: string) => string } } }).Buffer
  if (buf && typeof buf.from === 'function') return buf.from(bin, 'binary').toString('base64')
  throw new Error('base64 unsupported')
}
function fromBase64(s: string): string {
  if (typeof atob === 'function') return atob(s)
  const buf = (globalThis as { Buffer?: { from: (s: string, enc: 'base64') => { toString: (e: 'latin1') => string } } }).Buffer
  if (buf && typeof buf.from === 'function') return buf.from(s, 'base64').toString('latin1')
  throw new Error('base64 unsupported')
}
async function cacheCompress(s: string): Promise<string> {
  if (!hasWebCompression()) return s
  try {
    const stream = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))
    const buf = new Uint8Array(await new Response(stream).arrayBuffer())
    return 'gz:' + toBase64(buf)
  } catch {
    return s
  }
}
async function cacheDecompress(raw: string): Promise<string> {
  if (!raw.startsWith('gz:')) return raw
  if (!hasWebCompression()) return raw
  try {
    const bytes = Uint8Array.from(fromBase64(raw.slice(3)), (c) => c.charCodeAt(0))
    return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
  } catch {
    return raw
  }
}

/** 内存 KV 存储（mock 用）。 */
function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return {
    get: async (k) => (m.has(k) ? (m.get(k) as string) : null),
    set: async (k, v) => {
      m.set(k, v)
    },
    remove: async (k) => {
      m.delete(k)
    },
  }
}

function toInstalledMap(ledger: Ledger): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of ledger.listInstalls()) out[r.pkg] = r.version
  return out
}

function latestVersion(plugins: Plugin[], pkg: string): string {
  return plugins.find((x) => x.id === pkg)?.version ?? '1.0.0'
}

/** mock 桥接：真实走 MockDataSource + Ledger，与 StoreClient 的数据流一致。 */
export function mockBridge(): StoreBridge {
  const source = new MockDataSource()
  const ledger = new Ledger(memoryStore(), 'dsh-store:mock')
  let plugins: Plugin[] = []
  let combos: Combo[] = []
  let announcements: Announcement[] = []
  const subscriptions: Record<string, boolean> = { 新手启航包: true }
  let sources: ServerSource[] = [...MOCK_SOURCES]
  const account: AccountInfo = { login: 'liwei', name: '李伟', registered_at: '2026-08-13', combo_quota: '2/3' }
  let cloud: CloudList = { plugins: ['dsh-memory', 'dsh-checkpoint', 'dsh-session-search', 'dsh-web-ui', 'dsh-skins', 'dsh-pet'], combos: ['新手启航包', '前端摸鱼套装'], agents: [] }
  const acked: Record<string, string> = {}
  const likedSet = new Set<string>()
  let clientPlugin: { version: string; install: string } | null = null
  let heartbeatMin = 30
  let comboReviewEnabled = true
  let trendingSize = 20
  let features = { trending: true, combos: true, announcements: true }
  let ready: Promise<void> | null = null

  const seed: Array<[string, string]> = [
    ['dsh-memory', '0.3.1'],
    ['dsh-checkpoint', '1.2.0'],
    ['dsh-session-search', '0.9.4'],
    ['dsh-web-ui', '1.0.0'],
    ['dsh-skins', '1.0.0'],
    ['dsh-pet', '1.0.0'],
  ]

  const installRecord = (pkg: string, version: string): InstallRecord => ({
    pkg,
    version,
    installed_at: new Date().toISOString(),
    source: 'single',
    combo_id: null,
    restore_point_id: null,
  })

  /** 恢复组合 = 订阅 + 安装组内成员。 */
  const restoreCombo = async (cname: string) => {
    subscriptions[cname] = true
    const c = combos.find((x) => x.name === cname)
    if (c) for (const m of c.members) await ledger.addInstall(installRecord(m.pkg, latestVersion(plugins, m.pkg)))
  }

  /** 全量拉取服务端数据（bootstrap 与周期 refresh 共用）。 */
  const load = async () => {
    await ledger.load()
    if (ledger.listInstalls().length === 0) {
      for (const [pkg, version] of seed) await ledger.addInstall(installRecord(pkg, version))
    }
    plugins = (await source.fetchPlugins()).items
    combos = (await source.fetchCombos()).items
    announcements = await source.fetchAnnouncements()
    const manifest = await source.fetchManifest()
    clientPlugin = manifest.client_plugin ?? null
    heartbeatMin = manifest.client_config?.data_heartbeat_min ?? 30
    comboReviewEnabled = manifest.client_config?.combo_review_enabled !== false
    trendingSize = manifest.client_config?.trending_size ?? 20
    features = { trending: manifest.features?.trending !== false, combos: manifest.features?.combos !== false, announcements: manifest.features?.announcements !== false }
  }

  const state = (): StoreState => ({
    plugins,
    combos,
    announcements,
    installed: toInstalledMap(ledger),
    subscriptions: { ...subscriptions },
    liked: Object.fromEntries([...likedSet].map((t) => [t, true])),
    sources,
    account,
    cloud,
    serverUrl: 'https://blog.1qwq1.top',
    acked: { ...acked },
    clientPlugin,
    clientVersion: CLIENT_PLUGIN_VERSION,
    heartbeatMin,
    comboReviewEnabled,
    trendingSize,
    features,
    syncError: null,
    syncing: false,
  })

  return {
    async bootstrap() {
      ready ??= load()
      await ready
      return state()
    },
    async bootstrapLocal() {
      await ledger.load()
      return state()
    },
    async refresh() {
      ready = load()
      await ready
      return state()
    },
    async refreshCombos() {
      return state()
    },
    subscribe() {
      // mock 桥接 bootstrap 已 await 全量加载，无后台同步，无需订阅。
      return () => {}
    },
    async pushCloud() {
      await ready
      cloud = {
        plugins: [...new Set(ledger.listInstalls().map((r) => r.pkg))],
        combos: Object.keys(subscriptions),
        agents: [],
      }
      return cloud
    },
    async uploadSelected(scope) {
      await ready
      cloud = {
        plugins: [...new Set([...cloud.plugins, ...(scope.plugins ?? [])])],
        combos: [...new Set([...cloud.combos, ...(scope.combos ?? [])])],
        agents: [...new Set([...cloud.agents, ...(scope.agents ?? [])])],
      }
      return cloud
    },
    async deleteFromCloud(scope) {
      await ready
      const dp = new Set(scope.plugins ?? [])
      const da = new Set(scope.agents ?? [])
      const dc = new Set(scope.combos ?? [])
      cloud = {
        plugins: cloud.plugins.filter((p) => !dp.has(p)),
        combos: cloud.combos.filter((c) => !dc.has(c)),
        agents: cloud.agents.filter((a) => !da.has(a)),
      }
      return cloud
    },
    async install(pkg) {
      if (toInstalledMap(ledger)[pkg]) return toInstalledMap(ledger)
      await ledger.addInstall(installRecord(pkg, latestVersion(plugins, pkg)))
      return toInstalledMap(ledger)
    },
    async like(pkg) {
      const liked = !likedSet.has(pkg)
      if (liked) likedSet.add(pkg)
      else likedSet.delete(pkg)
      const before = plugins.find((x) => x.repo === pkg)?.likes ?? combos.find((x) => x.id === pkg)?.likes ?? 0
      const count = Math.max(0, before + (liked ? 1 : -1))
      plugins = plugins.map((x) => (x.repo === pkg ? { ...x, likes: count } : x))
      combos = combos.map((x) => (x.id === pkg ? { ...x, likes: count } : x))
      return { count, liked }
    },
    async installPreset(pkg, presetName) {
      const version = plugins.find((p) => p.id === pkg)?.version ?? '1.0.0'
      if (toInstalledMap(ledger)[pkg] === version) return toInstalledMap(ledger)
      await ledger.addInstall({ ...installRecord(pkg, version), source: 'single' })
      void presetName
      return toInstalledMap(ledger)
    },
    async uninstall(pkg) {
      await ledger.removeInstall(pkg)
      return toInstalledMap(ledger)
    },
    async update(pkg) {
      await ledger.addInstall(installRecord(pkg, latestVersion(plugins, pkg)))
      return toInstalledMap(ledger)
    },
    async installCombo(name) {
      subscriptions[name] = true
      const c = combos.find((x) => x.name === name)
      const manual: ManualInstallItem[] = []
      if (c) {
        const current = toInstalledMap(ledger)
        for (const m of c.members) {
          if (current[m.pkg]) continue
          if (m.install_mode === 'manual') {
            // 手动安装成员：不自动装,收集清单让用户逐个打开插件页面
            const p = plugins.find((x) => x.id === m.pkg)
            manual.push({
              pkg: m.pkg,
              name: p?.name ?? m.pkg,
              url: p?.repo_url && p.repo_url.startsWith('http') ? p.repo_url : `https://github.com/search?q=${encodeURIComponent(m.pkg)}&type=repositories`,
            })
            continue
          }
          await ledger.addInstall(installRecord(m.pkg, latestVersion(plugins, m.pkg)))
        }
      }
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions }, manual }
    },
    async unsubscribe(name) {
      delete subscriptions[name]
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions } }
    },
    async removeAnnouncement(id) {
      announcements = announcements.filter((a) => a.id !== id)
      return announcements
    },
    async addSource(url, _password) {
      const trimmed = (url || '').trim()
      sources = [
        ...sources,
        {
          id: `src_${Date.now()}`,
          name: trimmed,
          url: trimmed,
          builtin: false,
          enabled: !!trimmed,
          latency_ms: null,
          cluster_id: null,
          is_lb: false,
          last_seen_at: new Date().toISOString(),
          role: 'backup',
          status: trimmed ? 'connected' : 'disconnected',
        },
      ]
      return sources
    },
    async addCombo(name, desc, members) {
      const combo: Combo = {
        id: `blog.1qwq1.top:combo_${Date.now()}`,
        slug: name,
        name,
        description: desc || '（无简介）',
        members: members.map((m) => (typeof m === 'string' ? { pkg: m, version: '*', install_mode: 'auto' as const } : { pkg: m.pkg, version: '*', install_mode: m.install_mode === 'manual' ? 'manual' as const : 'auto' as const })),
        author: 'liwei',
        author_github: 'liwei',
        likes: 0,
        downloads_7d: 0,
        status: 'pending',
        origin_server: 'blog.1qwq1.top',
        version: 1,
        updated_at: new Date().toISOString(),
      }
      combos = [...combos, combo]
      return combos
    },
    async updateCombo(id, name, desc, members) {
      combos = combos.map((c) =>
        c.id === id
          ? { ...c, name, slug: name, description: desc || '（无简介）', members: members.map((m) => (typeof m === 'string' ? { pkg: m, version: '*', install_mode: 'auto' as const } : { pkg: m.pkg, version: '*', install_mode: m.install_mode === 'manual' ? 'manual' as const : 'auto' as const })), version: c.version + 1, updated_at: new Date().toISOString() }
          : c,
      )
      return combos
    },
    async removeCombo(id) {
      combos = combos.filter((c) => c.id !== id)
      return combos
    },
    async reportMissing(pkg, _repoUrl, _version) {
      return { ok: true, message: `已收到上报：${pkg}，我们会持续跟进（演示模式）` }
    },
    async updateClientPlugin(spec, version) {
      return { ok: true, message: `已开始在线更新：dsh plugin add ${spec}@${version}（复用插件更新机制）` }
    },
    async deleteAccount(combos) {
      return { ok: true, message: '账号已注销（演示模式）：点赞与云端清单已删除，组合已' + (combos === 'delete' ? '删除' : '匿名保留') }
    },
    async restorePlugins(ps) {
      for (const p of ps) await ledger.addInstall(installRecord(p, latestVersion(plugins, p)))
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions } }
    },
    async restoreAgents(ids) {
      for (const id of ids) await ledger.addInstall(installRecord(id, latestVersion(plugins, id)))
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions } }
    },
    async restoreSubscriptions(cs) {
      for (const c of cs) await restoreCombo(c)
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions } }
    },
    async removeSource(id) {
      sources = sources.filter((s) => s.id !== id)
      return sources
    },
    async pingSource(id) {
      sources = sources.map((s) =>
        s.id === id ? { ...s, latency_ms: Math.round(8 + Math.random() * 82), status: 'connected' as const } : s,
      )
      return sources
    },
    async switchSource(id) {
      const target = sources.find((s) => s.id === id)
      if (target) sources = sources.map((s) => ({ ...s, role: s.id === id ? 'primary' as const : 'backup' as const }))
      return state()
    },
    async ackUpdate(pkg) {
      acked[pkg] = latestVersion(plugins, pkg)
      return { ...acked }
    },
    async ackAll() {
      const inst = toInstalledMap(ledger)
      for (const [pkg, iv] of Object.entries(inst)) {
        const p = plugins.find((x) => x.id === pkg)
        if (p && isUpdateAvailable(iv, p.version)) acked[pkg] = p.version
      }
      return { ...acked }
    },
  }
}

/** 可变的 token 引用（登录后由 StoreApp 写入，桥接读取）。 */
export interface TokenStore {
  current: string | null
}

function decodeJwt(token: string): { login: string; name: string | null } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const text = typeof atob === 'function' ? atob(padded) : ''
    const payload = JSON.parse(text) as { login?: string; name?: string | null }
    return payload.login ? { login: payload.login, name: payload.name ?? null } : null
  } catch {
    return null
  }
}

/**
 * HTTP 桥接：数据来自 dsh-store-server（增量 + 全量兜底），写走本地台账，
 * 登录后云端清单与写操作实时同步到服务端（PUT /api/v1/me/installs）。
 * 服务端离线时数据降级为空列表，UI 层显示离线状态。
 */
export function httpBridge(opts: {
  baseUrl: string
  tokenStore?: TokenStore
  accessPassword?: string
  /** 可选持久化（localStorage / Host KV）：保存自定义源、源密码与当前主源。 */
  sourceStore?: KeyValueStore
  /** 本地安装器 RPC 根地址（同源 Host 稍后实现），如 http://127.0.0.1:3080/dsh-store/rpc。 */
  rpcBase?: string
}): StoreBridge {
  const SOURCE_KEY = 'dsh-store:http:sources:v1'
  const PRIMARY_KEY = 'dsh-store:http:primary:v1'
  const ANNO_DISMISS_KEY = 'dsh-store:http:annos-dismissed:v1'
  const CACHE_KEY = 'dsh-store:http:cache:v3'
  /** 已删除（本地隐藏）的公告 id：服务器没有逐用户公告状态接口，删除 = 本机持久隐藏。 */
  const dismissedAnnos = new Set<string>()
  let annosRestored = false

  /**
   * 本地持久缓存（localStorage / Host KV）：全量数据 + 服务器 revision。
   * iframe 每次加载先读缓存立即出界面，后台再按 revision 增量拉取（失败才全量），
   * 彻底避免「打开一次面板 = 重新全量同步一次」。
   */
  interface CacheShape {
    plugins: Plugin[]
    combos: Combo[]
    announcements: Announcement[]
    pluginsRevision?: string
    combosRevision?: string
    clientPlugin: { version: string; install: string } | null
    heartbeatMin: number
    comboLimit: number
    comboReviewEnabled?: boolean
    trendingSize?: number
    ts: number
  }
  let cacheLoaded = false
  let pluginsRevision: string | undefined
  let combosRevision: string | undefined
  const listeners = new Set<(s: StoreState) => void>()
  let loadStarted = false
  let loadPromise: Promise<void> | null = null

  // 源地址 → 连接密码（自定义源持久化；baseUrl 的初始密码由 opts.accessPassword 注入）。
  const sourcePasswords = new Map<string, string>()
  const normUrl = (u: string) => String(u ?? '').trim().replace(/\/+$/, '')
  if (opts.accessPassword) sourcePasswords.set(normUrl(opts.baseUrl), opts.accessPassword)

  // 当前主源：切换后重建 HttpDataSource，所有读写都走 activeBase。
  let activeBase = normUrl(opts.baseUrl)
  const currentBase = () => activeBase

  /** 本地安装器 RPC：未配置 rpcBase 时写操作直接失败，避免只改台账的“表面安装”。 */
  const rpcBase = opts.rpcBase?.trim().replace(/\/+$/, '') ?? ''
  async function rpcCall(path: string, body: Record<string, unknown>) {
    if (!rpcBase) throw new Error('本地安装器未连接')
    const res = await fetch(rpcBase + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok?: boolean; message?: string; output?: string }
    if (!res.ok || !json.ok) throw new Error(json.message || '操作失败')
    return json
  }

  /**
   * 跨源 HTTP 代理（Host 提供 /dsh-store/http）：
   * 自定义服务器源在浏览器里被 CORS 拦截，数据读写统一改走本地 Host 转发，
   * 转发时只透传认证与幂等无关头；返回真实 status/headers/body。
   */
  const FORWARD_HEADERS = ['authorization', 'x-access-password', 'x-anon-token', 'content-type', 'accept']
  async function hostFetch(url: string, init?: RequestInit): Promise<Response> {
    if (!rpcBase) throw new Error('本地 HTTP 代理未连接')
    const httpBase = rpcBase.replace(/\/rpc\/?$/, '') + '/http'
    const method = (init?.method ?? 'GET').toUpperCase()
    const headers: Record<string, string> = {}
    const src = init?.headers
    if (src) {
      if (src instanceof Headers) src.forEach((v, k) => { headers[k] = v })
      else if (Array.isArray(src)) src.forEach(([k, v]) => { headers[k] = v })
      else Object.entries(src).forEach(([k, v]) => { headers[k] = v })
    }
    const fwd: Record<string, string> = {}
    for (const name of FORWARD_HEADERS) {
      const v = headers[name] ?? headers[name.toLowerCase()]
      if (v) fwd[name] = v
    }
    let bodyText = ''
    if (typeof init?.body === 'string') bodyText = init.body
    try {
      const res = await fetch(httpBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers: fwd, body: bodyText }),
        // 透传调用方的超时/中止信号：测速(6s)、数据请求(20s)的 AbortController 必须生效，
        // 否则只能干等宿主代理的 20s×4 次重试(最长 80s)，界面表现为"卡住"。
        signal: init?.signal,
      })
      const j = (await res.json()) as { status?: number; headers?: Record<string, string>; body?: string }
      return new Response(j.body ?? '', {
        status: j.status ?? 502,
        headers: j.headers ? new Headers(j.headers) : new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
      })
    } catch (e) {
      return new Response(String((e as Error)?.message ?? e), { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  }

  /** 同源直连（默认源走 /dsh-store/api 反代），跨源走 Host 本地代理。 */
  const makeFetcher = (): FetchLike => {
    if (!rpcBase) return (url, init) => fetch(url, init)
    const selfOrigin = typeof window !== 'undefined' ? window.location.origin : ''
    return (url, init = {}) => {
      try {
        if (selfOrigin && new URL(url, selfOrigin).origin === selfOrigin) return fetch(url, init)
      } catch {
        /* 非法 URL 交给 fetch 报错 */
      }
      return hostFetch(url, init)
    }
  }
  const dataFetch: FetchLike = makeFetcher()

  const makeSource = (base: string) =>
    new HttpDataSource(
      base,
      () => opts.tokenStore?.current ?? null,
      () => sourcePasswords.get(normUrl(base)) ?? '',
      dataFetch,
    )
  let source: HttpDataSource = makeSource(activeBase)

  const ledger = new Ledger(memoryStore(), 'dsh-store:http')
  let plugins: Plugin[] = []
  let combos: Combo[] = []
  let announcements: Announcement[] = []
  let sources: ServerSource[] = []
  let nodeSources: ServerSource[] = []
  let customSources: ServerSource[] = []
  /** 已知内置源的健康状态（默认源 + 曾切换过的源都保留在列表里，便于切回）。 */
  const baseHealth = new Map<string, { reachable: boolean; latency: number | null }>()
  const subscriptions: Record<string, boolean> = {}
  /** 订阅持久化（组合在线模式：未登录也本地收藏；登录后与云端合并上云）。 */
  const SUB_KEY = 'dsh-store:http:subs:v1'
  let subsRestored = false
  const persistSubs = async (): Promise<void> => {
    if (!opts.sourceStore) return
    try {
      await opts.sourceStore.set(SUB_KEY, JSON.stringify(Object.keys(subscriptions)))
    } catch {
      /* 持久化失败不影响本次会话 */
    }
  }
  const restoreSubs = async (): Promise<void> => {
    if (!opts.sourceStore || subsRestored) return
    subsRestored = true
    try {
      const raw = await opts.sourceStore.get(SUB_KEY)
      if (raw) {
        const list = JSON.parse(raw) as string[]
        for (const n of list) if (typeof n === 'string' && n) subscriptions[n] = true
      }
    } catch {
      /* 数据损坏时忽略 */
    }
  }
  /** 组合在线刷新：in-flight 去重 + 会话内 60s 复用（打开组合页/组合操作后调用）。 */
  let combosFetching: Promise<void> | null = null
  let combosFetchedAt = 0
  const COMBO_FRESH_MS = 60000
  const acked: Record<string, string> = {}
  let cloud: CloudList = { plugins: [], combos: [], agents: [] }
  /** 我已点赞的目标集合（登录后从 GET /api/v1/me/likes 初始化，点赞/取消即时增删）。 */
  const likedTargets = new Set<string>()
  /**
   * 真实已装清单（host 侧 /rpc/installed 返回）：loader 装配（含 DSH 自带 bundles）+ profile 依赖 + agent-presets。
   * 本地台账之外的权威状态，用于防重复安装（自带插件不会出现在商店台账里）。
   */
  const realInstalled = new Map<string, string | null>()
  let clientPlugin: { version: string; install: string } | null = null
  let heartbeatMin = 30
  let comboLimit = 3
  let comboReviewEnabled = true
  let trendingSize = 20
  let features = { trending: true, combos: true, announcements: true }
  let authValid = false
  let restored = false

  const currentToken = () => opts.tokenStore?.current ?? null

  const persistSources = async () => {
    if (!opts.sourceStore) return
    try {
      await opts.sourceStore.set(
        SOURCE_KEY,
        JSON.stringify(
          customSources.map((s) => ({
            url: s.url,
            name: s.name,
            password: sourcePasswords.get(normUrl(s.url)) ?? '',
            added_at: s.last_seen_at,
          })),
        ),
      )
      await opts.sourceStore.set(PRIMARY_KEY, activeBase)
    } catch {
      /* 持久化失败不影响本次会话 */
    }
  }

  const restoreSources = async () => {
    if (restored || !opts.sourceStore) return
    restored = true
    try {
      const raw = await opts.sourceStore.get(SOURCE_KEY)
      if (raw) {
        const list = JSON.parse(raw) as Array<{ url?: string; name?: string; password?: string }>
        customSources = list
          .map((item) => ({ item, url: normUrl(item.url ?? '') }))
          .filter((it) => it.url && /^https?:\/\//i.test(it.url))
          .map(({ item, url }) => {
            const password = item.password ?? ''
            if (password) sourcePasswords.set(url, password)
            return {
              id: `custom:${url}`,
              name: item.name || url,
              url,
              builtin: false,
              enabled: true,
              latency_ms: null,
              cluster_id: null,
              is_lb: false,
              last_seen_at: null,
              role: 'backup',
              status: 'disconnected' as const,
            }
          })
      }
      const primary = normUrl((await opts.sourceStore.get(PRIMARY_KEY)) ?? '')
      if (primary && /^https?:\/\//i.test(primary) && primary !== activeBase) {
        activeBase = primary
        source = makeSource(activeBase)
      }
    } catch {
      /* 数据损坏时忽略，走默认源 */
    }
  }

  const mergeSources = (): ServerSource[] => {
    const map = new Map<string, ServerSource>()
    const activeUrl = normUrl(activeBase)
    const builtins = [...new Set([normUrl(opts.baseUrl), activeUrl])]
    for (const url of builtins) {
      const h = baseHealth.get(url)
      const isActive = url === activeUrl
      map.set(`builtin:${url}`, {
        id: `builtin:${url}`,
        name: url,
        url,
        builtin: true,
        enabled: true,
        latency_ms: h?.latency ?? null,
        cluster_id: null,
        is_lb: false,
        last_seen_at: null,
        role: isActive ? 'primary' : 'backup',
        // 未探测时：主源显示「连接中」（面板正在尝试连接），备用源显示「未连接」
        status: h ? (h.reachable ? 'connected' : 'unreachable') : isActive ? 'connecting' : 'disconnected',
      })
    }
    for (const s of [...nodeSources, ...customSources]) {
      const key = normUrl(s.url) || s.id
      if (map.has(key) || map.has(`builtin:${key}`)) continue
      map.set(key, { ...s, role: key === activeUrl ? 'primary' : 'backup' })
    }
    return [...map.values()]
  }

  /** 裸 fetch 统一请求头：JWT（可选）+ 源服务器连接密码（可选）。 */
  const authHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
    const out: Record<string, string> = { ...extra }
    const t = currentToken()
    if (t) out.Authorization = `Bearer ${t}`
    const password = sourcePasswords.get(normUrl(activeBase)) ?? ''
    if (password) out['X-Access-Password'] = password
    return out
  }

  async function fetchCloud(): Promise<void> {
    const t = currentToken()
    if (!t) {
      authValid = false
      cloud = { plugins: [], combos: [], agents: [] }
      return
    }
    try {
      const res = await dataFetch(currentBase() + API.meInstalls, { headers: authHeaders() })
      // 登录有效性只由 401/403（token 被拒）决定：网络/服务器暂时故障（502/500/429/超时）
      // 不清登录态、不清 token，避免“回对话再进商城”因一次抖动就掉线。
      if (res.status === 401 || res.status === 403) {
        authValid = false
        if (opts.tokenStore) opts.tokenStore.current = null
        return
      }
      authValid = true
      if (!res.ok) return
      const list = (await res.json()) as Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }>
      cloud = {
        plugins: [...new Set(list.filter((i) => i.type === 'plugin').map((i) => i.target))],
        combos: [...new Set(list.filter((i) => i.type === 'combo').map((i) => i.target))],
        agents: [...new Set(list.filter((i) => i.type === 'agent').map((i) => i.target))],
      }
      // 云端订阅合并进本地订阅（多端一致）：其他设备订阅的组合本机也标记已订阅
      for (const i of list) if (i.type === 'combo' && i.target) subscriptions[i.target] = true
      await persistSubs()
    } catch {
      // 网络异常：保留登录态（token 未失效），连接恢复后自动续上
    }
  }

  /** 拉取我点赞过的目标清单（登录后初始化已赞状态；离线时保持现状）。 */
  async function fetchLiked(): Promise<void> {
    const t = currentToken()
    if (!t) {
      likedTargets.clear()
      return
    }
    try {
      const res = await dataFetch(currentBase() + API.meLikes, { headers: authHeaders() })
      if (!res.ok) return
      const list = (await res.json()) as string[]
      likedTargets.clear()
      for (const x of list) likedTargets.add(x)
    } catch {
      /* 离线保持现状 */
    }
  }

  /** 点赞 / 取消（切换式）：服务器返回最新计数与是否已赞；疑似刷赞进风控时明确报错。 */
  async function doLike(target: string): Promise<{ count: number; liked: boolean }> {
    const t = currentToken()
    if (!t) throw new Error('请先登录 GitHub 后再点赞')
    let res: Response
    try {
      res = await dataFetch(currentBase() + API.like, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ target }),
      })
    } catch {
      throw new Error('点赞失败：服务端不可达')
    }
    const body = (await res.json().catch(() => null)) as
      | { likes?: number; liked?: boolean; status?: string; reason?: string; message?: string }
      | null
    if (!res.ok) throw new Error(body?.message || '点赞失败，请稍后再试')
    if (body?.status === 'pending') throw new Error('点赞待确认：' + (body.reason || '疑似刷赞，请稍后再试'))
    if (typeof body?.likes !== 'number') throw new Error('点赞失败：服务器响应异常')
    if (body.liked) likedTargets.add(target)
    else likedTargets.delete(target)
    return { count: body.likes, liked: !!body.liked }
  }

  /** 统一上传通道：去重 → PUT（服务器 meInstalls 为全量替换）→ 同步内存 cloud。 */
  const putInstalls = async (body: Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }>): Promise<CloudList> => {
    // 严格去重 (type,target)：服务端 user_installs 主键为 (user_id,target,type)，
    // 重复行会导致 PG 批量 INSERT 整个失败——必须在客户端合并。
    const seenKey = new Set<string>()
    const uploadBody = body.filter((b) => {
      const k = b.type + '\u0000' + b.target
      if (seenKey.has(k)) return false
      seenKey.add(k)
      return true
    })
    try {
      const res = await dataFetch(currentBase() + API.meInstalls, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ installs: uploadBody }),
      })
      // 同 fetchCloud：只有 401/403 才算登录失效；暂时故障不清登录态
      if (res.status === 401 || res.status === 403) {
        authValid = false
        if (opts.tokenStore) opts.tokenStore.current = null
        return cloud
      }
      authValid = true
      if (res.ok) {
        const list = (await res.json()) as Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }>
        cloud = {
          plugins: [...new Set(list.filter((i) => i.type === 'plugin').map((i) => i.target))],
          combos: [...new Set(list.filter((i) => i.type === 'combo').map((i) => i.target))],
          agents: [...new Set(list.filter((i) => i.type === 'agent').map((i) => i.target))],
        }
      }
    } catch {
      /* 离线时至少让本地 UI 与本地清单一致 */
      cloud = {
        plugins: [...new Set(body.filter((b) => b.type === 'plugin').map((b) => b.target))],
        combos: [...new Set(body.filter((b) => b.type === 'combo').map((b) => b.target))],
        agents: [...new Set(uploadBody.filter((b) => b.type === 'agent').map((b) => b.target))],
      }
    }
    return cloud
  }

  /** 上传本地安装 + 订阅组 + 已装 Agent 到云端：全量同步 = 有效已装 + 全部订阅 + 已装 Agent。 */
  async function syncCloud(): Promise<CloudList> {
    const t = currentToken()
    if (!t) {
      cloud = { plugins: [], combos: [], agents: [] }
      return cloud
    }
    // 上传"有效已装"中的【已收录于插件库】的插件：库外插件其他地方无法下载安装，
    // 上传云端无意义，故过滤掉（用户可先发布/上报入库后再同步）。
    const body: Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }> = Object.entries(effectiveInstalled())
      .filter(([target]) => plugins.some((p) => p.id === target))
      .map(([target, version]) => ({
        target,
        type: 'plugin',
        version,
      }))
    for (const c of Object.keys(subscriptions)) body.push({ target: c, type: 'combo', version: '1' })
    // Agent：已装（多键匹配）的 preset 条目按市场 id 上传，恢复时以 id 定位
    const installedKeys = Object.keys(effectiveInstalled())
    for (const p of plugins) {
      if (p.kind !== 'preset') continue
      if (installedKeys.includes(p.id) || installedKeys.includes(p.name) || installedKeys.includes(p.preset_name ?? '') || installedKeys.includes(p.repo.split('/').pop() ?? '')) {
        body.push({ target: p.id, type: 'agent', version: p.version || '1' })
      }
    }
    return putInstalls(body)
  }

  /** 手动挑选上传：云端已有 ∪ 勾选新增（服务端全量替换，必须合并），未勾选的本地项不进云端。
   *  仅接受插件库已收录的插件（库外无法在其他设备安装，上传无意义；顺带清掉云端历史库外项）。 */
  const uploadSelected = async (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }): Promise<CloudList> => {
    const t = currentToken()
    if (!t) throw new Error('请先登录 GitHub 后再上传云端')
    const inLib = (id: string): boolean => plugins.some((p) => p.id === id)
    const body: Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }> = []
    const pset = new Set([...cloud.plugins, ...(scope.plugins ?? [])].filter(inLib))
    for (const p of pset) body.push({ target: p, type: 'plugin', version: latestVersion(plugins, p) || '1.0.0' })
    const cset = new Set([...cloud.combos, ...(scope.combos ?? [])])
    for (const c of cset) body.push({ target: c, type: 'combo', version: '1' })
    const aset = new Set([...cloud.agents, ...(scope.agents ?? [])])
    for (const a of aset) body.push({ target: a, type: 'agent', version: '1' })
    return putInstalls(body)
  }

  /** 从云端删除指定项：云端剩余项整体 PUT（仅改云端清单，不动本地安装）。 */
  const deleteFromCloud = async (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }): Promise<CloudList> => {
    const t = currentToken()
    if (!t) throw new Error('请先登录 GitHub 后再管理云端')
    const delP = new Set(scope.plugins ?? [])
    const delA = new Set(scope.agents ?? [])
    const delC = new Set(scope.combos ?? [])
    const body: Array<{ target: string; type: 'plugin' | 'combo' | 'agent'; version: string }> = [
      ...cloud.plugins.filter((p) => !delP.has(p)).map((p) => ({ target: p, type: 'plugin' as const, version: latestVersion(plugins, p) || '1.0.0' })),
      ...cloud.agents.filter((a) => !delA.has(a)).map((a) => ({ target: a, type: 'agent' as const, version: '1' })),
      ...cloud.combos.filter((c) => !delC.has(c)).map((c) => ({ target: c, type: 'combo' as const, version: '1' })),
    ]
    return putInstalls(body)
  }

  const installRecord = (pkg: string, version: string): InstallRecord => ({
    pkg,
    version,
    installed_at: new Date().toISOString(),
    source: 'single',
    combo_id: null,
    restore_point_id: null,
  })

  const latestVersion = (plugins: Plugin[], pkg: string): string => plugins.find((x) => x.id === pkg)?.version ?? '1.0.0'

  /** 探测任意源地址（独立于当前主源），返回延迟与状态；失败自动重试一次。 */
  const probeUrl = async (url: string): Promise<{ latency: number | null; status: ServerSource['status'] }> => {
    const target = normUrl(url)
    const password = sourcePasswords.get(target) ?? ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now()
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 6000)
        const res = await dataFetch(target + '/health', {
          headers: password ? { 'X-Access-Password': password } : {},
          signal: ctrl.signal,
        })
        clearTimeout(timer)
        if (res.ok) return { latency: Math.max(1, Date.now() - t0), status: 'connected' }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
        else return { latency: null, status: res.status === 401 || res.status === 403 ? 'unreachable' : 'disconnected' }
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
      }
    }
    return { latency: null, status: 'unreachable' }
  }

  /** 恢复本地持久缓存（幂等）：iframe 每次加载先出缓存界面，后台再增量同步。 */
  const readCache = async (): Promise<void> => {
    if (!opts.sourceStore || cacheLoaded) return
    cacheLoaded = true
    try {
      const raw = await opts.sourceStore.get(CACHE_KEY)
      if (!raw) return
      const c = JSON.parse(await cacheDecompress(raw)) as CacheShape
      if (!Array.isArray(c.plugins) || !Array.isArray(c.combos)) return
      plugins = c.plugins
      combos = c.combos
      announcements = (c.announcements ?? []).filter((a) => !dismissedAnnos.has(a.id))
      pluginsRevision = c.pluginsRevision
      combosRevision = c.combosRevision
      clientPlugin = c.clientPlugin ?? null
      heartbeatMin = c.heartbeatMin ?? 30
      comboLimit = c.comboLimit ?? 3
      comboReviewEnabled = c.comboReviewEnabled !== false
      trendingSize = c.trendingSize ?? 20
    } catch {
      /* 数据损坏时忽略 */
    }
  }

  /** 持久化当前全量数据 + revision（下次打开秒开，后台增量）。
   *  直接存完整数据会超 localStorage 配额（6022 条 JSON ≈3.7MB）→ 用 gzip 压缩后写入，
   *  保留全部字段内容（插件信息不裁剪、不缺失）。 */
  const writeCache = async (): Promise<void> => {
    if (!opts.sourceStore) return
    try {
      const payload = JSON.stringify({
        plugins,
        combos,
        announcements,
        pluginsRevision,
        combosRevision,
        clientPlugin,
        heartbeatMin,
        comboLimit,
        comboReviewEnabled,
        trendingSize,
        ts: Date.now(),
      })
      await opts.sourceStore.set(CACHE_KEY, await cacheCompress(payload))
    } catch (e) {
      /* 持久化失败不影响本次会话（后台仍全量同步）；控制台可见原因便于排查 */
      console.warn('[dsh-store] 本地缓存写入失败', String((e as Error)?.message ?? e))
    }
  }

  /** 通知订阅者（后台同步完成后由 UI 层刷新界面）。 */
  const notify = (): void => {
    const s = state()
    listeners.forEach((cb) => {
      try {
        cb(s)
      } catch {
        /* 订阅者异常不影响其他订阅者 */
      }
    })
  }

  /** 拉取真实已装清单（本地台账之外的权威状态；无 rpc 或失败时忽略）。 */
  async function fetchRealInstalled(): Promise<void> {
    realInstalled.clear()
    if (!rpcBase) return
    try {
      const j = await rpcCall('/installed', {})
      if (j && Array.isArray((j as { installed?: Array<{ name: string; version: string | null }> }).installed)) {
        for (const item of (j as { installed: Array<{ name: string; version: string | null }> }).installed) {
          if (item?.name) realInstalled.set(item.name, item.version ?? null)
        }
      }
    } catch {
      /* 预览模式/本地安装器未连接时忽略 */
    }
  }

  /** 有效已装清单 = 本地台账 + 真实已装合并（真实优先补缺；未知版本按已装处理）。 */
  const effectiveInstalled = (): Record<string, string> => {
    const out = toInstalledMap(ledger)
    for (const [name, ver] of realInstalled) {
      if (!out[name]) out[name] = ver ?? '1.0.0'
    }
    return out
  }

  /** 应用增量：full 替换，否则按 id upsert 并处理墓碑。 */
  const applyDelta = <T extends { id: string }>(current: T[], delta: Delta<T>): T[] => {
    if (delta.full) return delta.items
    const map = new Map(current.map((i) => [i.id, i]))
    for (const item of delta.items) map.set(item.id, item)
    for (const id of delta.tombstones) map.delete(id)
    return [...map.values()]
  }

  /**
   * 同步服务端数据（bootstrap 与周期 refresh 共用）：
   * 1. 先恢复本地持久缓存（不阻塞界面）；
   * 2. 健康探测与 manifest 并行，探测完成立即推送源状态（「我的」页不等数据拉完就显示连接状态）；
   * 3. 在线 → 数据通道（插件/组合/公告/节点）并行拉取（各接口自带失败兜底，互不影响）；
   * 4. manifest 探测离线 → 保留缓存数据，只更新源健康状态。
   */
  // 最近一次同步结果（给界面横幅：成功=null / 失败=原因）。加载兜底：load 不再静默吞错。
  let syncError: string | null = null
  /** 是否正在联网同步（load 进行中）：连接横幅只在 syncing && 当前页数据为空时显示，
   *  完成后消失——避免"数据本来为空"的常态化横幅。 */
  let syncing = false
  const load = async () => {
    syncing = true
    try {
      await restoreSources()
      await readCache()
      if (opts.sourceStore && !annosRestored) {
        annosRestored = true
        try {
        const raw = await opts.sourceStore.get(ANNO_DISMISS_KEY)
        if (raw) {
          const list = JSON.parse(raw) as string[]
          list.forEach((id) => dismissedAnnos.add(id))
        }
      } catch {
        /* 数据损坏时忽略 */
      }
    }
    await ledger.load()
    // 健康探测 + manifest 并行（服务器响应慢时不再串行叠加等待）
    const [health, m] = await Promise.all([probeUrl(activeBase), source.fetchManifest()])
    baseHealth.set(normUrl(activeBase), { reachable: health.status === 'connected', latency: health.latency })
    sources = mergeSources()
    // 先推送源状态：进入商城后「我的」页尽快显示 connected，无需手动测速
    notify()
    // manifest 拉取失败（fallback software_version=0.0.0）视为离线：保留缓存数据。
    const offline = m.software_version === '0.0.0'
    if (!offline) {
      syncError = null
      clientPlugin = m.client_plugin ?? null
      heartbeatMin = m.client_config?.data_heartbeat_min ?? 30
      comboLimit = m.client_config?.combo_limit ?? 3
      comboReviewEnabled = m.client_config?.combo_review_enabled !== false
      trendingSize = m.client_config?.trending_size ?? 20
      features = { trending: m.features?.trending !== false, combos: m.features?.combos !== false, announcements: m.features?.announcements !== false }
      const sinceP = pluginsRevision && pluginsRevision !== m.plugins_revision ? pluginsRevision : undefined
      const sinceC = combosRevision && combosRevision !== m.combos_revision ? combosRevision : undefined
      // 数据通道拉取顺序：小响应（组合/公告/节点）先并行 → 组合数据尽快就绪并推送；
      // 插件库（4500+ 条大响应）最后独占拉取——与任何并发请求同时打慢服务器都会互相拖垮超时。
      const [cs, annos, nodeList] = await Promise.all([
        source.fetchCombos(sinceC),
        source.fetchAnnouncements(),
        source.listNodes(),
      ])
      if (!(cs.full && cs.items.length === 0 && cs.revision === '0')) {
        combos = applyDelta(combos, cs)
        combosRevision = cs.revision !== '0' ? cs.revision : m.combos_revision
      }
      // 公告：网络返回空且缓存非空时保留缓存（服务器当前无公告是真实状态，两者都接受）。
      if (annos.length > 0 || announcements.length === 0) {
        announcements = annos.filter((a) => !dismissedAnnos.has(a.id))
      }
      nodeSources = nodeList
      // 组合/公告先就绪：推送一次（进组合页即可见最新数据，不必等插件库大响应）
      notify()
      const ps = await source.fetchPlugins(sinceP)
      // 增量/全量失败时返回 fallback（full + 空 items + revision '0'）：保留缓存数据
      if (!(ps.full && ps.items.length === 0 && ps.revision === '0')) {
        plugins = applyDelta(plugins, ps)
        pluginsRevision = ps.revision !== '0' ? ps.revision : m.plugins_revision
      } else {
        // 插件库拉取失败：保留缓存但明确提示（界面横幅 + 重试）
        syncError = `插件库同步失败（${activeBase} 响应异常），已显示本地缓存数据`
      }
    } else {
      syncError = activeBase ? `无法连接服务器（${activeBase}）` : '无法连接服务器'
    }
    sources = mergeSources()
    await fetchCloud()
    await fetchLiked()
    await fetchRealInstalled()
    await writeCache()
    startEvents()
    } catch (err) {
      // 兜底：任何未捕获异常都转为可见的同步失败原因（绝不静默）
      syncError = `数据同步失败：${String((err as Error)?.message ?? err)}`
    }
    syncing = false
  }

  /** 组合配额已用数：组合列表中作者匹配当前登录账号的数量（含软删占位，与服务端配额口径一致）。 */
  const comboQuotaUsed = (login: string): number => {
    const l = String(login || '').trim().toLowerCase()
    if (!l) return 0
    return combos.filter(
      (c) => (c.author || '').toLowerCase() === l || (c.author_github ?? '').toLowerCase() === l,
    ).length
  }

  const state = (): StoreState => {
    const rawToken = currentToken()
    const user =
      authValid && rawToken
        ? decodeJwt(rawToken) ?? (rawToken.startsWith('mock-') ? { login: rawToken.slice('mock-'.length), name: null } : null)
        : null
    return {
      plugins,
      combos,
      announcements,
      installed: effectiveInstalled(),
      subscriptions: { ...subscriptions },
      liked: Object.fromEntries([...likedTargets].map((t) => [t, true])),
      // 实时合并而非读闭包变量：bootstrap 立即返回时也有内置源 + 已恢复的自定义源，
      // 避免刷新后首次打开「我的」显示"暂无服务器源"。
      sources: mergeSources(),
      account: {
        login: user?.login ?? '',
        name: user?.name ?? null,
        registered_at: '',
        // 组合配额：已用 = 组合列表中作者匹配数（与组合页「我的组合」口径一致，
        // 含软删 removed 的占位组合，与服务端 countUserCombos 配额口径对齐）；上限 = 服务端下发 combo_limit。
        combo_quota: user ? `${comboQuotaUsed(user.login)} / ${comboLimit}` : '',
      },
      cloud,
      serverUrl: activeBase,
      acked: { ...acked },
      clientPlugin,
      clientVersion: clientVersionReal ?? CLIENT_PLUGIN_VERSION,
      heartbeatMin,
      comboReviewEnabled,
      trendingSize,
      features,
      syncError,
      syncing,
    }
  }

  /** 强制重拉（心跳/SSE 事件共用）。 */
  const doRefresh = async (): Promise<StoreState> => {
    loadPromise = load()
      .then(notify)
      .catch(() => {})
    await loadPromise
    return state()
  }

  let eventSourceStarted = false

  /**
   * SSE 实时事件订阅（EventSource 自动重连）：
   * - likes：本地更新对应插件/组合计数并通知 UI（无需重拉）；
   * - plugins / announcements：触发增量刷新（revision 比对，变了才拉全量/增量）。
   * 连接失败/不支持时静默降级——30 分钟心跳兜底不受影响。
   */
  function startEvents(): void {
    if (eventSourceStarted || typeof EventSource === 'undefined' || !rpcBase) return
    eventSourceStarted = true
    try {
      const es = new EventSource(currentBase() + API.events)
      // 断线重连成功（挂机/网络恢复）→ 立即刷新数据与源状态：
      // EventSource 重连只恢复通道，不会重发事件；不刷新的话「我的」页会一直显示断联。
      let sseOpenedOnce = false
      es.onopen = () => {
        if (sseOpenedOnce) void doRefresh()
        sseOpenedOnce = true
      }
      es.addEventListener('likes', (e) => {
        try {
          const d = JSON.parse(String((e as MessageEvent).data)) as { target?: string; likes?: number }
          const target = d.target
          const likes = d.likes
          if (typeof target !== 'string' || typeof likes !== 'number') return
          plugins = plugins.map((p) => (p.repo === target ? { ...p, likes } : p))
          combos = combos.map((c) => (c.id === target ? { ...c, likes } : c))
          notify()
        } catch {
          /* 坏事件忽略 */
        }
      })
      es.addEventListener('plugins', () => void doRefresh())
      es.addEventListener('announcements', () => void doRefresh())
      // 组合更新不实时推送(省服务器资源)：客户端按心跳周期拉取,无需 combos 事件。
    } catch {
      /* 环境不支持时静默，心跳兜底 */
    }
  }

  /** 真实安装版本：host 半 /version RPC 读已装包 package.json（git/npm/tgz 安装都准确）。 */
  let clientVersionReal: string | null = null
  let versionFetched = false
  const fetchClientVersion = async (): Promise<void> => {
    if (versionFetched || !rpcBase) return
    versionFetched = true
    try {
      const r = await rpcCall('/version', {})
      const v = String((r as { version?: string }).version ?? '').trim()
      if (v) clientVersionReal = v
    } catch {
      /* RPC 不可用：回落构建注入版本 */
    }
  }

  return {
    /**
     * 首次加载：先恢复缓存立即返回（界面秒开），同时后台启动全量/增量同步，
     * 完成后通过 subscribe 通知 UI 刷新。
     */
    async bootstrap() {
      // 任一本地恢复步骤失败都不致命：捕获后降级继续，保证本 Promise 必 resolve，
      // 上层骨架态（"正在同步插件库"）绝不会因异常而卡死不消失。
      try {
        // 先恢复本地自定义源/主源（幂等），让"我的 → 服务器源"立即有数据。
        await restoreSources()
        await readCache()
        // 本地台账 + 真实已装清单必须先在秒开阶段就绪：
        // 否则 iframe 每次重建（从商城切出去再回来）返回的 state() 里 installed 为空，
        // 已安装插件/组合成员/Agent 列表会短暂消失，直到后台 load() 拉完才重新出现。
        await ledger.load()
        await fetchRealInstalled()
        await restoreSubs()
        // 真实安装版本（本地 RPC，快）：更新判断以实际安装的包版本为准
        await fetchClientVersion()
      } catch {
        /* 数据损坏/本地存储异常：保留当前内存状态，后台 load 仍会尽力同步 */
      }
      // 乐观登录恢复：本地存在可解码的 token 即先恢复登录态（iframe 重建/切页回来不闪烁、不掉线），
      // 后台 load 会向服务器校验；只有服务器明确 401/403 才真正登出并清 token。
      if (!authValid) {
        const t = currentToken()
        if (t && (decodeJwt(t) ?? (t.startsWith('mock-') ? { login: t.slice('mock-'.length) } : null))) {
          authValid = true
        }
      }
      if (!loadStarted) {
        loadStarted = true
        loadPromise = load()
          .then(notify)
          .catch(() => {})
      }
      return state()
    },
    /** 仅本机恢复（读缓存/台账，不联网、不启动后台同步）：预览首帧秒开、避免黑屏。 */
    async bootstrapLocal() {
      try {
        await restoreSources()
        await readCache()
        await ledger.load()
      } catch {
        /* 忽略：仅尽力恢复 */
      }
      return state()
    },
    refresh: doRefresh,
    /** 组合在线刷新：直接向服务器拉取组合全量（会话内 60s 复用 + in-flight 去重），
     *  覆盖本地缓存，保证「我的组合/推荐组合」为服务器权威数据。 */
    async refreshCombos() {
      await restoreSubs()
      if (combosFetching) {
        await combosFetching
        notify()
        return state()
      }
      const now = Date.now()
      if (now - combosFetchedAt < COMBO_FRESH_MS) return state()
      combosFetchedAt = now
      combosFetching = (async () => {
        try {
          // 无 since 参数 = 服务器全量返回（组合数据量小，在线模式直接全量）
          const cs = await source.fetchCombos()
          if (!(cs.full && cs.items.length === 0 && cs.revision === '0')) {
            combos = applyDelta(combos, cs)
            combosRevision = cs.revision !== '0' ? cs.revision : combosRevision
            await writeCache()
          }
        } catch {
          /* 在线刷新失败：保留现有数据（会话缓存），下次打开再试 */
        }
      })()
      await combosFetching
      combosFetching = null
      notify()
      return state()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    async pushCloud() {
      if (!loadStarted) {
        loadStarted = true
        loadPromise = load()
          .then(notify)
          .catch(() => {})
      }
      await loadPromise
      return syncCloud()
    },
    async uploadSelected(scope) {
      if (!loadStarted) {
        loadStarted = true
        loadPromise = load()
          .then(notify)
          .catch(() => {})
      }
      await loadPromise
      return uploadSelected(scope)
    },
    async deleteFromCloud(scope) {
      if (!loadStarted) {
        loadStarted = true
        loadPromise = load()
          .then(notify)
          .catch(() => {})
      }
      await loadPromise
      return deleteFromCloud(scope)
    },
    async install(pkg) {
      // 防重复安装：本地台账或真实已装（含 DSH 自带插件）中已存在 → 幂等跳过。
      if (effectiveInstalled()[pkg]) return effectiveInstalled()
      const p = plugins.find((x) => x.id === pkg)
      await rpcCall('/install', {
        pkg,
        version: p?.version ?? latestVersion(plugins, pkg),
        install: p?.install ?? '',
        repoUrl: p?.repo_url ?? '',
      })
      await ledger.addInstall(installRecord(pkg, latestVersion(plugins, pkg)))
      realInstalled.set(pkg, latestVersion(plugins, pkg))
      await syncCloud()
      void source.reportInstall(pkg)
      return effectiveInstalled()
    },
    like: doLike,
    async installPreset(pkg, presetName) {
      // 防重复安装：已装且版本一致 → 幂等跳过；版本不同（更新 Agent）→ 执行。
      const p = plugins.find((x) => x.id === pkg)
      const target = p?.version ?? '1.0.0'
      const cur = effectiveInstalled()[pkg]
      if (cur && cur === target) return effectiveInstalled()
      await rpcCall('/preset', {
        pkg,
        presetName: presetName ?? p?.preset_name ?? p?.name ?? pkg,
        repoUrl: p?.repo_url ?? '',
      })
      await ledger.addInstall({ ...installRecord(pkg, target), source: 'single' })
      realInstalled.set(pkg, target)
      await syncCloud()
      void source.reportInstall(pkg)
      return effectiveInstalled()
    },
    async uninstall(pkg) {
      const p = plugins.find((x) => x.id === pkg)
      await rpcCall('/uninstall', {
        pkg,
        install: p?.install ?? '',
        repoUrl: p?.repo_url ?? '',
        presetName: p?.preset_name ?? p?.name ?? pkg,
      })
      await ledger.removeInstall(pkg)
      await syncCloud()
      return toInstalledMap(ledger)
    },
    async update(pkg) {
      const p = plugins.find((x) => x.id === pkg)
      await rpcCall('/update', {
        pkg,
        version: p?.version ?? latestVersion(plugins, pkg),
        install: p?.install ?? '',
        repoUrl: p?.repo_url ?? '',
      })
      await ledger.addInstall(installRecord(pkg, latestVersion(plugins, pkg)))
      acked[pkg] = latestVersion(plugins, pkg)
      await syncCloud()
      void source.reportInstall(pkg)
      return toInstalledMap(ledger)
    },
    async installCombo(name) {
      subscriptions[name] = true
      await persistSubs()
      const c = combos.find((x) => x.name === name)
      const manual: ManualInstallItem[] = []
      if (c) {
        const current = effectiveInstalled()
        for (const m of c.members) {
          // 防重复安装：已装成员跳过（组合=订阅+补装缺失，不重复装已装成员）。
          if (current[m.pkg]) continue
          if (m.install_mode === 'manual') {
            // 手动安装成员：不自动装,收集清单让用户逐个打开插件页面
            const p = plugins.find((x) => x.id === m.pkg)
            manual.push({
              pkg: m.pkg,
              name: p?.name ?? m.pkg,
              url: p?.repo_url && p.repo_url.startsWith('http') ? p.repo_url : `https://github.com/search?q=${encodeURIComponent(m.pkg)}&type=repositories`,
            })
            continue
          }
          const p = plugins.find((x) => x.id === m.pkg)
          await rpcCall('/install', {
            pkg: m.pkg,
            version: p?.version ?? latestVersion(plugins, m.pkg),
            install: p?.install ?? '',
            repoUrl: p?.repo_url ?? '',
          })
          await ledger.addInstall(installRecord(m.pkg, latestVersion(plugins, m.pkg)))
          void source.reportInstall(m.pkg)
        }
      }
      await syncCloud()
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions }, manual }
    },
    async unsubscribe(name) {
      delete subscriptions[name]
      await persistSubs()
      await syncCloud()
      return { installed: toInstalledMap(ledger), subscriptions: { ...subscriptions } }
    },
    async removeAnnouncement(id) {
      dismissedAnnos.add(id)
      announcements = announcements.filter((a) => a.id !== id)
      if (opts.sourceStore) {
        try {
          await opts.sourceStore.set(ANNO_DISMISS_KEY, JSON.stringify([...dismissedAnnos]))
        } catch {
          /* 持久化失败不影响本次会话 */
        }
      }
      return announcements
    },
    async addSource(url, password) {
      await restoreSources()
      const trimmed = normUrl(url)
      if (!/^https?:\/\//i.test(trimmed)) return sources
      if (password) sourcePasswords.set(trimmed, password)
      const probe = await probeUrl(trimmed)
      const entry: ServerSource = {
        id: `custom:${trimmed}`,
        name: trimmed,
        url: trimmed,
        builtin: false,
        enabled: true,
        latency_ms: probe.latency,
        cluster_id: null,
        is_lb: false,
        last_seen_at: new Date().toISOString(),
        role: 'backup',
        status: probe.status,
      }
      customSources = [...customSources.filter((s) => normUrl(s.url) !== trimmed), entry]
      await persistSources()
      sources = mergeSources()
      return sources
    },
    async removeSource(id) {
      await restoreSources()
      const removed = customSources.find((s) => s.id === id) ?? sources.find((s) => s.id === id)
      customSources = customSources.filter((s) => s.id !== id)
      if (removed && !removed.builtin) sourcePasswords.delete(normUrl(removed.url))
      await persistSources()
      sources = mergeSources()
      return sources
    },
    async pingSource(id) {
      const target = mergeSources().find((s) => s.id === id)
      if (!target) return sources
      // 测速开始：先置「连接中」（乐观状态，UI 即时反馈），探测完成后更新
      customSources = customSources.map((s) => (s.id === id ? { ...s, status: 'connecting' as const } : s))
      nodeSources = nodeSources.map((s) => (s.id === id ? { ...s, status: 'connecting' as const } : s))
      sources = mergeSources()
      notify()
      const probe = await probeUrl(target.url)
      if (target.builtin) {
        baseHealth.set(normUrl(target.url), { reachable: probe.status === 'connected', latency: probe.latency })
      }
      customSources = customSources.map((s) =>
        s.id === id ? { ...s, latency_ms: probe.latency, status: probe.status, last_seen_at: new Date().toISOString() } : s,
      )
      nodeSources = nodeSources.map((s) =>
        s.id === id ? { ...s, latency_ms: probe.latency, status: probe.status, last_seen_at: new Date().toISOString() } : s,
      )
      await persistSources()
      sources = mergeSources()
      return sources
    },
    async switchSource(id) {
      await restoreSources()
      const target = mergeSources().find((s) => s.id === id)
      if (!target) return state()
      // 换源规则（v3.4）：切到独立源自动登出 GitHub（本地数据保留）；切到 LB 集群内源保持登录。
      if (target.is_lb === false && opts.tokenStore) opts.tokenStore.current = null
      activeBase = normUrl(target.url)
      source = makeSource(activeBase)
      await persistSources()
      await load()
      return state()
    },
    async addCombo(name, desc, members) {
      const t = currentToken()
      if (!t) throw new Error('请先登录 GitHub 后再发布组合')
      let res: Response
      try {
        res = await dataFetch(currentBase() + API.createCombo, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name, description: desc, members }),
        })
      } catch {
        throw new Error('发布失败：服务端不可达')
      }
      if (!res.ok) {
        let msg = '发布失败，请稍后再试'
        try {
          const body = (await res.json()) as { message?: string }
          if (body.message) msg = body.message
        } catch {
          /* 保留默认错误 */
        }
        throw new Error(msg)
      }
      const created = (await res.json()) as Combo
      combos = [...combos, created]
      // 组合已变更：重置在线刷新窗口，让随后的 refreshCombos 必定向服务器拉取权威数据
      combosFetchedAt = 0
      return combos
    },
    async updateCombo(id, name, desc, members) {
      const t = currentToken()
      if (!t) throw new Error('请先登录 GitHub 后再编辑组合')
      let res: Response
      try {
        res = await dataFetch(currentBase() + API.createCombo + '/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ name, description: desc, members }),
        })
      } catch {
        throw new Error('保存失败：服务端不可达')
      }
      if (!res.ok) {
        let msg = '保存失败：组合不存在或不是你的组合'
        try {
          const body = (await res.json()) as { message?: string }
          if (body.message) msg = body.message
        } catch {
          /* 保留默认错误 */
        }
        throw new Error(msg)
      }
      const updated = (await res.json()) as Combo
      combos = combos.map((c) => (c.id === id ? updated : c))
      combosFetchedAt = 0
      return combos
    },
    async removeCombo(id) {
      const t = currentToken()
      if (!t) throw new Error('请先登录 GitHub 后再删除组合')
      let res: Response
      try {
        res = await dataFetch(currentBase() + API.createCombo + '/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: authHeaders(),
        })
      } catch {
        throw new Error('删除失败：服务端不可达')
      }
      if (!res.ok) {
        let msg = '删除失败：组合不存在或不是你的组合'
        try {
          const body = (await res.json()) as { message?: string }
          if (body.message) msg = body.message
        } catch {
          /* 保留默认错误 */
        }
        throw new Error(msg)
      }
      const body = (await res.json()) as { combos?: Combo[] }
      if (body.combos) combos = body.combos
      combosFetchedAt = 0
      return combos
    },
    async reportMissing(pkg, repoUrl, version) {
      const t = currentToken()
      if (!t) return { ok: false, message: '请先登录后再上报插件信息' }
      try {
        const res = await dataFetch(currentBase() + API.reportMissing, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ pkg, repo_url: repoUrl, version }),
        })
        if (!res.ok) return { ok: false, message: '上报失败，请稍后再试' }
        const body = (await res.json()) as { message?: string }
        return { ok: true, message: body.message ?? '已上报，等待管理员收录' }
      } catch {
        return { ok: false, message: '上报失败：服务端不可达' }
      }
    },
    async updateClientPlugin(spec, version) {
      // 客户端插件自身更新：走 Host 本地安装器 /client RPC（生产环境执行真实 dsh plugin add）。
      try {
        const r = await rpcCall('/client', { install: spec, version })
        return { ok: true, message: r.message || `已开始在线更新：dsh plugin add ${spec}@${version}` }
      } catch (e) {
        // 安装器未连接/命令失败：明确报错，不让 UI 静默无反馈
        return { ok: false, message: `更新失败：${e instanceof Error ? e.message : String(e)}` }
      }
    },
    async deleteAccount(combos) {
      const t = currentToken()
      if (!t) return { ok: false, message: '请先登录后再注销账号' }
      try {
        const res = await dataFetch(currentBase() + API.meDeactivate, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ combos }),
        })
        if (!res.ok) return { ok: false, message: '注销失败，请稍后再试' }
        const body = (await res.json()) as { message?: string }
        return { ok: true, message: body.message ?? '账号已注销' }
      } catch {
        return { ok: false, message: '注销失败：服务端不可达' }
      }
    },
    async restorePlugins(ps) {
      const failures: string[] = []
      const current = effectiveInstalled()
      for (const p of ps) {
        // 防重复安装：已装插件跳过恢复。
        if (current[p]) continue
        const item = plugins.find((x) => x.id === p)
        try {
          await rpcCall('/install', {
            pkg: p,
            version: item?.version ?? latestVersion(plugins, p),
            install: item?.install ?? '',
            repoUrl: item?.repo_url ?? '',
          })
          await ledger.addInstall(installRecord(p, latestVersion(plugins, p)))
          realInstalled.set(p, latestVersion(plugins, p))
          void source.reportInstall(p)
        } catch (e) {
          failures.push(`${p}：${String((e as Error)?.message ?? e)}`)
        }
      }
      await syncCloud()
      if (failures.length > 0) {
        throw new Error(`部分插件恢复失败（${failures.length}/${ps.length}）\n${failures.slice(0, 3).join('\n')}`)
      }
      return { installed: effectiveInstalled(), subscriptions: { ...subscriptions } }
    },
    async restoreAgents(ids) {
      const failures: string[] = []
      const current = effectiveInstalled()
      for (const id of ids) {
        const p = plugins.find((x) => x.id === id)
        if (!p) continue
        // 防重复安装：多键匹配已装（id/name/preset_name/仓库短名任一命中）即跳过
        const already = agentInstalledKey(p, current) !== null
        if (already) continue
        try {
          await rpcCall('/preset', {
            pkg: id,
            presetName: p.preset_name ?? p.name ?? id,
            repoUrl: p.repo_url ?? '',
          })
          await ledger.addInstall(installRecord(id, p.version ?? '1.0.0'))
          realInstalled.set(id, p.version ?? '1.0.0')
          void source.reportInstall(id)
        } catch (e) {
          failures.push(`${id}：${String((e as Error)?.message ?? e)}`)
        }
      }
      await syncCloud()
      if (failures.length > 0) {
        throw new Error(`部分 Agent 恢复失败（${failures.length}/${ids.length}）\n${failures.slice(0, 3).join('\n')}`)
      }
      return { installed: effectiveInstalled(), subscriptions: { ...subscriptions } }
    },
    async restoreSubscriptions(cs) {
      const failures: string[] = []
      for (const name of cs) {
        subscriptions[name] = true
        const c = combos.find((x) => x.name === name)
        if (!c) continue
        const current = effectiveInstalled()
        for (const m of c.members) {
          // 防重复安装：已装成员跳过恢复。
          if (current[m.pkg]) continue
          const item = plugins.find((x) => x.id === m.pkg)
          const memberVersion = item?.version ?? (m.version && m.version !== '*' ? m.version : latestVersion(plugins, m.pkg))
          try {
            await rpcCall('/install', {
              pkg: m.pkg,
              version: memberVersion,
              install: item?.install ?? '',
              repoUrl: item?.repo_url ?? '',
            })
            await ledger.addInstall(installRecord(m.pkg, latestVersion(plugins, m.pkg)))
            realInstalled.set(m.pkg, latestVersion(plugins, m.pkg))
            void source.reportInstall(m.pkg)
          } catch (e) {
            failures.push(`${m.pkg}：${String((e as Error)?.message ?? e)}`)
          }
        }
      }
      await syncCloud()
      await persistSubs()
      if (failures.length > 0) {
        throw new Error(`部分组合成员恢复失败（${failures.length}）：\n${failures.slice(0, 3).join('\n')}`)
      }
      return { installed: effectiveInstalled(), subscriptions: { ...subscriptions } }
    },
    async ackUpdate(pkg) {
      acked[pkg] = latestVersion(plugins, pkg)
      return { ...acked }
    },
    async ackAll() {
      const inst = toInstalledMap(ledger)
      for (const [pkg, iv] of Object.entries(inst)) {
        const p = plugins.find((x) => x.id === pkg)
        if (p && isUpdateAvailable(iv, p.version)) acked[pkg] = p.version
      }
      return { ...acked }
    },
  }
}
