/**
 * 极简语义化版本比较（v3.1 S2.3 更新检测"纯本地比对"用）。
 * 支持 "x.y.z"、"x.y"、含 "v" 前缀；缺段按 0 处理。
 * 生产可替换为 semver；这里零依赖、够用。
 */
export function parseVersion(v: string): [number, number, number] {
  const m = v.trim().replace(/^v/, '').split('.')
  const n = (i: number): number => {
    const s = m[i] ?? '0'
    const d = parseInt(s, 10)
    return Number.isNaN(d) ? 0 : d
  }
  return [n(0), n(1), n(2)]
}

/** a > b 返回 1，a < b 返回 -1，相等返回 0。 */
export function compareVersions(a: string, b: string): number {
  const [a0, a1, a2] = parseVersion(a)
  const [b0, b1, b2] = parseVersion(b)
  if (a0 !== b0) return a0 > b0 ? 1 : -1
  if (a1 !== b1) return a1 > b1 ? 1 : -1
  if (a2 !== b2) return a2 > b2 ? 1 : -1
  return 0
}

/** 已安装版本是否落后于最新版本（'*' 表示跟随最新，永不判定为可更新）。 */
export function isUpdateAvailable(installed: string, latest: string): boolean {
  if (installed === '*' || latest === '*') return false
  return compareVersions(latest, installed) > 0
}
