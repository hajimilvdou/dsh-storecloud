import type { Plugin } from '@dsh-store/shared'

/** 插件搜索页排序项（v3.2 S9.2：本地排序，切换零网络，选择记忆到本地设置）。 */
export type PluginSortKey = 'default' | 'stars' | 'likes' | 'stars7'

/**
 * 排序计算全部本地：数据通道已下发，离线可用。
 * `default`（综合）保持服务端下发顺序。
 * `stars7` = 近 7 天 GitHub 星数增量（用户端"近7天收藏增加"指标，替代原"近7天下载"）。
 */
export function sortPlugins(list: readonly Plugin[], key: PluginSortKey): Plugin[] {
  const arr = [...list]
  switch (key) {
    case 'stars':
      return arr.sort((a, b) => b.stars - a.stars)
    case 'likes':
      return arr.sort((a, b) => b.likes - a.likes)
    case 'stars7':
      return arr.sort((a, b) => b.stars_delta_7d - a.stars_delta_7d)
    default:
      return arr
  }
}
