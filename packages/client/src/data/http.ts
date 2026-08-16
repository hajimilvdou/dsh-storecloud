import { API, type Announcement, type Combo, type Delta, type Manifest, type NodeInfo, type Plugin, type ServerSource } from '@dsh-store/shared'
import type { DataSource } from './source.js'

/** 可替换的 fetch 实现（浏览器里 CORS 受限时改为走 Host 本地代理）。 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

const FALLBACK_MANIFEST: Manifest = {
  protocol_version: '1.0.0',
  software_version: '0.0.0',
  cluster_id: null,
  server_time: new Date(0).toISOString(),
  plugins_revision: '0',
  combos_revision: '0',
  latest_announcement_id: null,
  features: { trending: true, likes: true, combos: true, announcements: true, federation: false },
  nodes: [],
  client_plugin: null,
  client_config: {
    trending_size: 20,
    search_threshold: 0.4,
    onboarding_auto_open_times: 3,
    server_local_port: 0,
    ui_default_theme: 'system',
    ui_window_min: [360, 480],
    ui_window_max: [720, 900],
    data_heartbeat_min: 30,
    combos_refresh_min: 30,
    restore_max_points: 10,
    combo_limit: 3,
  },
}

/**
 * HTTP 数据源：对接 dsh-store-server 的数据通道（增量 + 全量兜底）。
 * 离线/失败时返回空结果，由上层（HttpBridge）处理降级。
 */
export class HttpDataSource implements DataSource {
  readonly id: string
  readonly name = 'HTTP 源'

  constructor(
    readonly baseUrl: string,
    private readonly getToken?: () => string | null,
    private readonly getAccessPassword?: () => string,
    private readonly fetchFn?: FetchLike,
  ) {
    this.id = baseUrl
  }

  /** 统一走可替换 fetch：同源直连，跨源（自定义服务器源）经 Host 本地代理。 */
  private async request(url: string, init?: RequestInit): Promise<Response> {
    const f = this.fetchFn ?? ((u: string, i?: RequestInit) => fetch(u, i))
    return f(url, init)
  }

  /** 统一请求头：JWT（可选，登录后）+ 源服务器连接密码（可选，服务端配置后必须携带）。 */
  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const out: Record<string, string> = { ...extra }
    const token = this.getToken?.()
    if (token) out.Authorization = `Bearer ${token}`
    const password = this.getAccessPassword?.() ?? ''
    if (password) out['X-Access-Password'] = password
    return out
  }

  private async get<T>(path: string): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // 20s 兜底超时：宿主代理最长 20s×4 次重试，客户端不能无限等待(界面卡死)。
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 20000)
        const res = await this.request(this.baseUrl + path, { headers: this.headers(), signal: ctrl.signal })
        clearTimeout(timer)
        if (!res.ok) return null
        return (await res.json()) as T
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
      }
    }
    return null
  }

  private anonToken: string | null = null

  /**
   * 安装/下载计数上报（v3.2 S8.3 匿名通道）：
   * 首次换取匿名会话凭证（绑定源地址），随后带 X-Anon-Token 上报；
   * 服务端按 token+目标 1h 窗口去重，按天聚合产出 downloads_7d。
   */
  async reportInstall(target: string): Promise<void> {
    try {
      if (!this.anonToken) {
        const res = await this.request(this.baseUrl + API.anonToken, {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ instance_id: this.id }),
        })
        if (res.ok) this.anonToken = ((await res.json()) as { token?: string }).token ?? null
      }
      if (!this.anonToken) return
      await this.request(this.baseUrl + API.downloads, {
        method: 'POST',
        headers: this.headers({ 'Content-Type': 'application/json', 'X-Anon-Token': this.anonToken }),
        body: JSON.stringify({ target }),
      })
    } catch {
      /* 计数失败不影响安装 */
    }
  }

  async latencyMs(): Promise<number> {
    const t0 = Date.now()
    await this.get('/health')
    return Date.now() - t0
  }

  async fetchManifest(): Promise<Manifest> {
    return (await this.get<Manifest>(API.manifest)) ?? FALLBACK_MANIFEST
  }

  async fetchPlugins(since?: string): Promise<Delta<Plugin>> {
    const q = since ? `?since=${encodeURIComponent(since)}` : ''
    return (await this.get<Delta<Plugin>>(`${API.plugins}${q}`)) ?? { revision: '0', items: [], full: true, tombstones: [] }
  }

  async fetchCombos(since?: string): Promise<Delta<Combo>> {
    const q = since ? `?since=${encodeURIComponent(since)}` : ''
    return (await this.get<Delta<Combo>>(`${API.combos}${q}`)) ?? { revision: '0', items: [], full: true, tombstones: [] }
  }

  async fetchAnnouncements(): Promise<Announcement[]> {
    return (await this.get<Announcement[]>(API.announcements)) ?? []
  }

  async listNodes(): Promise<ServerSource[]> {
    const m = await this.get<{ nodes?: NodeInfo[] }>(API.manifest)
    return (m?.nodes ?? []).map((n) => ({
      id: n.id,
      name: n.name,
      url: n.url,
      builtin: false,
      enabled: n.healthy,
      latency_ms: n.rtt_ms,
      cluster_id: null,
      is_lb: n.is_lb,
      last_seen_at: null,
      role: 'backup',
      status: n.healthy ? 'connected' : 'disconnected',
    }))
  }
}
