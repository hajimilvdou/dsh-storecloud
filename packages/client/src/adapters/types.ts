import type { BadgeState } from '../core/badge.js'

/**
 * UIAdapter 抽象（v3 §7B.1）：业务核心只调统一接口，
 * 环境差异（WebUI 注入 DOM / 地址模式本地端口）收敛在适配层。
 * 未来 TUI、IDE 内嵌、移动端 Web 均只新增一个 Adapter，不动业务。
 */
export interface UIAdapter {
  readonly kind: 'webui' | 'address' | 'headless'
  mount(): Promise<void>
  openPanel(): void
  closePanel(): void
  /** 一条用户可见的提示（如地址模式下的引导文案）。 */
  notify(message: string): void
  /** 同步悬浮球/顶栏双角标状态。 */
  setBadge(state: BadgeState): void
  dispose(): void
}
