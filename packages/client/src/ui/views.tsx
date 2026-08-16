import { useEffect, useState } from 'react'
import type { Combo, Plugin } from '@dsh-store/shared'
import type { PluginSortKey } from '../core/index.js'
import type { CloudList, ComboMemberInput } from './bridge.js'
import { BatchDeleteBar, ConfirmDelete, Desc, hasUpdate, installHint, Metrics, sourceBadge, srcLink, typeBadge } from './components.js'

type Installed = Record<string, string>

/** 安装按钮：Plugin 走 dsh plugin add；Agent(Preset) 走复制安装；只有 Plugin 参与版本更新。 */
function pluginBtn(
  p: Plugin,
  installed: Installed,
  installing: Record<string, boolean>,
  onInstall: (pkg: string) => void,
  onInstallPreset: (pkg: string, presetName?: string) => void,
  onUpdate: (pkg: string) => void,
) {
  const busy = installing[p.id]
  const isPreset = p.kind === 'preset'
  const presetName = p.preset_name ?? p.name
  if (busy) return <button className="dshs-ibtn" disabled>⏳ 安装中…</button>
  if (!installed[p.id]) {
    return isPreset
      ? <button className="dshs-ibtn" onClick={() => onInstallPreset(p.id, presetName)} title={installHint(p)}>安装 Agent</button>
      : <button className="dshs-ibtn" onClick={() => onInstall(p.id)} title={installHint(p)}>一键安装</button>
  }
  if (!isPreset && hasUpdate(p, installed)) return <button className="dshs-ibtn" onClick={() => onUpdate(p.id)} title={`更新：dsh plugin add ${p.install ?? p.id}@${p.version}`}>更新</button>
  return <button className="dshs-ibtn done" disabled title={isPreset ? installHint(p) : `已安装：dsh plugin add ${p.install ?? p.id}`}>已安装 ✓</button>
}

