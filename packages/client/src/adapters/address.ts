import type { BadgeState } from '../core/badge.js'
import type { UIAdapter } from './types.js'

/**
 * 地址模式适配器：无 WebUI（CLI / headless）时，插件内嵌轻量本地页面，
 * 绑定 127.0.0.1:{port}，浏览器访问。功能与 WebUI 面板完全一致（同一套组件）。
 *
 * 骨架：接口占位。真实实现需在 Node 起本地 HTTP 服务（仅 127.0.0.1），
 * 并实现前三次自动打开引导（onboarding.auto_open_times，默认 3）。
 */
export class AddressAdapter implements UIAdapter {
  readonly kind = 'address' as const
  private readonly port: number

  constructor(port = 0) {
    this.port = port
  }

  async mount(): Promise<void> {
    // TODO(host): 起本地 HTTP 服务（127.0.0.1:port），返回端口；port=0 自动分配
    void this.port
  }

  openPanel(): void {
    // TODO(host): 前三次自动打开浏览器访问本地地址（可永久关闭）
  }

  closePanel(): void {}

  notify(message: string): void {
    void message
  }

  setBadge(state: BadgeState): void {
    void state
  }

  dispose(): void {
    // TODO(host): 关闭本地 HTTP 服务
  }
}
