import type { Combo, InstallRecord, NotificationItem, Plugin } from '@dsh-store/shared'
import { isUpdateAvailable } from './versions.js'

/**
 * 通知中心（v3.1 S2.4 硬要求：每条通知必带定位 target，禁止"只说有更新"）。
 * 分类：update / pending / system（公告走独立抽屉，不进通知中心）。
 */

function pluginIndex(plugins: readonly Plugin[]): Map<string, Plugin> {
  return new Map(plugins.map((p) => [p.id, p]))
}

/** 单个/组内插件更新检测（纯本地比对，零网络）。 */
export function detectPluginUpdates(
  ledger: readonly InstallRecord[],
  plugins: readonly Plugin[],
): NotificationItem[] {
  const index = pluginIndex(plugins)
  const out: NotificationItem[] = []
  for (const rec of ledger) {
    const latest = index.get(rec.pkg)
    if (!latest) continue
    if (isUpdateAvailable(rec.version, latest.version)) {
      const comboLabel = rec.combo_id ? `（归属组 ${rec.combo_id}）` : ''
      out.push({
        id: `update:${rec.pkg}`,
        category: 'update',
        title: `🔵 ${rec.pkg} 有更新：v${rec.version} → v${latest.version}${comboLabel}（请到插件详情 🔗 仓库按 README 手动更新）`,
        target: `plugin:${rec.pkg}`,
        actions: [{ label: '知道了', action: 'ignore' }],
      })
    }
  }
  return out
}

/** 订阅组新增成员检测（本地快照 hash ≠ 下发 hash → diff 新增成员）。 */
export function detectComboAdditions(
  combo: Combo,
  previousMembers: readonly string[],
): string[] {
  const prev = new Set(previousMembers)
  return combo.members.map((m) => m.pkg).filter((p) => !prev.has(p))
}

/** 库外插件上报询问（v3.1 S4，归入 pending 分类）。 */
export function buildMissingReportNotification(pkgs: readonly string[]): NotificationItem {
  return {
    id: 'pending:missing',
    category: 'pending',
    title: `❓ 扫描发现 ${pkgs.length} 个库外插件：${pkgs.join('、')}。是否上报以帮助收录？`,
    target: 'settings:sources',
    actions: [
      { label: '上报', primary: true, action: 'report:missing' },
      { label: '否，不再询问', action: 'ignore' },
    ],
  }
}