/** 插件页：趋势横滑 + 本地搜索 + 排序 + 列表；订阅组内插件有更新也在此显示。 */
export function SearchView(props: {
  trending: Plugin[]
  results: Plugin[]
  query: string
  installed: Installed
  sort: PluginSortKey
  loggedIn: boolean
  installing: Record<string, boolean>
  onSort: (k: PluginSortKey) => void
  onInstall: (pkg: string) => void
  onInstallPreset: (pkg: string, presetName?: string) => void
  onUpdate: (pkg: string) => void
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
                {pluginBtn(p, props.installed, props.installing, props.onInstall, props.onInstallPreset, props.onUpdate)}
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
                  {pluginBtn(p, props.installed, props.installing, props.onInstall, props.onInstallPreset, props.onUpdate)}
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
  installing: Record<string, boolean>
  onInstallPreset: (pkg: string, presetName?: string) => void
}) {
  const [q, setQ] = useState('')
  const localKw = q.trim().toLowerCase()
  const globalKw = props.query.trim().toLowerCase()
  const kw = localKw || globalKw
  const results = props.agents.filter((a) => {
    if (!kw) return true
    return (
      a.name.toLowerCase().includes(kw) ||
      a.id.toLowerCase().includes(kw) ||
      a.description.toLowerCase().includes(kw) ||
      (a.preset_name ?? '').toLowerCase().includes(kw)
    )
  })
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
                {props.installing[a.id] ? (
                  <button className="dshs-ibtn" disabled>⏳ 安装中…</button>
                ) : !props.installed[a.id] ? (
                  <button className="dshs-ibtn" onClick={() => props.onInstallPreset(a.id, a.preset_name ?? a.name)}>安装 Agent</button>
                ) : props.installed[a.id] !== a.version ? (
                  <button className="dshs-ibtn" onClick={() => props.onInstallPreset(a.id, a.preset_name ?? a.name)}>更新 Agent</button>
                ) : (
                  <button className="dshs-ibtn done" disabled>已安装 ✓</button>
                )}
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

/** Agent 库：管理已安装的 Agent（更新 / 删除），设计对齐插件库与组合库。 */
export function AgentLibraryView(props: {
  agents: Plugin[]
  installed: Installed
  installing: Record<string, boolean>
  onInstallPreset: (pkg: string, presetName?: string) => void
  onUninstall: (pkg: string) => void
  onGoMarket: () => void
}) {
  const [q, setQ] = useState('')
  const kw = q.trim().toLowerCase()
  const entries = props.agents.filter(
    (a) => props.installed[a.id] && (!kw || a.name.toLowerCase().includes(kw) || a.id.toLowerCase().includes(kw) || (a.preset_name ?? '').toLowerCase().includes(kw)),
  )
  const updates = entries.filter((a) => props.installed[a.id] !== a.version)
  return (
    <div>
      <div className="dshs-sec">
        🤖 Agent 库
        <span>{entries.length} 个已安装 · {updates.length} 个可更新</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索已安装 Agent…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="dshs-abtn" style={{ flex: 'none' }} onClick={props.onGoMarket}>去 Agent 市场 →</button>
      </div>
      {entries.length ? (
        entries.map((a) => {
          const iv = props.installed[a.id]
          const up = iv !== a.version
          return (
            <div className="dshs-vcard" key={a.id}>
              <div className="dshs-l1">
                <span className="dshs-nm">{a.name}</span>
                {typeBadge(a)}
                <span className="dshs-compat">preset/{a.preset_name ?? a.name}</span>
              </div>
              <div className="dshs-subnote" style={{ margin: '6px 0' }}>
                {installHint(a)} · 当前版本 v{iv}
                {up ? <span className="dshs-updot" style={{ marginLeft: 8 }}>有更新 v{a.version}</span> : null}
              </div>
              <div className="dshs-actions">
                {up ? (
                  props.installing[a.id] ? (
                    <button className="dshs-ibtn" style={{ marginLeft: 0 }} disabled>⏳ 更新中…</button>
                  ) : (
                    <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => props.onInstallPreset(a.id, a.preset_name ?? a.name)}>更新 Agent</button>
                  )
                ) : null}
                <ConfirmDelete label="卸载" confirmText="确认卸载" onConfirm={() => props.onUninstall(a.id)} />
              </div>
            </div>
          )
        })
      ) : (
        <div className="dshs-empty" style={{ padding: 12 }}>{kw ? '未找到匹配的已安装 Agent' : '尚未安装任何 Agent，可去 Agent 市场安装'}</div>
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
  installing: Record<string, boolean>
  onLogin: () => void
  onInstallCombo: (name: string) => void
  onInstallPlugin: (pkg: string) => void
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
  /** 每个已选插件的安装方式：auto=一键直接装 / manual=手动安装。 */
  const [modes, setModes] = useState<Record<string, 'auto' | 'manual'>>({})
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [exp, setExp] = useState<Record<string, boolean>>({})
  const [delSelected, setDelSelected] = useState<Record<string, boolean>>({})

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
    setName(''); setDesc(''); setSel({}); setModes({}); setQ(''); setErr(null)
    setOpen(true)
  }
  const openEdit = (c: Combo) => {
    const nd: Record<string, boolean> = {}
    const nm: Record<string, 'auto' | 'manual'> = {}
    for (const m of c.members) {
      nd[m.pkg] = true
      nm[m.pkg] = m.install_mode === 'manual' ? 'manual' : 'auto'
    }
    setEditId(c.id)
    setName(c.name); setDesc(c.description); setSel(nd); setModes(nm); setQ(''); setErr(null)
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
    const members = chosen.map((pkg) => ({ pkg, install_mode: modes[pkg] === 'manual' ? 'manual' as const : 'auto' as const }))
    if (editId) props.onUpdateCombo(editId, name.trim(), desc.trim(), members)
    else props.onAddCombo(name.trim(), desc.trim(), members)
    setOpen(false)
  }
  /** 组合状态徽标：待审核 / 已发布 / 已下架。 */
  const statusBadge = (s: Combo['status']) =>
    s === 'published' ? <span className="dshs-badge of">已发布</span>
    : s === 'unpublished' ? <span className="dshs-badge ba">已下架</span>
    : <span className="dshs-badge wa">待审核</span>
  /** 成员徽标：手动安装成员带 ✋ 标记。 */
  const memberBadge = (m: Combo['members'][number]) => (
    <span className={'dshs-badge' + (m.install_mode === 'manual' ? ' cm' : '')} key={m.pkg} title={m.install_mode === 'manual' ? '手动安装' : '一键安装'}>
      {m.pkg}{m.install_mode === 'manual' ? ' ✋' : ''}
    </span>
  )
  /** 组合卡片底部操作行（作者视角：订阅数可见 + 修改/删除；他人视角：订阅数 + 安装）。 */
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
          ) : props.installing['combo:' + c.name] ? (
            <button className="dshs-ibtn" disabled>⏳ 下载中…</button>
          ) : (
            <button className="dshs-ibtn" onClick={() => props.onInstallCombo(c.name)}>一键下载整组</button>
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
            <span className={'dshs-badge' + (m.install_mode === 'manual' ? ' cm' : '')} title={m.install_mode === 'manual' ? '手动安装：需自行打开插件页面安装' : '一键安装'}>
              {m.install_mode === 'manual' ? '✋ 手动' : '⚡ 自动'}
            </span>
            {p?.author ? <span className="dshs-compat" style={{ marginLeft: 0 }}>👤 {p.author}</span> : null}
            {p?.repo_url ? (
              <a className="dshs-lk" href={p.repo_url} target="_blank" rel="noreferrer" title={p.repo_url}>🔗 仓库</a>
            ) : null}
            {props.installed[m.pkg] ? (
              <span className="dshs-compat">已安装 v{props.installed[m.pkg]}</span>
            ) : (
              <button className="dshs-abtn" onClick={() => props.onInstallPlugin(m.pkg)}>下载</button>
            )}
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
            <div className="dshs-empty" style={{ padding: 14 }}>还没有自己的组合，点上方按钮创建第一个组合</div>
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
              <div className="dshs-frow">
                <input className="dshs-input" placeholder="一句话简介（≤200字）" value={desc} onChange={(e) => setDesc(e.target.value)} />
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
              <div className="dshs-subnote" style={{ marginBottom: 6 }}>插件库中的插件优先展示（未安装也可选），带 👤 作者与 🔗 仓库链接；安装方式：⚡ 自动 = 一键下载直接安装；✋ 手动 = 组内其他插件直接装，该插件打开页面由你自行安装。</div>
              {visible.length ? (
                visible.map((it) => {
                  const on = !!sel[it.id]
                  const mode = modes[it.id] ?? 'auto'
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
                      {on ? (
                        <span className="dshs-mode" onClick={(e) => e.stopPropagation()}>
                          <button className={'dshs-mode-btn' + (mode === 'auto' ? ' on' : '')} onClick={() => setModes({ ...modes, [it.id]: 'auto' })}>⚡ 自动</button>
                          <button className={'dshs-mode-btn' + (mode === 'manual' ? ' on' : '')} onClick={() => setModes({ ...modes, [it.id]: 'manual' })}>✋ 手动</button>
                        </span>
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
              <div className="dshs-subnote">💡 点开成员可挑着下载（=单独安装，不订阅该组）；一键下载整组 = 订阅，作者新增插件将提醒你。✋ 手动安装的成员需自行打开插件页面安装。</div>
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
  installing: Record<string, boolean>
  onInstallCombo: (name: string) => void
  onInstallPlugin: (pkg: string) => void
  onUpdate: (pkg: string) => void
  onUnsubscribe: (name: string) => void
  onPushCloud: () => Promise<CloudList>
  onRefreshCloud: () => Promise<CloudList>
  onRestoreSubs: (combos: string[]) => void
}) {
  const [q, setQ] = useState('')
  const [cloudOpen, setCloudOpen] = useState(false)
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({})
  const [subSelected, setSubSelected] = useState<Record<string, boolean>>({})
  const [csearch, setCsearch] = useState('')
  const [cloudDeselected, setCloudDeselected] = useState<Record<string, boolean>>({})
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
  const toggleCloud = (key: string) => {
    const next = { ...cloudDeselected }
    if (next[key]) delete next[key]
    else next[key] = true
    setCloudDeselected(next)
  }
  const restoreSelectedCloud = () => {
    const cs = props.cloud.combos.filter((c) => !cloudDeselected['c:' + c])
    props.onRestoreSubs(cs)
    setCloudMsg(`已开始恢复 ${cs.length} 个云端组合`)
  }

  return (
    <div>
      <div className="dshs-sec">
        ☁️ 云端组合
        <button className="dshs-abtn" onClick={() => setCloudOpen(!cloudOpen)}>
          {cloudOpen ? '收起 ▴' : `展开（${props.cloud.combos.length}）▾`}
        </button>
      </div>
      {cloudOpen ? (
        <div className="dshs-cloudbox">
          <div className="dshs-subnote">云端保存的组合：勾选恢复会同时恢复订阅和组内插件；数据过多时在下方框内滚动查找。</div>
          <div className="dshs-actions" style={{ marginTop: 6 }}>
            <button
              className="dshs-abtn"
              onClick={() => {
                setCloudMsg('正在上传本地组合到云端…')
                void props.onPushCloud().then((c) => setCloudMsg(`已上传：${c.combos.length} 个组合`))
              }}
            >
              ☁ 上传本地到云端
            </button>
            <button
              className="dshs-abtn"
              onClick={() => {
                setCloudMsg('正在从云端刷新…')
                void props.onRefreshCloud().then((c) => setCloudMsg(`云端清单：${c.combos.length} 个组合`))
              }}
            >
              ↻ 从云端刷新
            </button>
            {props.installing['restore'] ? (
              <button className="dshs-abtn pri" disabled>⏳ 恢复中…</button>
            ) : (
              <button className="dshs-abtn pri" onClick={restoreSelectedCloud}>恢复所选</button>
            )}
            {props.installing['restore'] ? (
              <button className="dshs-abtn" disabled>⏳ 恢复中…</button>
            ) : (
              <button className="dshs-abtn" onClick={() => props.onRestoreSubs(props.cloud.combos)}>⚡ 全部恢复</button>
            )}
          </div>
          {cloudMsg ? <div className="dshs-notif"><div className="nt">{cloudMsg}</div></div> : null}
          <div className="dshs-frow" style={{ marginTop: 8 }}>
            <input className="dshs-input" placeholder="搜索云端组合…" value={csearch} onChange={(e) => setCsearch(e.target.value)} />
          </div>
          <div className="dshs-cloud-scroll">
            {cloudCombos.length ? cloudCombos.map((c) => (
              <div className="dshs-pick" key={c} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') toggleCloud('c:' + c) }}>
                <input type="checkbox" checked={!cloudDeselected['c:' + c]} onChange={() => toggleCloud('c:' + c)} />
                <span className="dshs-nm" style={{ fontWeight: 600 }}>🗂 {c}（组）</span>
              </div>
            )) : <div className="dshs-empty" style={{ padding: 10 }}>{cq ? '云端组合中没有匹配项' : '云端暂无组合'}</div>}
          </div>
        </div>
      ) : null}
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
                          <span className="dshs-nm" style={{ fontWeight: 600 }}>{m.pkg}</span>
                          {p && up ? (
                            <span className="dshs-updot">有更新 v{iv} → v{p.version}</span>
                          ) : iv ? (
                            <span className="dshs-compat">v{iv}</span>
                          ) : (
                            <span className="dshs-compat">未安装</span>
                          )}
                          {p && up ? (
                            props.installing[m.pkg] ? (
                              <button className="dshs-ibtn" style={{ marginLeft: 0 }} disabled>⏳ 更新中…</button>
                            ) : (
                              <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => props.onUpdate(m.pkg)}>更新</button>
                            )
                          ) : iv ? null : props.installing[m.pkg] ? (
                            <button className="dshs-abtn" disabled>⏳ 下载中…</button>
                          ) : (
                            <button className="dshs-abtn" onClick={() => props.onInstallPlugin(m.pkg)}>下载</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="dshs-mrow">
                    {props.installing['combo:' + c.name] ? (
                      <button className="dshs-ibtn" style={{ marginLeft: 0 }} disabled>⏳ 更新中…</button>
                    ) : (
                      <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => props.onInstallCombo(c.name)}>一键更新全部</button>
                    )}
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
  installing: Record<string, boolean>
  onPushCloud: () => Promise<CloudList>
  onRefreshCloud: () => Promise<CloudList>
  onRestorePlugins: (plugins: string[]) => void
  onUpdate: (pkg: string) => void
  onUninstall: (pkg: string) => void
  onAckAll: () => void
}) {
  const [q, setQ] = useState('')
  const [psearch, setPsearch] = useState('')
  const [deselected, setDeselected] = useState<Record<string, boolean>>({})
  const [uninstallSelected, setUninstallSelected] = useState<Record<string, boolean>>({})
  const [cloudMsg, setCloudMsg] = useState<string | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)

  const kw = q.trim().toLowerCase()
  const pq = psearch.trim().toLowerCase()
  const cloudPlugins = props.cloud.plugins.filter((p) => !pq || p.toLowerCase().includes(pq))
  const updates = props.plugins.filter((p) => hasUpdate(p, props.installed))
  const unacked = updates.filter((p) => props.acked[p.id] !== p.version)
  const entries = props.plugins.filter(
    (p) => props.installed[p.id] && (!kw || p.name.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)),
  )
  const selectedUninstall = entries.filter((p) => uninstallSelected[p.id]).map((p) => p.id)

  const toggle = (key: string) => {
    const next = { ...deselected }
    if (next[key]) delete next[key]
    else next[key] = true
    setDeselected(next)
  }
  const row = (key: string, label: string, icon: string) => (
    <div
      className="dshs-pick"
      key={key}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT') toggle(key)
      }}
    >
      <input type="checkbox" checked={!deselected[key]} onChange={() => toggle(key)} />
      <span className="dshs-nm" style={{ fontWeight: 600 }}>{icon} {label}</span>
    </div>
  )
  const doRestorePlugins = () => {
    const ps = props.cloud.plugins.filter((p) => !deselected['p:' + p])
    props.onRestorePlugins(ps)
    setCloudMsg(`已开始恢复 ${ps.length} 个云端插件`)
  }

  return (
    <div>
      <div className="dshs-sec">
        ☁️ 云端插件
        <button className="dshs-abtn" onClick={() => setCloudOpen(!cloudOpen)}>
          {cloudOpen ? '收起 ▴' : `展开（${props.cloud.plugins.length}）▾`}
        </button>
      </div>
      {cloudOpen ? (
        <div className="dshs-cloudbox">
          <div className="dshs-subnote">云端已保存的插件：勾选后恢复；插件较多时在下方框内滚动查找。</div>
          <div className="dshs-actions" style={{ marginTop: 6 }}>
            <button
              className="dshs-abtn"
              onClick={() => {
                setCloudMsg('正在上传本地插件到云端…')
                void props.onPushCloud().then((c) => setCloudMsg(`已上传：${c.plugins.length} 个插件`))
              }}
            >
              ☁ 上传本地到云端
            </button>
            <button
              className="dshs-abtn"
              onClick={() => {
                setCloudMsg('正在从云端刷新…')
                void props.onRefreshCloud().then((c) => setCloudMsg(`云端清单：${c.plugins.length} 个插件`))
              }}
            >
              ↻ 从云端刷新
            </button>
            {props.installing['restore'] ? (
              <button className="dshs-abtn pri" disabled>⏳ 恢复中…</button>
            ) : (
              <button className="dshs-abtn pri" onClick={doRestorePlugins}>恢复所选</button>
            )}
            {props.installing['restore'] ? (
              <button className="dshs-abtn" disabled>⏳ 恢复中…</button>
            ) : (
              <button className="dshs-abtn" onClick={() => props.onRestorePlugins(props.cloud.plugins)}>⚡ 全部恢复</button>
            )}
          </div>
          {cloudMsg ? <div className="dshs-notif"><div className="nt">{cloudMsg}</div></div> : null}
          <div className="dshs-frow" style={{ marginTop: 8 }}>
            <input className="dshs-input" placeholder="搜索云端插件…" value={psearch} onChange={(e) => setPsearch(e.target.value)} />
          </div>
          <div className="dshs-cloud-scroll">
            {cloudPlugins.length ? cloudPlugins.map((p) => row('p:' + p, p, '🧩')) : <div className="dshs-empty" style={{ padding: 10 }}>{pq ? '云端插件中没有匹配项' : '云端暂无插件'}</div>}
          </div>
        </div>
      ) : null}

      <div className="dshs-sec" style={{ marginTop: 10 }}>
        🔵 更新提醒
        <span>{unacked.length ? unacked.length + ' 个插件可更新' : '全部最新'}</span>
      </div>
      <div className="dshs-mem" style={{ borderColor: unacked.length ? 'rgba(59,158,255,.5)' : undefined }}>
        <span className="dshs-nm" style={{ fontWeight: 600 }}>🔵 更新提醒</span>
        <span className="dshs-compat">{unacked.length ? unacked.length + ' 个插件可更新' : '全部最新'}</span>
        {unacked.length ? <button className="dshs-abtn" onClick={props.onAckAll}>全部已知</button> : null}
      </div>

      <div className="dshs-sec" style={{ marginTop: 10 }}>
        🧩 已安装插件
        <span>{entries.length} 个</span>
      </div>
      <div className="dshs-frow">
        <input className="dshs-input" placeholder="搜索已安装插件…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <BatchDeleteBar
        count={selectedUninstall.length}
        itemName="已安装插件"
        onDelete={() => {
          selectedUninstall.forEach((id) => props.onUninstall(id))
          setUninstallSelected({})
        }}
        onClear={() => setUninstallSelected({})}
      />
      {entries.length ? (
        entries.map((p) => (
          <div className="dshs-mem" key={p.id}>
            <input type="checkbox" checked={!!uninstallSelected[p.id]} onChange={() => setUninstallSelected({ ...uninstallSelected, [p.id]: !uninstallSelected[p.id] })} />
            <span className="dshs-nm" style={{ fontWeight: 600 }}>{p.name}</span>
            <span className="dshs-compat">by {p.author ?? '—'}</span>
            {hasUpdate(p, props.installed)
              ? <span className="dshs-updot">v{props.installed[p.id]} → v{p.version}</span>
              : <span className="dshs-compat">v{p.version} 最新</span>}
            {hasUpdate(p, props.installed) ? (
              props.installing[p.id] ? (
                <button className="dshs-ibtn" style={{ marginLeft: 0 }} disabled>⏳ 更新中…</button>
              ) : (
                <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => props.onUpdate(p.id)}>更新</button>
              )
            ) : null}
            <ConfirmDelete label="卸载" confirmText="确认卸载" className="dshs-x" title={`卸载：dsh plugin remove ${p.id}`} onConfirm={() => props.onUninstall(p.id)} />
          </div>
        ))
      ) : (
        <div className="dshs-empty" style={{ padding: 12 }}>{kw ? '未找到匹配的已装插件' : '尚未安装任何插件'}</div>
      )}
    </div>
  )
}
