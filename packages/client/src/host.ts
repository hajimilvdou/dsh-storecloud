import type {
  Announcement,
  Combo,
  Delta,
  Manifest,
  Plugin,
  ServerSource,
} from '@dsh-store/shared'
import { detectPluginUpdates, searchPlugins, topTrending } from './core/index.js'
import { computeBadge } from './core/badge.js'
import type { DataSource } from './data/source.js'
import { Ledger } from './store/ledger.js'
import type { UIAdapter } from './adapters/types.js'

/**
 * 业务核心编排器（环境无关）：持有数据源 + 台账 + UIAdapter，
 * 负责同步、索引、榜单、搜索、通知与角标。UI 层只读它的查询结果。
 */
export class StoreClient {
  private manifest: Manifest | null = null
  private plugins: Plugin[] = []
  private combos: Combo[] = []
  private announcements: Announcement[] = []
  private sources: ServerSource[] = []
  private pluginsRevision: string | undefined
  private combosRevision: string | undefined
  private hasUnreadAnnouncement = false

  constructor(
    readonly source: DataSource,
    readonly ledger: Ledger,
    private readonly adapter: UIAdapter,
  ) {}

  async start(): Promise<void> {
    await this.ledger.load()
    await this.adapter.mount()
    await this.sync()
    this.refreshBadge()
  }

  /** manifest 心跳 + 增量拉取（变了才拉，全量兜底）。 */
  async sync(): Promise<void> {
    this.manifest = await this.source.fetchManifest()
    this.sources = await this.source.listNodes()
    this.plugins = applyDelta(this.plugins, await this.source.fetchPlugins(this.pluginsRevision))
    this.pluginsRevision = this.manifest.plugins_revision
    this.combos = applyDelta(this.combos, await this.source.fetchCombos(this.combosRevision))
    this.combosRevision = this.manifest.combos_revision
    this.announcements = await this.source.fetchAnnouncements()
    this.refreshBadge()
  }

  getManifest(): Manifest | null {
    return this.manifest
  }

  searchPlugins(query: string): Plugin[] {
    return searchPlugins(this.plugins, query)
  }

  getTrending(size?: number): Plugin[] {
    return topTrending(this.plugins, size ?? this.manifest?.client_config.trending_size ?? 20)
  }

  listPlugins(): Plugin[] {
    return [...this.plugins]
  }

  listCombos(): Combo[] {
    return [...this.combos]
  }

  listAnnouncements(): Announcement[] {
    return [...this.announcements]
  }

  listSources(): ServerSource[] {
    return [...this.sources]
  }

  refreshBadge(): void {
    const updates = detectPluginUpdates(this.ledger.listInstalls(), this.plugins)
    this.adapter.setBadge(computeBadge(updates, this.hasUnreadAnnouncement))
  }

  /** 安装：写入台账 + 快照还原点 + 落地（真实实现由安装器完成）。 */
  async install(pkg: string, opts: { comboId?: string } = {}): Promise<void> {
    const plugin = this.plugins.find((p) => p.id === pkg)
    if (!plugin) throw new Error(`未找到插件: ${pkg}`)
    await this.ledger.checkpoint({ before: this.ledger.listInstalls() })
    await this.ledger.addInstall({
      pkg,
      version: plugin.version,
      installed_at: new Date().toISOString(),
      source: opts.comboId ? 'combo' : 'single',
      combo_id: opts.comboId ?? null,
      restore_point_id: null,
    })
    this.refreshBadge()
  }

  async uninstall(pkg: string): Promise<void> {
    await this.ledger.checkpoint({ before: this.ledger.listInstalls() })
    await this.ledger.removeInstall(pkg)
    this.refreshBadge()
  }

  dispose(): void {
    this.adapter.dispose()
  }
}

/** 应用增量：full 替换，否则按 id upsert 并处理墓碑。 */
function applyDelta<T extends { id: string }>(current: T[], delta: Delta<T>): T[] {
  if (delta.full) return delta.items
  const map = new Map(current.map((i) => [i.id, i]))
  for (const item of delta.items) map.set(item.id, item)
  for (const id of delta.tombstones) map.delete(id)
  return [...map.values()]
}

/** Host 半插件入口（Node 侧）：探测环境 → 选 Adapter → 起 StoreClient。 */
export function createHostPlugin(options?: { source?: DataSource }): { apply: (ctx: unknown) => void } {
  return {
    apply(ctx) {
      // TODO(host): 从 DSH ctx 读取文件系统/日志/插件树，构建 KeyValueStore 与 HttpDataSource；
      // 探测运行环境（webui / cli / headless）→ 选择 WebUIAdapter 或 AddressAdapter；
      // new StoreClient(source, ledger, adapter).start()；所有副作用经 ctx.effect 登记以支持卸载。
      void ctx
      void options
    },
  }
}
