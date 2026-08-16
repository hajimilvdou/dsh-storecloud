import type { Plugin } from '@dsh-store/shared'

/**
 * 今日星增 Top N（Trending，v3 §7A）。
 * 口径：stars_delta_day 降序；新收录首日标记 new 不参与增量排行（策略可配置）。
 * 生成方为服务器（依赖全量快照），客户端仅做展示兜底排序，展示零网络。
 */
export function topTrending(
  list: readonly Plugin[],
  size: number,
  opts: { skipNew?: boolean } = {},
): Plugin[] {
  const { skipNew = true } = opts
  const pool = skipNew ? list.filter((p) => !p.is_new) : list
  return [...pool]
    .sort(
      (a, b) =>
        b.stars_delta_day - a.stars_delta_day ||
        (a.trending_rank ?? Number.MAX_SAFE_INTEGER) -
          (b.trending_rank ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, size)
}
