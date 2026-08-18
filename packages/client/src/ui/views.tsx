import { useEffect, useRef, useState } from 'react'
import type { Combo, Plugin } from '@dsh-store/shared'
import type { PluginSortKey } from '../core/index.js'
import { agentInstalledKey, type CloudList, type ComboMemberInput } from './bridge.js'
import { BatchDeleteBar, ConfirmDelete, Desc, hasUpdate, Metrics, sourceBadge, srcLink, typeBadge } from './components.js'

type Installed = Record<string, string>

/** 安装/更新入口已下线（用户端去安装化）：一律跳转仓库按 README 手动安装；预留一键上架接口。 */
function pluginRepoLink(p?: Plugin | null) {
  const url = (p && (p.repo_url || (p.repo ? `https://github.com/${p.repo}` : ''))) || ''
  if (!url) return null
  return (
    <a className="dshs-abtn" href={url} target="_blank" rel="noopener noreferrer" title="去仓库按 README 手动安装（一键安装已下线）">
      🔗 仓库
    </a>
  )
}

/** 插件页：趋势横滑 + 本地搜索 + 排序 + 列表；订阅组内插件有更新也在此显示。 */
export function SearchView(props: {
  trending: Plugin[]
  results: Plugin[]
  query: string
  installed: Installed
  sort: PluginSortKey
  loggedIn: boolean
  onSort: (k: PluginSortKey) => void
  onPublish: () => void
  onOpenAccount: () => void
}) {
  // 服务器插件库有 3000+ 条目：结果分页渲染，避免一次渲染几千张卡片导致面板卡顿。
  const PAGE_SIZE = 80
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [props.query, props.sort])
  const shown = props.results.slice(0, page * PAGE_SIZE)
  const rest = props.results.length - shown.length
  return (
    <div>
      <div className="dshs-sec">
        📈 今日星增 Top 20
        <span>每日更新 · 横滑查看 →</span>
      </div>
      {props.trending.length ? (
        <div className="dshs-hscroll">
          {props.trending.map((p, i) => (
            <div className="dshs-tcard" key={p.id + ':' + i}>
              <span className="dshs-rk">#{i + 1}{p.is_new ? ' 🆕' : ''}</span>
              <span className="dshs-nm">{p.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--tx2)' }}>by {p.author ?? '—'}</span>
              {typeBadge(p)}
              <Desc text={p.description} />
              <Metrics p={p} />
              <div className="dshs-mrow">
                {srcLink(p)}
                {pluginRepoLink(p)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dshs-empty" style={{ padding: 12 }}>趋势榜在首次收录次日生成（需前一天星数快照差分），暂无数据</div>
      )}

      <div className="dshs-sec" style={{ marginTop: 12 }}>
        🔍 插件搜索
        <span>
          本地搜索 · 零网络 · {props.results.length} 个结果
          <button className="dshs-abtn" style={{ marginLeft: 8 }} onClick={props.onPublish}>发布插件 ↗</button>
        </span>
      </div>
      <div className="dshs-sortbar">
        排序：
        {(
          [
            ['default', '综合'],
            ['stars', '⭐ 星数'],
            ['stars7', '⭐ 近7天收藏'],
          ] as Array<[PluginSortKey, string]>
        ).map(([k, label]) => (
          <button key={k} className={props.sort === k ? 'on' : ''} onClick={() => props.onSort(k)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <>
          {shown.map((p) => {
            const up = hasUpdate(p, props.installed)
            return (
              <div className="dshs-vcard" key={p.id + ':' + p.repo}>
                <div className="dshs-l1">
                  <span className="dshs-nm">{p.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--tx2)' }}>by {p.author ?? '—'}</span>
                  {typeBadge(p)}
                  {sourceBadge(p)}
                  {up && p.kind !== 'preset' ? <span className="dshs-updot">有更新 v{props.installed[p.id]} → v{p.version}</span> : null}
                  <span className="dshs-compat">{p.kind === 'preset' ? 'Agent 预设' : 'dsh ≥0.1.0-rc.5'}</span>
                  {srcLink(p)}
                </div>
                <Desc text={p.description} style={{ margin: '5px 0 7px' }} />
                <Metrics p={p} />
                <div className="dshs-mrow" style={{ marginTop: 7 }}>
                  {pluginRepoLink(p)}
                </div>
              </div>
            )
          })}
          {rest > 0 ? (
            <div className="dshs-mrow" style={{ marginTop: 8 }}>
              <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => setPage(page + 1)}>
                ↓ 加载更多（还有 {rest} 个）
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="dshs-empty">
          未找到匹配插件 — 支持按名称 / 简介 / 作者 / 仓库 / 安装地址搜索
          {props.loggedIn ? (
            <div className="dshs-subnote" style={{ marginTop: 10, marginBottom: 8 }}>
              💡 找不到就上报插件名，我们会持续跟进并尽快收录。
            </div>
          ) : null}
          <div style={{ marginTop: 4 }}>
            {props.loggedIn ? (
              <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={props.onPublish}>
                📤 上报{props.query.trim() ? `「${props.query.trim()}」` : '插件'}
              </button>
            ) : (
              <button className="dshs-abtn" onClick={props.onOpenAccount}>登录 GitHub 后即可上报插件 →</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Agent 市场：只展示 kind=preset 的自定义 Agent（文件复制安装），与插件/组合分开。 */
export function AgentView(props: {
  agents: Plugin[]
  installed: Installed
  /** 顶部全局搜索词（在 Agent 页同样生效）。 */
  query: string
}) {
  const [q, setQ] = useState('')
  const localKw = q.trim().toLowerCase()
  const globalKw = props.query.trim().toLowerCase()
  const kw = localKw || globalKw
  // 安装 key 预计算（多键匹配，供排序与按钮状态共用）
  const keyOf = new Map(props.agents.map((a) => [a.id, agentInstalledKey(a, props.installed)]))
  // 与插件库一致：已安装靠前；组内按星数从高到低（用户期望的展示顺序），稳定排序。
  const sorted = [...props.agents].filter((a) => {
    if (!kw) return true
    return (
      a.name.toLowerCase().includes(kw) ||
      a.id.toLowerCase().includes(kw) ||
      a.description.toLowerCase().includes(kw) ||
      (a.preset_name ?? '').toLowerCase().includes(kw)
    )
  })
  sorted.sort((a, b) => {
    const sa = keyOf.get(a.id) ? 0 : 1
    const sb = keyOf.get(b.id) ? 0 : 1
    if (sa !== sb) return sa - sb
    return (b.stars ?? 0) - (a.stars ?? 0)
  })
  const results = sorted
  const PAGE_SIZE = 60
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [kw])
  const shown = results.slice(0, page * PAGE_SIZE)
  const rest = results.length - shown.length
  return (
    <div>
      <div className="dshs-sec">
        🤖 Agent 市场
        <span>{props.agents.length} 个 · 安装到 ~/.dsh/.agent-presets/</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索 Agent 名称 / 预设名 / 简介…（也可用顶部搜索框）" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {shown.length ? (
        <>
          {shown.map((a) => (
            <div className="dshs-vcard" key={a.id + ':' + a.repo}>
              <div className="dshs-l1">
                <span className="dshs-nm">{a.name}</span>
                {typeBadge(a)}
                <span className="dshs-compat">by {a.author ?? '—'}</span>
                {srcLink(a)}
              </div>
              <Desc text={a.description} style={{ margin: '5px 0 7px' }} />
              <div className="dshs-subnote" style={{ marginBottom: 8 }}>
                📁 preset/{a.preset_name ?? a.name} → ~/.dsh/.agent-presets/{a.preset_name ?? a.name} · 重启后新建空白会话选择
              </div>
              <Metrics p={a} />
              <div className="dshs-mrow" style={{ marginTop: 7 }}>
                {(() => {
                  const iv = keyOf.get(a.id) ? props.installed[keyOf.get(a.id) as string] : null
                  return iv ? (
                    <span className="dshs-pill primary">已装 v{iv}{a.version && iv !== a.version ? ` → 有更新 v${a.version}` : ''}</span>
                  ) : (
                    <span className="dshs-pill off">未安装（点下方 🔗 仓库手动安装）</span>
                  )
                })()}
                {pluginRepoLink(a)}
              </div>
            </div>
          ))}
          {rest > 0 ? (
            <div className="dshs-mrow" style={{ marginTop: 8 }}>
              <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => setPage(page + 1)}>
                ↓ 加载更多（还有 {rest} 个）
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="dshs-empty">{kw ? '未找到匹配的 Agent 预设' : '暂无 Agent 预设'}</div>
      )}
    </div>
  )
}

/** Agent 库：管理已安装的 Agent（更新 / 删除 / 云端同步），设计对齐插件库与组合库。 */
export function AgentLibraryView(props: {
  agents: Plugin[]
  installed: Installed
  cloud: CloudList
  onGoMarket: () => void
  onPushCloud: () => Promise<CloudList>
  onRefreshCloud: () => Promise<CloudList>
  /** 手动挑选上传 Agent（云端已有 + 勾选新增）。 */
  onUploadSelected: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
  /** 从云端删除指定项（仅云端清单，不动本地安装）。 */
  onDeleteCloud: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
}) {
  const [q, setQ] = useState('')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const [agentSel, setAgentSel] = useState<Record<string, boolean>>({})
  const kw = q.trim().toLowerCase()
  // 安装 key 预计算：市场有对应条目且本地已装 → 一定能显示（多键匹配 id/name/preset_name/仓库短名）
  const keyOf = new Map(props.agents.map((a) => [a.id, agentInstalledKey(a, props.installed)]))
  // 待上传 Agent：本地已装（多键匹配）但云端清单里没有的市场条目
  const cloudAgentSet = new Set(props.cloud.agents)
  const pendingAgents = props.agents.filter((a) => keyOf.get(a.id) !== null && keyOf.get(a.id) !== undefined && !cloudAgentSet.has(a.id))
  const entries = props.agents.filter((a) => {
    if (keyOf.get(a.id) === null || keyOf.get(a.id) === undefined) return false
    return !kw || a.name.toLowerCase().includes(kw) || a.id.toLowerCase().includes(kw) || (a.preset_name ?? '').toLowerCase().includes(kw)
  })
  const updates = entries.filter((a) => {
    const k = keyOf.get(a.id)
    return k !== null && k !== undefined && props.installed[k] !== a.version
  })
  return (
    <div>
      {/* 云端 Agent 折叠卡片：与插件库云端同款交互 */}
      <div className="dshs-cloudcard" style={{ marginTop: 10 }}>
        <div className="dshs-cloudcard-h" onClick={() => setCloudOpen(!cloudOpen)}>
          <span className="dshs-nm" style={{ fontWeight: 600 }}>☁️ 云端 Agent</span>
          <span className="dshs-compat">{props.cloud.agents.length} 个已保存</span>
          <span className="dshs-cloudcard-arrow">{cloudOpen ? '收起 ▴' : '展开 ▾'}</span>
        </div>
        {cloudOpen ? (
          <div className="dshs-cloudcard-body">
            <div className="dshs-subnote">云端保存的是你手动上传的 Agent 清单（不自动同步）。需要使用时请点条目上的 🔗 仓库链接，到仓库按 README 手动安装。</div>
            <div className="dshs-actions" style={{ marginTop: 6 }}>
              <button className="dshs-abtn" onClick={() => { if (!window.confirm('上传全部到云端：云端清单将覆盖为本地全部已装/已订阅项。确定？')) return; setCloudMsg('正在上传本地到云端…'); void props.onPushCloud().then((c) => setCloudMsg(`已上传：插件 ${c.plugins.length} · 组合 ${c.combos.length} · Agent ${c.agents.length}`)) }}>☁ 上传全部到云端</button>
              <button className="dshs-abtn" onClick={() => { setCloudMsg('正在从云端刷新…'); void props.onRefreshCloud().then((c) => setCloudMsg(`云端清单：插件 ${c.plugins.length} · 组合 ${c.combos.length} · Agent ${c.agents.length}`)) }}>↻ 从云端刷新</button>
              <button
                className="dshs-abtn dan"
                onClick={() => {
                  if (!window.confirm(`清空云端全部 Agent（${props.cloud.agents.length} 个）？仅移除云端清单，不影响本地安装。`)) return
                  setCloudMsg('正在清空云端 Agent…')
                  void props.onDeleteCloud({ agents: props.cloud.agents }).then(() => setCloudMsg('已清空云端 Agent')).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
                }}
              >
                🗑 删除全部
              </button>
            </div>
            {cloudMsg ? <div className="dshs-notif"><div className="nt">{cloudMsg}</div></div> : null}
            <div className="dshs-cloud-scroll">
              {props.cloud.agents.length ? (
                props.cloud.agents.map((id) => {
                  const a = props.agents.find((x) => x.id === id)
                  const iv = a ? agentInstalledKey(a, props.installed) : null
                  return (
                    <div className="dshs-pick" key={id}>
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>🤖 {a?.name ?? id}</span>
                      {a?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {a.author}</span> : null}
                      {iv ? <span className="dshs-pill primary">已装</span> : <span className="dshs-pill off">未装</span>}
                      {pluginRepoLink(a)}
                      <button
                        className="dshs-x"
                        title="从云端删除（不影响本地安装）"
                        onClick={() => {
                          if (!window.confirm(`从云端删除 Agent「${a?.name ?? id}」？仅移除云端清单。`)) return
                          setCloudMsg('正在从云端删除…')
                          void props.onDeleteCloud({ agents: [id] }).then(() => setCloudMsg(`已从云端删除：${a?.name ?? id}`)).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  )
                })
              ) : (
                <div className="dshs-empty" style={{ padding: 10 }}>云端暂无 Agent（登录后点击「上传本地到云端」保存）</div>
              )}
            </div>
            {/* 手动选择上传 Agent */}
            {pendingAgents.length ? (
              <>
                <div className="dshs-subnote" style={{ marginTop: 8 }}>🛫 待上传（本机已装、尚未进云端）：勾选后点「上传所选」</div>
                <div className="dshs-cloud-scroll">
                  {pendingAgents.map((a) => (
                    <div className="dshs-pick" key={a.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'A') setAgentSel({ ...agentSel, [a.id]: !agentSel[a.id] }) }}>
                      <input type="checkbox" checked={!!agentSel[a.id]} onChange={() => setAgentSel({ ...agentSel, [a.id]: !agentSel[a.id] })} />
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>🤖 {a.name}</span>
                      {a.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {a.author}</span> : null}
                      {a.repo_url ? (
                        <a className="dshs-lk" href={a.repo_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={a.repo_url}>🔗 仓库</a>
                      ) : null}
                      <span className="dshs-badge wa">未同步</span>
                    </div>
                  ))}
                </div>
                <button
                  className="dshs-abtn pri"
                  style={{ marginTop: 6, marginLeft: 'auto', display: 'block' }}
                  onClick={() => {
                    const sel = Object.keys(agentSel).filter((k) => agentSel[k])
                    setCloudMsg('正在上传所选 Agent…')
                    void props.onUploadSelected({ agents: sel }).then(() => setCloudMsg(`已上传所选：${sel.length} 个 Agent`)).catch((e) => setCloudMsg(`上传失败：${String((e as Error)?.message ?? e)}`))
                    setAgentSel({})
                  }}
                >
                  ↑ 上传所选（{Object.keys(agentSel).filter((k) => agentSel[k]).length}）
                </button>
              </>
            ) : (
              <div className="dshs-subnote" style={{ marginTop: 6 }}>✅ 本机 Agent 已全部同步到云端。</div>
            )}
          </div>
        ) : null}
      </div>
      <div className="dshs-sec" style={{ marginTop: 10 }}>
        🤖 Agent 库
        <span>{entries.length} 个已安装 · {updates.length} 个可更新</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索已安装 Agent…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="dshs-abtn" style={{ flex: 'none' }} onClick={props.onGoMarket}>去 Agent 市场 →</button>
      </div>
      {entries.length ? (
        entries.map((a) => {
          const k = keyOf.get(a.id)
          const iv = k ? props.installed[k] : null
          const up = k !== null && k !== undefined && iv !== a.version
          return (
            <div className="dshs-vcard" key={a.id}>
              <div className="dshs-l1">
                <span className="dshs-nm">{a.name}</span>
                {typeBadge(a)}
                <span className="dshs-compat">preset/{a.preset_name ?? a.name}</span>
                {a.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {a.author}</span> : null}
              </div>
              <div className="dshs-subnote" style={{ margin: '6px 0' }}>
                已安装版本 v{iv}
                {up ? <span className="dshs-updot" style={{ marginLeft: 8 }}>有更新 v{a.version}</span> : null}
              </div>
              <div className="dshs-actions">
                {pluginRepoLink(a)}
              </div>
            </div>
          )
        })
      ) : (
        <div className="dshs-empty" style={{ padding: 12 }}>{kw ? '未找到匹配的已安装 Agent' : '尚未安装任何 Agent，去 Agent 市场查看仓库链接手动安装'}</div>
      )}
    </div>
  )
}

/** 组合页：浏览/创建/编辑组合；创建/编辑 = 大弹窗勾选成员（一键全选 + 搜索 + 库内校验 + 每插件安装方式）。 */
export function ComboView(props: {
  combos: Combo[]
  plugins: Plugin[]
  subscriptions: Record<string, boolean>
  installed: Installed
  loggedIn: boolean
  /** 当前登录 GitHub 账号：用于把“我的组合”提到最前面。 */
  myLogin: string
  /** 顶部全局搜索词（过滤推荐组合）。 */
  query: string
  onLogin: () => void
  onSubscribe: (name: string) => void
  onUnsubscribe: (name: string) => void
  onAddCombo: (name: string, desc: string, members: ComboMemberInput[]) => void
  onUpdateCombo: (id: string, name: string, desc: string, members: ComboMemberInput[]) => void
  onRemoveCombo: (id: string) => void
  /** 服务端插件组审核开关：true=发布需审核；false=直接上线。 */
  reviewEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [loginHint, setLoginHint] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [exp, setExp] = useState<Record<string, boolean>>({})
  const [delSelected, setDelSelected] = useState<Record<string, boolean>>({})
  // 简介输入框引用：编辑已有组合时按内容校准行高（自动增高只在键入时触发，打开时也需恢复完整高度）。
  const descRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    if (open) {
      const el = descRef.current
      if (el) {
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
      }
    }
  }, [open, desc])

  const allInstalled = Object.keys(props.installed)
  const libIds = new Set(props.plugins.map((p) => p.id))
  const myLogin = (props.myLogin || '').trim().toLowerCase()
  const mine = props.combos.filter((c) => myLogin && (c.author.toLowerCase() === myLogin || (c.author_github ?? '').toLowerCase() === myLogin))
  const mineIds = new Set(mine.map((c) => c.id))
  const selectedMine = mine.filter((c) => delSelected[c.id]).map((c) => c.id)
  const topKw = props.query.trim().toLowerCase()
  const recommended = props.combos.filter(
    (c) =>
      !mineIds.has(c.id) &&
      c.status !== 'removed' &&
      (!topKw ||
        c.name.toLowerCase().includes(topKw) ||
        c.description.toLowerCase().includes(topKw) ||
        c.author.toLowerCase().includes(topKw) ||
        c.members.some((m) => m.pkg.toLowerCase().includes(topKw))),
  )
  const kw = q.trim().toLowerCase()
  // 候选 = 插件库全部插件（优先，未安装也可选）+ 已安装的库外插件 + 已选但两者都不是的存量成员
  // （库外未安装的旧组合成员：联邦/历史数据可能产生，补占位项保证编辑不丢项、可取消、保存校验一致）。
  // 每项带作者与仓库地址（库中有则展示，可点击跳转）。
  const pickable = [
    ...props.plugins.map((p) => ({
      id: p.id,
      name: p.name,
      inLib: true,
      version: props.installed[p.id] ?? null,
      author: p.author,
      repoUrl: p.repo_url,
    })),
    ...allInstalled
      .filter((id) => !libIds.has(id))
      .map((id) => ({ id, name: id, inLib: false, version: props.installed[id], author: undefined, repoUrl: undefined })),
    ...Object.keys(sel)
      .filter((id) => sel[id] && !libIds.has(id) && !allInstalled.includes(id))
      .map((id) => ({ id, name: id, inLib: false, version: null, author: undefined, repoUrl: undefined })),
  ]
  // 搜索：名称或作者
  const filtered = pickable.filter((it) => !kw || it.name.toLowerCase().includes(kw) || (it.author ?? '').toLowerCase().includes(kw))
  // 已安装优先：已装(0) → 库内未装(1) → 库外(2)。稳定排序，搜索词过滤后依旧保持该次序。
  filtered.sort((a, b) => {
    const sa = a.inLib ? (a.version ? 0 : 1) : 2
    const sb = b.inLib ? (b.version ? 0 : 1) : 2
    return sa - sb
  })
  // 渲染上限：库内 3000+ 条全渲染会卡；已选中的成员始终保留在可见列表（编辑不丢项）。
  const VISIBLE_CAP = 150
  const visible = [...filtered.slice(0, VISIBLE_CAP), ...filtered.slice(VISIBLE_CAP).filter((it) => sel[it.id])]
  const chosenCount = Object.values(sel).filter(Boolean).length
  const allChecked = visible.length > 0 && visible.every((it) => sel[it.id])

  const openForm = () => {
    if (!props.loggedIn) {
      setLoginHint(true)
      return
    }
    setEditId(null)
    setName(''); setDesc(''); setSel({}); setQ(''); setErr(null)
    setOpen(true)
  }
  const openEdit = (c: Combo) => {
    const nd: Record<string, boolean> = {}
    for (const m of c.members) nd[m.pkg] = true
    setEditId(c.id)
    setName(c.name); setDesc(c.description); setSel(nd); setQ(''); setErr(null)
    setOpen(true)
  }
  const toggle = (id: string) => setSel({ ...sel, [id]: !sel[id] })
  const toggleAll = () => {
    const nd = { ...sel }
    if (allChecked) visible.forEach((it) => { delete nd[it.id] })
    else visible.forEach((it) => { nd[it.id] = true })
    setSel(nd)
  }
  const publish = () => {
    const chosen = Object.keys(sel).filter((id) => sel[id])
    if (!name.trim()) { setErr('请填写组合名称'); return }
    if (chosen.length === 0) { setErr('请至少勾选一个插件'); return }
    const missing = chosen.filter((id) => !libIds.has(id))
    if (missing.length > 0) {
      setErr(`以下插件在库中没有，请先取消勾选再发布：${missing.join('、')}`)
      return
    }
    // 安装方式已随降安装化移除：组合成员一律标记 auto（预留未来一键安装接口）。
    const members = chosen.map((pkg) => ({ pkg, install_mode: 'auto' as const }))
    if (editId) props.onUpdateCombo(editId, name.trim(), desc.trim(), members)
    else props.onAddCombo(name.trim(), desc.trim(), members)
    setOpen(false)
  }
  /** 组合状态徽标：待审核 / 已发布 / 已下架。 */
  const statusBadge = (s: Combo['status']) =>
    s === 'published' ? <span className="dshs-badge of">已发布</span>
    : s === 'unpublished' ? <span className="dshs-badge ba">已下架</span>
    : <span className="dshs-badge wa">待审核</span>
  /** 成员徽标：仅包名（安装方式已不再区分）。 */
  const memberBadge = (m: Combo['members'][number]) => (
    <span className="dshs-badge" key={m.pkg}>{m.pkg}</span>
  )
  /** 组合卡片底部操作行（作者视角：订阅数可见 + 修改/删除；他人视角：订阅状态 + 订阅/退订）。 */
  const comboFoot = (c: Combo, isMine: boolean, sub: boolean) => (
    <div className="dshs-mrow" style={{ marginTop: 7 }}>
      <span className="dshs-lk" title="全站订阅该组合的用户数">👥 {c.subscribers ?? 0} 订阅</span>
      {isMine ? (
        <>
          <span className="dshs-compat" style={{ marginLeft: 0 }}>🧩 {c.members.length} · 更新 {(c.updated_at || '').slice(0, 10)}</span>
          <button className="dshs-abtn" onClick={() => openEdit(c)}>✏️ 修改</button>
          <ConfirmDelete onConfirm={() => props.onRemoveCombo(c.id)} title="删除我的组合" />
        </>
      ) : (
        <>
          {sub ? (
            <button className="dshs-ibtn done" disabled>已订阅 ✓</button>
          ) : (
            <button className="dshs-ibtn" onClick={() => props.onSubscribe(c.name)} title="订阅 = 云端记录并在列表中跟踪，不在商城自动安装">订阅</button>
          )}
        </>
      )}
    </div>
  )
  /** 展开成员明细（安装方式 + 已装状态 + 单独下载）。 */
  const memberRows = (c: Combo) => (
    <div style={{ marginBottom: 7 }}>
      {c.members.map((m) => {
        const p = props.plugins.find((x) => x.id === m.pkg)
        return (
          <div className="dshs-mem" key={m.pkg}>
            <span className="dshs-nm" style={{ fontWeight: 600 }}>{p?.name ?? m.pkg}</span>
            {p?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
            {props.installed[m.pkg] ? (
              <span className="dshs-compat">已安装 v{props.installed[m.pkg]}</span>
            ) : (
              <span className="dshs-pill off">未安装</span>
            )}
            {pluginRepoLink(p)}
          </div>
        )
      })}
    </div>
  )

  return (
    <div>
      {/* 我的组合：独立卡片框 */}
      <div className="dshs-grp">
        <div className="dshs-sec">
          🗂 我的组合
          <span>{props.loggedIn ? `${mine.length} 个` : '登录后显示'}</span>
        </div>
        <button className="dshs-mycombo" onClick={openForm}>＋ 创建并发布我的组合</button>
        {loginHint ? (
          <div className="dshs-notif" style={{ borderLeftColor: 'var(--gold)' }}>
            <div className="nt">请先登录：登录后可创建并发布组合</div>
            <div className="na">
              <button className="dshs-abtn" onClick={() => { setLoginHint(false); props.onLogin() }}>去登录 →</button>
            </div>
          </div>
        ) : null}
        {props.loggedIn ? (
          mine.length ? (
            <>
              <BatchDeleteBar
                count={selectedMine.length}
                itemName="我的组合"
                onDelete={() => {
                  selectedMine.forEach((id) => props.onRemoveCombo(id))
                  setDelSelected({})
                }}
                onClear={() => setDelSelected({})}
              />
              <div className="dshs-mycombo-list">
                {mine.map((c) => {
                  const isExp = !!exp['mine:' + c.id]
                  return (
                    <div className="dshs-mycombo-card" key={c.id}>
                      <input type="checkbox" checked={!!delSelected[c.id]} onChange={() => setDelSelected({ ...delSelected, [c.id]: !delSelected[c.id] })} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="dshs-l1">
                          <span className="dshs-nm">{c.name}</span>
                          {statusBadge(c.status)}
                          <span className="dshs-compat">by 我</span>
                        </div>
                        <Desc text={c.description} style={{ margin: '4px 0 6px' }} />
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                          {c.members.map(memberBadge)}
                        </div>
                        {isExp ? memberRows(c) : null}
                        <button className="dshs-abtn" onClick={() => setExp({ ...exp, ['mine:' + c.id]: !isExp })}>
                          {isExp ? '收起成员 ▴' : '查看成员 ▾'}
                        </button>
                        {comboFoot(c, true, false)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="dshs-empty" style={{ padding: 14 }}>
              {"还没有自己的组合，点上方按钮创建第一个组合"}
              <br />
              <span style={{ fontSize: 11, opacity: 0.8 }}>若已发布却看不到：请确认当前连接的服务器与发布时一致，并在「☁️ 云端」点「从云端刷新」（组合数据按服务器下发，状态为「待审核/已发布」都会显示在你这里）</span>
            </div>
          )
        ) : (
          <div className="dshs-empty" style={{ padding: 14 }}>登录 GitHub 后，这里会优先显示你创建的组合</div>
        )}
      </div>
      {open ? (
        <div className="dshs-modal" onClick={() => setOpen(false)}>
          <div className="dshs-modal-card big" onClick={(e) => e.stopPropagation()}>
            <div className="t">{editId ? '✏️ 修改组合' : '🗂 创建并发布组合'}<button onClick={() => setOpen(false)}>✕</button></div>
            {/* 免责声明：每次新建/编辑都展示(双语社会主义核心价值观) */}
            <div className="dshs-disclaim">
              <div className="dshs-disclaim-t">⚠️ 免责声明 · Disclaimer</div>
              <div className="dshs-disclaim-b">请勿发布违反法律法规的内容，由此产生的一切后果由发布者自行承担。<br />Please do not publish anything against the law. You alone are responsible for all consequences.</div>
              <div className="dshs-disclaim-v">富强 民主 文明 和谐 · 自由 平等 公正 法治 · 爱国 敬业 诚信 友善<br /><span>Prosperity, Democracy, Civility, Harmony · Freedom, Equality, Justice, Rule of Law · Patriotism, Dedication, Integrity, Friendship</span></div>
            </div>
            {/* 审核状态提示：新建/编辑保存均显示 */}
            {(() => {
              if (!props.reviewEnabled) {
                return (
                  <div className="dshs-notif" style={{ borderLeftColor: 'var(--brand2)' }}>
                    <div className="nt">⚡ 插件组审核已关闭：发布后立即实时上线，无需等待。</div>
                  </div>
                )
              }
              const editing = editId ? mine.find((c) => c.id === editId) : null
              if (editing && editing.status === 'published') {
                return (
                  <div className="dshs-notif" style={{ borderLeftColor: 'var(--brand2)' }}>
                    <div className="nt">✅ 你的组合已通过审核：保存修改后直接更新上线，无需重新审核。</div>
                  </div>
                )
              }
              return (
                <div className="dshs-notif" style={{ borderLeftColor: 'var(--gold)' }}>
                  <div className="nt">🕐 插件组需要管理员审核，发布后请耐心等待；审核结果（通过/下架/删除）将通过<strong>私人公告</strong>通知你，请留意铃铛红点。</div>
                </div>
              )
            })()}
            <div className="c">
              <div className="dshs-frow">
                <input className="dshs-input" placeholder="组合名称（≤30字）" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="dshs-frow" style={{ alignItems: 'flex-start' }}>
                <textarea
                  ref={descRef}
                  className="dshs-input dshs-desc"
                  placeholder="一句话简介（≤200字），可换行"
                  maxLength={200}
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onInput={(e) => {
                    // 随内容自动增高（超过弹窗高度时整体滚动，不再只有一行、检查不便）
                    const el = e.target as HTMLTextAreaElement
                    el.style.height = 'auto'
                    el.style.height = el.scrollHeight + 'px'
                  }}
                />
              </div>
              <div className="dshs-sec" style={{ marginTop: 4 }}>
                🧩 选择组合成员（插件库优先）
                <span>{props.plugins.length} 个库内插件</span>
              </div>
              <div className="dshs-frow">
                <input className="dshs-input" placeholder="搜索插件名 / 作者…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="dshs-mrow" style={{ marginBottom: 6 }}>
                <button className="dshs-abtn" onClick={toggleAll}>{allChecked ? '取消全选' : '☑ 一键全选'}</button>
                <span className="dshs-compat" style={{ marginLeft: 0 }}>已选 {chosenCount} / 库内 {props.plugins.length}</span>
              </div>
              <div className="dshs-subnote" style={{ marginBottom: 6 }}>插件库中的插件优先展示（未安装也可选），带 👤 作者与 🔗 仓库链接；成员安装统一走仓库手动安装（一键安装接口预留下次上架）。</div>
              {visible.length ? (
                visible.map((it) => {
                  const on = !!sel[it.id]
                  return (
                    <div
                      className={'dshs-pick' + (on ? ' on' : '')}
                      key={it.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'A') toggle(it.id)
                      }}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(it.id)} />
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>{it.name}</span>
                      <span className="dshs-compat" style={{ marginLeft: 0 }}>{it.version ? `v${it.version}` : '未安装'}</span>
                      {it.inLib ? <span className="dshs-lib ok">在库 ✓</span> : <span className="dshs-lib warn">库中没有 ⚠</span>}
                      {it.inLib && it.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {it.author}</span> : null}
                      {it.inLib && it.repoUrl ? (
                        <a className="dshs-lk" href={it.repoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={it.repoUrl}>🔗 仓库</a>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="dshs-empty">{kw ? '没有匹配的插件（试试搜作者名）' : '插件库为空'}</div>
              )}
              {filtered.length > VISIBLE_CAP ? (
                <div className="dshs-subnote" style={{ marginTop: 6 }}>仅显示前 {VISIBLE_CAP} 条（已选中的成员不受此限），用搜索精确定位。</div>
              ) : null}
            </div>
            {err ? (
              <div className="dshs-notif" style={{ borderLeftColor: 'var(--danger)' }}>
                <div className="nt">{err}</div>
              </div>
            ) : null}
            {/* 底部固定操作区：插件列表可滚动,发布按钮始终可见 */}
            <div className="dshs-modal-foot">
              <span className="dshs-compat" style={{ marginLeft: 0 }}>{editId ? '保存后组合更新（状态保留）' : '发布后进入管理端审核'}</span>
              <button className="dshs-ibtn" onClick={publish}>{editId ? '保存修改' : '发布组合'}</button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="dshs-sec" style={{ marginTop: 14 }}>
        🔥 推荐组合
        <span>{recommended.length} 个</span>
      </div>
      {recommended.map((c) => {
        const sub = !!props.subscriptions[c.name]
        const isExp = !!exp[c.name]
        return (
          <div className="dshs-vcard" key={c.id}>
            <div className="dshs-l1">
              <span className="dshs-nm">{c.name}</span>
              {sub ? <span className="dshs-pill primary">已订阅</span> : null}
              {statusBadge(c.status)}
              <span className="dshs-compat">by {c.author}</span>
            </div>
            <Desc text={c.description} style={{ margin: '5px 0 7px' }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
              {c.members.map(memberBadge)}
            </div>
            {isExp ? memberRows(c) : null}
            <button className="dshs-abtn" onClick={() => setExp({ ...exp, [c.name]: !isExp })}>
              {isExp ? '收起成员 ▴' : '查看成员 ▾'}
            </button>
            {comboFoot(c, false, sub)}
            {!sub ? (
              <div className="dshs-subnote">💡 订阅 = 云端记录、跟踪作者新增；安装请逐条点 🔗 仓库按 README 手动安装（商城不再提供一键安装）。</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** 发布插件（上报入库）：按钮 → 大弹窗；库内搜索查重；仅登录用户可提交。 */
export function PublishPluginView(props: {
  loggedIn: boolean
  plugins: Plugin[]
  onClose: () => void
  onLogin: () => void
  onReport: (pkg: string, repoUrl: string | null, version: string) => Promise<{ ok: boolean; message: string }>
}) {
  const [pkg, setPkg] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [version, setVersion] = useState('')
  const [libQ, setLibQ] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean | null; text: string } | null>(null)
  const kq = libQ.trim().toLowerCase()
  const hf = (f?: string | null) => (f ?? '').toLowerCase().includes(kq)
  const found = kq ? props.plugins.filter((p) => hf(p.name) || hf(p.id) || hf(p.author) || hf(p.repo) || hf(p.install)).slice(0, 5) : []
  const submit = () => {
    if (!pkg.trim()) { setMsg({ ok: false, text: '请填写包名 / 安装地址' }); return }
    setMsg({ ok: null, text: '上报中…' })
    void props.onReport(pkg.trim(), repoUrl.trim() || null, version.trim()).then((r) => setMsg({ ok: r.ok, text: r.message }))
  }
  return (
    <div className="dshs-modal" onClick={props.onClose}>
      <div className="dshs-modal-card big" onClick={(e) => e.stopPropagation()}>
        <div className="t">📤 发布插件（上报入库）<button onClick={props.onClose}>✕</button></div>
        {props.loggedIn ? (
          <>
            <div className="c">
              <div className="dshs-subnote" style={{ marginBottom: 8 }}>你的插件将进入管理端「待确认」清单，管理员快审收录后出现在插件库。</div>
            <div className="dshs-frow">
              <input className="dshs-input" placeholder="包名 / 安装地址（如 dsh-xxx 或 github:owner/repo）" value={pkg} onChange={(e) => setPkg(e.target.value)} />
            </div>
            <div className="dshs-frow">
              <input className="dshs-input" placeholder="仓库地址（可选，如 https://github.com/owner/repo）" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
            </div>
            <div className="dshs-frow">
              <input className="dshs-input" placeholder="版本号（可选，如 0.1.0）" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
            <div className="dshs-sec" style={{ marginTop: 6 }}>🔍 先在库内搜一下，避免重复上报</div>
            <div className="dshs-frow">
              <input className="dshs-input" placeholder="搜索插件库（名称/作者/仓库）…" value={libQ} onChange={(e) => setLibQ(e.target.value)} />
            </div>
            {found.map((p) => (
              <div className="dshs-mem" key={p.id}>
                <span className="dshs-nm" style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="dshs-lib ok">已在库中 ✓</span>
                <span className="dshs-compat">by {p.author ?? '—'}</span>
              </div>
            ))}
            {kq && found.length === 0 ? <div className="dshs-subnote">库内未找到「{libQ}」，可以提交上报</div> : null}
            {msg ? (
              <div className="dshs-notif" style={{ borderLeftColor: msg.ok === false ? 'var(--danger)' : msg.ok === true ? 'var(--brand2)' : '#3b9eff' }}>
                <div className="nt">{msg.text}</div>
              </div>
            ) : null}
            </div>
            {/* 底部固定操作区：内容可滚动,提交按钮始终可见 */}
            <div className="dshs-modal-foot">
              <button className="dshs-ibtn" onClick={submit}>提交上报</button>
            </div>
          </>
        ) : (
          <div className="c">
            <div className="dshs-empty">请先登录：登录后可发布插件（上报入库）</div>
            <div className="dshs-mrow">
              <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => { props.onClose(); props.onLogin() }}>去登录 →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** 订阅页：云端订阅组（默认折叠）+ 已订阅组合；成员更新/下载/退订。 */
export function SubscribeView(props: {
  combos: Combo[]
  subscriptions: Record<string, boolean>
  installed: Installed
  plugins: Plugin[]
  cloud: CloudList
  onSubscribe: (name: string) => void
  onUnsubscribe: (name: string) => void
  onPushCloud: () => Promise<CloudList>
  onRefreshCloud: () => Promise<CloudList>
  /** 手动挑选上传（云端已有 + 勾选新增）。 */
  onUploadSelected: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
  /** 从云端删除指定项（仅云端清单，不动本地安装）。 */
  onDeleteCloud: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
}) {
  const [q, setQ] = useState('')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const [subSelected, setSubSelected] = useState<Record<string, boolean>>({})
  const [csearch, setCsearch] = useState('')
  // 手动选择上传：本地已订阅但云端没有的组合
  const [comboUpSel, setComboUpSel] = useState<Record<string, boolean>>({})
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const kw = q.trim().toLowerCase()
  const groups = props.combos.filter((c) => props.subscriptions[c.name])
  const filtered = groups.filter((c) => {
    if (!kw) return true
    if (c.name.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw)) return true
    return c.members.some((m) => m.pkg.toLowerCase().includes(kw))
  })
  const selectedGroups = filtered.filter((c) => subSelected[c.name]).map((c) => c.name)
  const cq = csearch.trim().toLowerCase()
  const cloudCombos = props.cloud.combos.filter((c) => !cq || c.toLowerCase().includes(cq))
  // 待上传组合：本地已订阅但云端清单里没有的
  const cloudComboSet = new Set(props.cloud.combos)
  const pendingCombos = Object.keys(props.subscriptions).filter((n) => props.subscriptions[n] && !cloudComboSet.has(n))

  return (
    <div>
      {/* 云端组合：折叠卡片；组嵌套插件，支持跨组勾选 */}
      <div className="dshs-cloudcard" style={{ marginTop: 10 }}>
        <div className="dshs-cloudcard-h" onClick={() => setCloudOpen(!cloudOpen)}>
          <span className="dshs-nm" style={{ fontWeight: 600 }}>☁️ 云端组合</span>
          <span className="dshs-compat">{props.cloud.combos.length} 个已保存</span>
          <span className="dshs-cloudcard-arrow">{cloudOpen ? '收起 ▴' : '展开 ▾'}</span>
        </div>
        {cloudOpen ? (
          <div className="dshs-cloudcard-body">
            <div className="dshs-subnote">云端组合按<b>组</b>展示：订阅/退订在云端或组合库操作；组内<b>插件</b>请点 🔗 仓库按 README 手动安装（一键安装已下线）。</div>
            <div className="dshs-actions" style={{ marginTop: 6 }}>
              <button className="dshs-abtn" onClick={() => { if (!window.confirm('上传全部到云端：云端清单将覆盖为本地全部已装/已订阅项。确定？')) return; setCloudMsg('正在上传本地组合到云端…'); void props.onPushCloud().then((c) => setCloudMsg(`已上传：插件 ${c.plugins.length} · 组合 ${c.combos.length}`)) }}>☁ 上传全部到云端</button>
              <button className="dshs-abtn" onClick={() => { setCloudMsg('正在从云端刷新…'); void props.onRefreshCloud().then((c) => setCloudMsg(`云端清单：插件 ${c.plugins.length} · 组合 ${c.combos.length}`)) }}>↻ 从云端刷新</button>
              <button
                className="dshs-abtn dan"
                onClick={() => {
                  if (!window.confirm(`清空云端全部组合（${props.cloud.combos.length} 个）？仅移除云端清单，不影响本地安装。`)) return
                  setCloudMsg('正在清空云端组合…')
                  void props.onDeleteCloud({ combos: props.cloud.combos }).then(() => setCloudMsg('已清空云端组合')).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
                }}
              >
                🗑 删除全部
              </button>
            </div>
            {cloudMsg ? <div className="dshs-notif"><div className="nt">{cloudMsg}</div></div> : null}
            <div className="dshs-frow" style={{ marginTop: 8 }}>
              <input className="dshs-input" placeholder="搜索云端组合…" value={csearch} onChange={(e) => setCsearch(e.target.value)} />
            </div>
            <div className="dshs-cloud-scroll">
              {cloudCombos.length ? cloudCombos.map((name) => {
                const c = props.combos.find((x) => x.name === name)
                const members = c?.members ?? []
                const sub = !!props.subscriptions[name]
                return (
                  <div className="dshs-pick-sub" key={name}>
                    <div className="dshs-pick">
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>🗂 {name}</span>
                      <span className="dshs-compat" style={{ marginLeft: 0 }}>{members.length} 个插件</span>
                      {sub ? <span className="dshs-pill primary">已订阅</span> : <span className="dshs-pill off">未订阅</span>}
                      {sub ? (
                        <button className="dshs-abtn" onClick={() => props.onUnsubscribe(name)}>退订</button>
                      ) : (
                        <button className="dshs-abtn" onClick={() => props.onSubscribe(name)}>订阅</button>
                      )}
                      <button
                        className="dshs-x"
                        title="从云端删除（不影响本地安装）"
                        onClick={() => {
                          if (!window.confirm(`从云端删除组合「${name}」？仅移除云端清单。`)) return
                          setCloudMsg('正在从云端删除…')
                          void props.onDeleteCloud({ combos: [name] }).then(() => setCloudMsg(`已从云端删除：${name}`)).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
                        }}
                      >
                        🗑
                      </button>
                    </div>
                    {members.length ? (
                      <div className="dshs-pick-sub-in">
                        {members.map((m) => {
                          const p = props.plugins.find((x) => x.id === m.pkg)
                          return (
                            <div className="dshs-pick" key={m.pkg}>
                              <span className="dshs-nm" style={{ fontWeight: 600 }}>🧩 {p?.name ?? m.pkg}</span>
                              {p?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
                              {props.installed[m.pkg] ? <span className="dshs-pill primary">已装</span> : <span className="dshs-pill off">未装</span>}
                              {pluginRepoLink(p)}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              }) : <div className="dshs-empty" style={{ padding: 10 }}>{cq ? '云端组合中没有匹配项' : '云端暂无组合'}</div>}
            </div>
            {/* 手动选择上传：本地已订阅但尚未进云端的组合 */}
            {pendingCombos.length ? (
              <>
                <div className="dshs-subnote" style={{ marginTop: 8 }}>🛫 待上传（本机已订阅、尚未进云端）：勾选后点「上传所选」</div>
                <div className="dshs-cloud-scroll">
                  {pendingCombos.map((n) => (
                    <div className="dshs-pick" key={n} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') setComboUpSel({ ...comboUpSel, [n]: !comboUpSel[n] }) }}>
                      <input type="checkbox" checked={!!comboUpSel[n]} onChange={() => setComboUpSel({ ...comboUpSel, [n]: !comboUpSel[n] })} />
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>🗂 {n}</span>
                      <span className="dshs-badge wa">未同步</span>
                    </div>
                  ))}
                </div>
                <button
                  className="dshs-abtn pri"
                  style={{ marginTop: 6, marginLeft: 'auto', display: 'block' }}
                  onClick={() => {
                    const sel = Object.keys(comboUpSel).filter((k) => comboUpSel[k])
                    setCloudMsg('正在上传所选组合…')
                    void props.onUploadSelected({ combos: sel }).then(() => setCloudMsg(`已上传所选：${sel.length} 个组合`)).catch((e) => setCloudMsg(`上传失败：${String((e as Error)?.message ?? e)}`))
                    setComboUpSel({})
                  }}
                >
                  ↑ 上传所选（{Object.keys(comboUpSel).filter((k) => comboUpSel[k]).length}）
                </button>
              </>
            ) : (
              <div className="dshs-subnote" style={{ marginTop: 6 }}>✅ 本机已订阅组合已全部同步到云端。</div>
            )}
          </div>
        ) : null}
      </div>
      <div className="dshs-sec" style={{ marginTop: cloudOpen ? 14 : 4 }}>
        🗂 我的组合库
        <span>{groups.length} 个组合</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索订阅的组合 / 成员插件…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <BatchDeleteBar
        count={selectedGroups.length}
        itemName="组合"
        onDelete={() => {
          selectedGroups.forEach((name) => props.onUnsubscribe(name))
          setSubSelected({})
        }}
        onClear={() => setSubSelected({})}
      />
      {filtered.length ? (
        filtered.map((c) => {
          const memberUpdates = c.members.filter((m) => {
            const p = props.plugins.find((x) => x.id === m.pkg)
            return !!p && hasUpdate(p, props.installed)
          })
          const isOpen = !!subOpen[c.name]
          return (
            <div className="dshs-grp" key={c.id}>
              <div
                className="dshs-sub-head"
                onClick={(e) => {
                  if ((e.target as HTMLElement).tagName !== 'INPUT') setSubOpen({ ...subOpen, [c.name]: !isOpen })
                }}
              >
                <input type="checkbox" checked={!!subSelected[c.name]} onChange={() => setSubSelected({ ...subSelected, [c.name]: !subSelected[c.name] })} />
                <span className="dshs-nm">{c.name}</span>
                {memberUpdates.length > 0 ? (
                  <span className="dshs-updot">🔵 {memberUpdates.length} 个插件有更新</span>
                ) : (
                  <span className="dshs-compat">✓ 全部最新</span>
                )}
                <button className="dshs-abtn">{isOpen ? '收起插件 ▴' : '查看插件 ▾'}</button>
              </div>
              {isOpen ? (
                <>
                  <div className="dshs-sub-members">
                    {c.members.map((m) => {
                      const p = props.plugins.find((x) => x.id === m.pkg)
                      const iv = props.installed[m.pkg]
                      const up = !!p && hasUpdate(p, props.installed)
                      return (
                        <div className="dshs-mem" key={m.pkg}>
                          <span className="dshs-nm" style={{ fontWeight: 600 }}>{p?.name ?? m.pkg}</span>
                          {p?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
                          {p && up ? (
                            <span className="dshs-updot">有更新 v{iv} → v{p.version}</span>
                          ) : iv ? (
                            <span className="dshs-compat">v{iv}</span>
                          ) : (
                            <span className="dshs-compat">未安装</span>
                          )}
                          {pluginRepoLink(p)}
                        </div>
                      )
                    })}
                  </div>
                  <div className="dshs-mrow">
                    <ConfirmDelete label="退订" confirmText="确认退订" onConfirm={() => props.onUnsubscribe(c.name)} />
                  </div>
                </>
              ) : null}
            </div>
          )
        })
      ) : (
        <div className="dshs-empty">{kw ? '未找到匹配的订阅' : '未订阅任何组合'}</div>
      )}
    </div>
  )
}

/** 我的页：GitHub 登录 / 云端同步（插件+订阅组）/ 服务器源 / 我的订阅 / 更新与已安装。 */
/** 插件库页：只放插件相关内容（云端插件恢复 + 更新提醒 + 已安装插件管理）。 */
export function MyView(props: {
  plugins: Plugin[]
  installed: Installed
  acked: Record<string, string>
  cloud: CloudList
  onPushCloud: () => Promise<CloudList>
  onRefreshCloud: () => Promise<CloudList>
  /** 手动挑选上传（云端已有 + 勾选新增）。 */
  onUploadSelected: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
  /** 从云端删除指定项（仅云端清单，不动本地安装）。 */
  onDeleteCloud: (scope: { plugins?: string[]; agents?: string[]; combos?: string[] }) => Promise<CloudList>
  onAckAll: () => void
}) {
  const [q, setQ] = useState('')
  const [psearch, setPsearch] = useState('')
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)
  // 手动选择上传：本地已装但尚未进云端的插件
  const [upSel, setUpSel] = useState<Record<string, boolean>>({})

  const kw = q.trim().toLowerCase()
  const pq = psearch.trim().toLowerCase()
  const cloudPlugins = props.cloud.plugins.filter((p) => !pq || p.toLowerCase().includes(pq))
  const updates = props.plugins.filter((p) => hasUpdate(p, props.installed))
  const unacked = updates.filter((p) => props.acked[p.id] !== p.version)
  const entries = props.plugins.filter(
    (p) => props.installed[p.id] && (!kw || p.name.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)),
  )
  // 待上传：本地已装（多键，含市场条目）但云端没有的插件
  const cloudPluginSet = new Set(props.cloud.plugins)
  const pendingPlugins = props.plugins.filter((p) => props.installed[p.id] && !cloudPluginSet.has(p.id))

  // 云端插件条目：展示作者 + 仓库链接（手动安装指引）
  const cloudRow = (pkg: string) => {
    const p = props.plugins.find((x) => x.id === pkg)
    return (
      <div className="dshs-pick" key={pkg}>
        <span className="dshs-nm" style={{ fontWeight: 600 }}>🧩 {p?.name ?? pkg}</span>
        {p?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
        {p ? null : <span className="dshs-badge ba" title="该插件不在插件库收录范围，无法在插件库搜索到；请从仓库下载">库外插件</span>}
        {props.installed[pkg] ? <span className="dshs-pill primary">已装</span> : <span className="dshs-pill off">未装</span>}
        {pluginRepoLink(p)}
        <button
          className="dshs-x"
          title="从云端删除（不影响本地安装）"
          onClick={() => {
            if (!window.confirm(`从云端删除「${p?.name ?? pkg}」？仅移除云端清单，本地安装不受影响。`)) return
            setCloudMsg('正在从云端删除…')
            void props.onDeleteCloud({ plugins: [pkg] }).then(() => setCloudMsg(`已从云端删除：${p?.name ?? pkg}`)).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
          }}
        >
          🗑
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* 云端插件：折叠卡片（点击展开变大），风格与更新提醒栏一致 */}
      <div className="dshs-cloudcard" style={{ marginTop: 10 }}>
        <div className="dshs-cloudcard-h" onClick={() => setCloudOpen(!cloudOpen)}>
          <span className="dshs-nm" style={{ fontWeight: 600 }}>☁️ 云端插件</span>
          <span className="dshs-compat">{props.cloud.plugins.length} 个已保存</span>
          <span className="dshs-cloudcard-arrow">{cloudOpen ? '收起 ▴' : '展开 ▾'}</span>
        </div>
        {cloudOpen ? (
          <div className="dshs-cloudcard-body">
            <div className="dshs-subnote">
              🛡 隐私说明：云端只保存<b>你手动上传</b>的插件/组合/Agent 清单，不上传任何代码或数据；本地安装不会自动同步，需点「上传」。
            </div>
            <div className="dshs-actions" style={{ marginTop: 6 }}>
              <button
                className="dshs-abtn"
                onClick={() => {
                  if (!window.confirm('上传全部到云端：云端清单将覆盖为本地全部已装/已订阅项。确定？')) return; setCloudMsg('正在上传本地到云端…')
                  void props.onPushCloud().then((c) => setCloudMsg(`已上传：插件 ${c.plugins.length} · 组合 ${c.combos.length} · Agent ${c.agents.length}`))
                }}
              >
                ☁ 上传全部到云端
              </button>
              <button
                className="dshs-abtn"
                onClick={() => {
                  setCloudMsg('正在从云端刷新…')
                  void props.onRefreshCloud().then((c) => setCloudMsg(`云端清单：插件 ${c.plugins.length} · 组合 ${c.combos.length} · Agent ${c.agents.length}`))
                }}
              >
                ↻ 从云端刷新
              </button>
              <button
                className="dshs-abtn dan"
                onClick={() => {
                  if (!window.confirm(`清空云端全部插件（${props.cloud.plugins.length} 个）？仅移除云端清单，不影响本地安装。`)) return
                  setCloudMsg('正在清空云端插件…')
                  void props.onDeleteCloud({ plugins: props.cloud.plugins }).then(() => setCloudMsg('已清空云端插件')).catch((e) => setCloudMsg(`删除失败：${String((e as Error)?.message ?? e)}`))
                }}
              >
                🗑 删除全部
              </button>
            </div>
            {cloudMsg ? <div className="dshs-notif"><div className="nt">{cloudMsg}</div></div> : null}
            <div className="dshs-frow" style={{ marginTop: 8 }}>
              <input className="dshs-input" placeholder="搜索云端插件…" value={psearch} onChange={(e) => setPsearch(e.target.value)} />
            </div>
            <div className="dshs-cloud-scroll">
              {cloudPlugins.length ? cloudPlugins.map((p) => cloudRow(p)) : <div className="dshs-empty" style={{ padding: 10 }}>{pq ? '云端插件中没有匹配项' : '云端暂无插件'}</div>}
            </div>
            {/* 手动选择上传：本地已装但尚未进云端的插件 */}
            {pendingPlugins.length ? (
              <>
                <div className="dshs-subnote" style={{ marginTop: 8 }}>🛫 待上传（本地已装、尚未进云端）：勾选后点「上传所选」</div>
                <div className="dshs-cloud-scroll">
                  {pendingPlugins.map((p) => (
                    <div className="dshs-pick" key={p.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'A') setUpSel({ ...upSel, [p.id]: !upSel[p.id] }) }}>
                      <input type="checkbox" checked={!!upSel[p.id]} onChange={() => setUpSel({ ...upSel, [p.id]: !upSel[p.id] })} />
                      <span className="dshs-nm" style={{ fontWeight: 600 }}>🧩 {p.name}</span>
                      {p.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
                      {p.repo_url ? (
                        <a className="dshs-lk" href={p.repo_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={p.repo_url}>🔗 仓库</a>
                      ) : null}
                      <span className="dshs-badge wa">未同步</span>
                    </div>
                  ))}
                </div>
                <button
                  className="dshs-abtn pri"
                  style={{ marginTop: 6, marginLeft: 'auto', display: 'block' }}
                  onClick={() => {
                    const sel = Object.keys(upSel).filter((k) => upSel[k])
                    setCloudMsg('正在上传所选到云端…')
                    void props.onUploadSelected({ plugins: sel }).then(() => setCloudMsg(`已上传所选：${sel.length} 个插件`)).catch((e) => setCloudMsg(`上传失败：${String((e as Error)?.message ?? e)}`))
                    setUpSel({})
                  }}
                >
                  ↑ 上传所选（{Object.keys(upSel).filter((k) => upSel[k]).length}）
                </button>
              </>
            ) : (
              <div className="dshs-subnote" style={{ marginTop: 6 }}>✅ 本地插件已全部同步到云端，无需上传。</div>
            )}
          </div>
        ) : null}
      </div>

      <div className="dshs-mem" style={{ marginTop: 10, borderColor: unacked.length ? 'rgba(59,158,255,.5)' : undefined }}>
        <span className="dshs-nm" style={{ fontWeight: 600 }}>🔵 更新提醒</span>
        {unacked.length ? (
          <>
            <span className="dshs-compat">{unacked.length} 个插件可更新（见下方已安装列表）</span>
            <button className="dshs-abtn" onClick={props.onAckAll} title="将当前可更新插件标记为已知，不再计入提醒">全部已知</button>
          </>
        ) : (
          <span className="dshs-compat" style={{ color: 'var(--up, #2ea043)' }}>全部最新 ✓</span>
        )}
      </div>

      <div className="dshs-sec" style={{ marginTop: 10 }}>
        🧩 已安装插件
        <span>{entries.length} 个</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索已安装插件…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {entries.length ? (
        entries.map((p) => (
          <div className="dshs-mem" key={p.id}>
            <span className="dshs-nm" style={{ fontWeight: 600 }}>{p.name}</span>
            <span className="dshs-compat">by {p.author ?? '—'}</span>
            {hasUpdate(p, props.installed)
              ? <span className="dshs-updot">v{props.installed[p.id]} → v{p.version}</span>
              : <span className="dshs-compat">v{p.version} 最新</span>}
            {pluginRepoLink(p)}
          </div>
        ))
      ) : (
        <div className="dshs-empty" style={{ padding: 12 }}>{kw ? '未找到匹配的已装插件' : '尚未安装任何插件（去插件市场查看 🔗 仓库链接手动安装）'}</div>
      )}
    </div>
  )
}
