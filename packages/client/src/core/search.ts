import type { Plugin } from '@dsh-store/shared'

/**
 * 本地搜索（v3 §6：搜索全程本地，零网络）。
 *
 * 对包名/名称/简介/仓库/作者/安装地址/标签做大小写不敏感的子串与分词匹配，
 * 返回按命中质量排序的结果。权重与阈值由服务器配置下发（search_threshold）。
 *
 * 性能约束（v3.5）：服务器插件库 3000+ 条，禁止对每条目所有字段做全量编辑距离——
 * 编辑距离只在「子串未命中」且为单 token 时，对短字段（名称/id/作者/仓库）计算。
 */
export interface Searchable {
  id: string
  name: string
  description: string
  tags?: string[]
  /** 仓库全名（owner/repo），支持按仓库搜索。 */
  repo?: string
  /** 作者（GitHub owner），支持按作者搜索。 */
  author?: string
  /** 安装 spec（npm 包名 / github:owner/repo）。 */
  install?: string
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
    .filter(Boolean)
}

export function scoreText(haystack: string, query: string): number {
  const h = haystack.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (h === q) return 100
  if (h.startsWith(q)) return 80
  if (h.includes(q)) return 60
  const qt = tokenize(q)
  const ht = tokenize(h)
  let hits = 0
  for (const t of qt) {
    // 短 token 只做前缀匹配，避免 "io" 这类碎片把结果污染成全量
    const hit = ht.some((w) => (t.length >= 3 ? w.startsWith(t) || w.includes(t) : w.startsWith(t)))
    if (hit) hits++
  }
  return hits > 0 ? Math.round((hits / qt.length) * 40) : 0
}

/** 编辑距离（Levenshtein）。仅用于短字段（名称/id/作者/仓库），长度可控。 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/** 错拼容错：查询 ≥4 字符、与某 token 长度差 ≤2 且编辑距离 ≤2 时给容错分。 */
function scoreFuzzy(haystack: string, query: string): number {
  const q = query.toLowerCase().trim()
  if (q.length < 4) return 0
  const h = haystack.toLowerCase()
  let best = Infinity
  for (const w of tokenize(h)) {
    if (w.length < 4 || Math.abs(w.length - q.length) > 2) continue
    best = Math.min(best, editDistance(w, q))
  }
  if (best === 1) return 35
  if (best === 2) return 20
  return 0
}

/** 参与模糊匹配的短字段（描述等长文本不做编辑距离，避免 3000×大 O 计算）。 */
const FUZZY_FIELDS = ['name', 'id', 'author', 'repo'] as const

export function searchPlugins<T extends Searchable>(
  list: readonly T[],
  query: string,
  threshold = 1,
): T[] {
  const q = query.trim()
  if (!q) return [...list]
  const ql = q.toLowerCase()
  const tokens = tokenize(q)
  const seen = new Set<string>()
  const scored: Array<{ item: T; score: number }> = []

  for (const item of list) {
    // 服务器历史数据存在重复 id：按 id 去重，避免 React key 冲突与重复卡片。
    if (item.id && seen.has(item.id)) continue
    if (item.id) seen.add(item.id)

    const fields = [item.id, item.name, item.description, item.repo, item.author, item.install, ...(item.tags ?? [])].filter(
      (f): f is string => !!f,
    )
    let score = 0
    for (const f of fields) {
      const s = scoreText(f, ql)
      if (s > score) score = s
    }
    if (score === 0 && tokens.length > 1) {
      // 多词 AND 语义：每个 token 都命中某个字段（如 "chat gpt"、"星 数"）。
      let all = true
      for (const t of tokens) {
        if (!fields.some((f) => f.toLowerCase().includes(t))) {
          all = false
          break
        }
      }
      if (all) score = 30
    }
    if (score === 0 && tokens.length === 1) {
      // 单 token 错拼容错：只对短字段计算编辑距离。
      const t = tokens[0]
      if (t.length >= 4) {
        for (const key of FUZZY_FIELDS) {
          const f = item[key]
          if (!f) continue
          const s = scoreFuzzy(f, ql)
          if (s > score) score = s
        }
      }
    }
    if (score >= threshold) scored.push({ item, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((r) => r.item)
}

export { type Plugin }
