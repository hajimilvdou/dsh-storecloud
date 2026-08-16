import type { Plugin } from '@dsh-store/shared'

/**
 * 发布组合前的库内校验（v3.1 S6）：
 * 组合成员必须已被本地插件库收录；用户自制的、未上传的插件不允许进入组合发布。
 * 返回"库中没有"的包名列表（空数组 = 全部在库，可发布）。
 */
export function missingFromLibrary(
  selected: readonly string[],
  plugins: readonly { id: string }[],
): string[] {
  const ids = new Set(plugins.map((p) => p.id))
  return selected.filter((id) => !ids.has(id))
}

export type { Plugin }
