import type { NotificationItem } from '@dsh-store/shared'

/**
 * 悬浮球双角标语义（v3.2 S2.4 / v3.4 M3）：
 * - 🔴 `!` 公告（管理端手动发布）
 * - 🔵 数字 更新/待办（可更新数 + 待确认上报数；"源与系统"类不计入）
 */
export interface BadgeState {
  announcement: boolean
  pending_count: number
}

export function computeBadge(
  notifications: readonly NotificationItem[],
  hasUnreadAnnouncement: boolean,
): BadgeState {
  const pending = notifications.filter((n) => n.category !== 'system').length
  return { announcement: hasUnreadAnnouncement, pending_count: pending }
}
