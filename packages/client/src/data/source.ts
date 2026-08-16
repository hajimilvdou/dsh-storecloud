import type {
  Announcement,
  Combo,
  Delta,
  Manifest,
  Plugin,
  ServerSource,
} from '@dsh-store/shared'

/**
 * 数据源抽象：客户端业务核心只面向此接口，不关心数据来自真实服务端还是 mock。
 * 主源制（v3.3 F1.2）：同一时刻仅一个主源提供数据通道；其余为候选，故障自动转移。
 */
export interface DataSource {
  id: string
  name: string
  /** 实测延迟（用于源列表展示与故障转移排序）。 */
  latencyMs(): Promise<number>
  fetchManifest(): Promise<Manifest>
  fetchPlugins(since?: string): Promise<Delta<Plugin>>
  fetchCombos(since?: string): Promise<Delta<Combo>>
  fetchAnnouncements(): Promise<Announcement[]>
  listNodes(): Promise<ServerSource[]>
  /** 安装/下载计数上报（匿名凭证 + 1h 窗口去重；失败静默，不影响安装）。 */
  reportInstall(target: string): Promise<void>
}
