import type { BadgeState } from '../core/badge.js'
import type { UIAdapter } from './types.js'

/**
 * WebUI 模式适配器：右下角漂浮球 ↔ 点击展开面板窗口。
 * 可调大小（最小 360×480 / 最大 720×900）、明暗主题、位置记忆、Esc 关闭。
 *
 * 骨架：接口占位。真实实现由「客户端优先」阶段接入 DSH Client Slot 与 React 组件完成，
 * 视觉基准见原型 dsh-store-ui-prototype.html。
 */
export class WebUIAdapter implements UIAdapter {
  readonly kind = 'webui' as const

  async mount(): Promise<void> {
    // TODO(client): 在 DSH WebUI 注册漂浮球 Slot + 面板窗口（React 组件，见 client.tsx）
  }

  openPanel(): void {
    // TODO(client): 展开面板窗口
  }

  closePanel(): void {
    // TODO(client): 收起面板（Esc 关闭 / 收纳成小球）
  }

  notify(message: string): void {
    // TODO(client): 漂浮球引导气泡（仅首次显示一次）
    void message
  }

  setBadge(state: BadgeState): void {
    // TODO(client): 🔴 公告叹号 + 🔵 更新/待办数字
    void state
  }

  dispose(): void {
    // TODO(client): 移除 Slot、注销快捷键、清理监听
  }
}
