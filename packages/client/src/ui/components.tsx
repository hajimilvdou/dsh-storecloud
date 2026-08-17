import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import type { Announcement, Plugin, ServerSource } from '@dsh-store/shared'
import type { AccountInfo } from './bridge.js'

export interface Pos {
  x: number
  y: number
}

export interface FabBadge {
  announcement: boolean
  count: number
}

const FAB_SIZE = 56
const FAB_MARGIN = 8
const clampPos = (v: number, max: number) => Math.max(FAB_MARGIN, Math.min(max, v))

/** 右下角漂浮球：可拖拽且始终留在视口内；只有「按下-松开未移动」才算点击，避免拖动误开面板。 */
export function Fab(props: {
  pos: Pos
  badge: FabBadge
  onToggle: () => void
  onMove: (p: Pos) => void
}) {
  const [drag, setDrag] = useState<{ mx: number; my: number; bx: number; by: number } | null>(null)
  const moved = useRef(false)
  const onMoveRef = useRef(props.onMove)

  useEffect(() => {
    onMoveRef.current = props.onMove
  }, [props.onMove])

  useEffect(() => {
    if (!drag) return
    const onMove = (e: globalThis.MouseEvent) => {
      const dx = e.clientX - drag.mx
      const dy = e.clientY - drag.my
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true
      onMoveRef.current({
        x: clampPos(drag.bx - dx, window.innerWidth - FAB_SIZE - FAB_MARGIN),
        y: clampPos(drag.by - dy, window.innerHeight - FAB_SIZE - FAB_MARGIN),
      })
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag])

  return (
    <div
      className="dshs-fab"
      title="插件商城"
      style={{ right: props.pos.x + 'px', bottom: props.pos.y + 'px' }}
      onClick={() => {
        if (moved.current) {
          moved.current = false
          return
        }
        props.onToggle()
      }}
      onMouseDown={(e) => {
        moved.current = false
        setDrag({ mx: e.clientX, my: e.clientY, bx: props.pos.x, by: props.pos.y })
        e.preventDefault()
      }}
    >
      🧩
      {props.badge.announcement ? <span className="dshs-dot">!</span> : null}
      {props.badge.count > 0 ? <span className="dshs-dot blue">{props.badge.count}</span> : null}
    </div>
  )
}

export function sourceBadge(p: Plugin) {
  const official = p.source === 'official'
  return <span className={'dshs-badge ' + (official ? 'of' : 'cm')}>{official ? '官方' : '社区'}</span>
}

/** 类型徽标：Plugin / Agent(Preset) / 双形态。 */
export function typeBadge(p: Plugin) {
  if (p.kind === 'preset') return <span className="dshs-badge cm">🤖 Agent 预设</span>
  if (p.preset_name) return <span className="dshs-badge of">🧩 插件 + 🤖 预设</span>
  return <span className="dshs-badge of">🧩 插件</span>
}

/** 安装说明（Preset 复制路径 / Plugin dsh plugin add）。 */
export function installHint(p: Plugin): string {
  if (p.kind === 'preset' || p.preset_name) return `安装到 ~/.dsh/.agent-presets/${p.preset_name ?? p.name}，重启后新建空白会话选择`
  return `dsh plugin --profile web add ${p.install ?? p.id}`
}

/** 点赞按钮（登录后可点；已赞高亮；点击切换并返回最新计数）。 */
export function LikeButton(props: { pkg: string; liked?: boolean; count: number; onLike: (pkg: string) => void }) {
  return (
    <button
      className={'dshs-like' + (props.liked ? ' on' : '')}
      title={props.liked ? '取消点赞' : '点赞（登录后）'}
      onClick={(e) => {
        e.stopPropagation()
        props.onLike(props.pkg)
      }}
    >
      {props.liked ? '❤️' : '🤍'} {props.count}
    </button>
  )
}

/**
 * 安装前须知（首次安装弹出；可勾选"以后不再提醒"持久化）。
 * 说明：插件安装方式多样，面板只支持官方规定流程（dsh plugin add / 预设复制），
 * 复杂安装流程可能失败，需前往发布页（GitHub Releases）自行安装。
 */
export function InstallNoticeModal(props: {
  repoUrl?: string
  onConfirm: (neverAgain: boolean) => void
  onCancel: () => void
}) {
  const [never, setNever] = useState(false)
  return (
    <div className="dshs-modal" onClick={props.onCancel}>
      <div className="dshs-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="t">
          ⚠️ 安装前须知
          <button onClick={props.onCancel}>✕</button>
        </div>
        <div className="c" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            当前插件的安装方式多样，本面板仅支持<strong>官方规定的安装流程</strong>（dsh plugin add / Agent 预设复制）。
          </div>
          <div>
            若该插件安装流程较复杂（多步骤、依赖特定环境或自定义脚本），面板内安装<strong>可能失败</strong>——
            失败时请前往插件的<strong>发布页（GitHub Releases）</strong>按说明自行安装。
          </div>
          {props.repoUrl ? (
            <a
              className="dshs-ibtn"
              style={{ alignSelf: 'flex-start', marginLeft: 0, textDecoration: 'none' }}
              href={props.repoUrl + '/releases'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={props.onCancel}
            >
              前往发布页 ↗
            </a>
          ) : null}
        </div>
        <div className="dshs-mrow" style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--tx2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            以后安装不再提醒
          </label>
          <span style={{ flex: 1 }} />
          <button className="dshs-abtn" onClick={props.onCancel}>取消</button>
          <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={() => props.onConfirm(never)}>
            知道了，继续安装
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 双指标并列但视觉分离：⭐ GitHub 星数（只读）/ 📈 日增 / ⭐ 近7天收藏增加。
 * 本站点赞已取消(GitHub 星数即社区认可,不重复造轮子)。
 */
export function Metrics(props: { p: Plugin }) {
  return (
    <div className="dshs-mrow">
      <span className="dshs-st" title="GitHub 星数（只读）">⭐ {props.p.stars}</span>
      <span className="dshs-dl" title="今日新增星数">📈 +{props.p.stars_delta_day}</span>
      <span className="dshs-dl7" title="近7天 GitHub 收藏增加">⭐ +{props.p.stars_delta_7d ?? 0}/7天</span>
    </div>
  )
}

export function InstallButton(props: {
  pkg: string
  install?: string
  installed: Record<string, string>
  onInstall: (pkg: string) => void
}) {
  const spec = props.install ?? props.pkg
  if (props.installed[props.pkg]) {
    return <button className="dshs-ibtn done" disabled title={`已安装：dsh plugin add ${spec}`}>已安装 ✓</button>
  }
  return <button className="dshs-ibtn" onClick={() => props.onInstall(props.pkg)} title={`一键安装：dsh plugin add ${spec}`}>一键安装</button>
}

export function UpdateButton(props: {
  p: Plugin
  installed: Record<string, string>
  onUpdate: (pkg: string) => void
}) {
  const iv = props.installed[props.p.id]
  if (!iv || compare(props.p.version, iv) <= 0) return null
  return <button className="dshs-ibtn" onClick={() => props.onUpdate(props.p.id)}>一键更新</button>
}

function compare(a: string, b: string): number {
  const n = (s: string): [number, number, number] => {
    const p = String(s || '').replace(/^v/, '').split('.')
    const d = (i: number) => (Number.isNaN(parseInt(p[i] ?? '0', 10)) ? 0 : parseInt(p[i] ?? '0', 10))
    return [d(0), d(1), d(2)]
  }
  const [a0, a1, a2] = n(a)
  const [b0, b1, b2] = n(b)
  return a0 !== b0 ? a0 - b0 : a1 !== b1 ? a1 - b1 : a2 - b2
}

export function hasUpdate(p: Plugin, installed: Record<string, string>): boolean {
  const iv = installed[p.id]
  return !!iv && compare(p.version, iv) > 0
}

/** 简介：默认 2 行截断，超长时提供「展开/收起」切换显示全文。 */
export function Desc(props: { text: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false)
  const long = (props.text || '').length > 26
  return (
    <div>
      <div className={'dshs-ds' + (open ? ' expanded' : '')} style={props.style}>{props.text}</div>
      {long ? <button className="dshs-exp" onClick={() => setOpen(!open)}>{open ? '▴ 收起' : '▾ 展开'}</button> : null}
    </div>
  )
}

/** 源地址链接：跳转 GitHub 发布页（releases）。 */
export function srcLink(p: Plugin) {
  const url = (p.repo_url || 'https://github.com/' + p.repo) + '/releases'
  return <a className="dshs-src" href={url} target="_blank" rel="noopener noreferrer" title="GitHub 发布页">源地址 ↗</a>
}

export function TopBar(props: {
  query: string
  onQuery: (q: string) => void
  theme: 'dark' | 'light'
  onTheme: () => void
  onDrawer: () => void
  onAccount: () => void
  unread: boolean
  onDragStart: (e: ReactMouseEvent) => void
}) {
  const stop = (e: ReactMouseEvent) => e.stopPropagation()
  return (
    <div className="dshs-p-top" onMouseDown={props.onDragStart}>
      <span className="dshs-logo">🧩 插件商城</span>
      <div className="dshs-search" onMouseDown={stop}>
        🔍
        <input
          placeholder="搜索插件 / 组合 / Agent…（本地搜索）"
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
        />
      </div>
      <button className="dshs-ico" title="明暗切换" onMouseDown={stop} onClick={props.onTheme}>
        {props.theme === 'dark' ? '☾' : '☀'}
      </button>
      <button className="dshs-ico" title="公告" onMouseDown={stop} onClick={props.onDrawer}>
        🔔
        {props.unread ? (
          <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
        ) : null}
      </button>
      <button className="dshs-ico my" title="我的" onMouseDown={stop} onClick={props.onAccount}>
        我的
      </button>
    </div>
  )
}

export function Drawer(props: {
  announcements: Announcement[]
  onClose: () => void
  onZoom: (a: Announcement) => void
  onRemove: (id: string) => void
}) {
  const [src, setSrc] = useState('all')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const srcs = ['all', ...Array.from(new Set(props.announcements.map((a) => a.origin_server)))]
  const filtered = src === 'all' ? props.announcements : props.announcements.filter((a) => a.origin_server === src)
  const selectedIds = filtered.filter((a) => selected[a.id]).map((a) => a.id)
  return (
    <div className="dshs-drawer">
      <div className="dshs-dh">
        📢 更新公告
        <button onClick={props.onClose}>✕</button>
      </div>
      <div className="dshs-atabs">
        {srcs.map((s) => (
          <button key={s} className={s === src ? 'on' : ''} onClick={() => setSrc(s)}>
            {s === 'all' ? '全部' : s}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 10 }}>
        <BatchDeleteBar
          count={selectedIds.length}
          itemName="公告"
          onDelete={() => {
            selectedIds.forEach((id) => props.onRemove(id))
            setSelected({})
          }}
          onClear={() => setSelected({})}
        />
        {filtered.length ? (
          filtered.map((a) => (
            <div className="dshs-anno" key={a.id}>
              <div className="t">
                <input type="checkbox" checked={!!selected[a.id]} onChange={() => setSelected({ ...selected, [a.id]: !selected[a.id] })} />
                {a.version}
                <span className={'dshs-lv ' + (a.level === 'important' ? 'imp' : 'inf')}>
                  {a.level === 'important' ? '重要' : '通知'}
                </span>
                <span className="dshs-badge" style={{ marginLeft: 'auto' }}>{a.origin_server}</span>
              </div>
              <div className="c">{a.content}</div>
              <div className="d">{a.published_at}</div>
              <div className="act">
                <button className="dshs-abtn" onClick={() => props.onZoom(a)}>🔍 放大查看</button>
                <ConfirmDelete onConfirm={() => props.onRemove(a.id)} />
              </div>
            </div>
          ))
        ) : (
          <div className="dshs-empty">暂无公告</div>
        )}
      </div>
    </div>
  )
}

export interface Geo {
  r: number
  b: number
  w: number
  h: number
}

/** 面板外壳：顶栏拖动自由移动；四个角拖拽缩放（360×480 ~ 720×900，受视口约束）。 */
export function StorePanel(props: {
  geo: Geo
  onBegin: (kind: 'tl' | 'tr' | 'bl' | 'br', e: ReactMouseEvent) => void
  children?: ReactNode
}) {
  return (
    <div
      className="dshs-panel"
      style={{ right: props.geo.r, bottom: props.geo.b, width: props.geo.w, height: props.geo.h }}
    >
      {props.children}
      <div className="dshs-h tl" title="拖拽调整" onMouseDown={(e) => props.onBegin('tl', e)} />
      <div className="dshs-h tr" title="拖拽调整" onMouseDown={(e) => props.onBegin('tr', e)} />
      <div className="dshs-h bl" title="拖拽调整" onMouseDown={(e) => props.onBegin('bl', e)} />
      <div className="dshs-h br" title="拖拽调整" onMouseDown={(e) => props.onBegin('br', e)} />
    </div>
  )
}

export function ZoomModal(props: { a: Announcement; onClose: () => void }) {
  return (
    <div className="dshs-modal" onClick={props.onClose}>
      <div className="dshs-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="t">
          {props.a.version}
          <span className={'dshs-lv ' + (props.a.level === 'important' ? 'imp' : 'inf')}>
            {props.a.level === 'important' ? '重要' : '通知'}
          </span>
          <span className="dshs-badge">{props.a.origin_server}</span>
          <button onClick={props.onClose}>✕</button>
        </div>
        <div className="c">{props.a.content}</div>
        <div style={{ marginTop: 8, color: 'var(--tx2)', fontSize: 11 }}>{props.a.published_at}</div>
      </div>
    </div>
  )
}

/** 删除确认按钮：第一次点击变成“确认删除”，3 秒未确认自动恢复。 */
export function ConfirmDelete(props: {
  label?: string
  confirmText?: string
  className?: string
  title?: string
  onConfirm: () => void
}) {
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    if (!ask) return
    const t = window.setTimeout(() => setAsk(false), 3000)
    return () => window.clearTimeout(t)
  }, [ask])
  if (ask) {
    return (
      <span className="dshs-confirm" onClick={(e) => e.stopPropagation()}>
        <button className="dshs-abtn dan" onClick={() => { setAsk(false); props.onConfirm() }}>{props.confirmText ?? '确认删除'}</button>
        <button className="dshs-abtn" onClick={() => setAsk(false)}>取消</button>
      </span>
    )
  }
  return (
    <button
      className={props.className ?? 'dshs-abtn dan'}
      title={props.title}
      onClick={(e) => {
        e.stopPropagation()
        setAsk(true)
      }}
    >
      {props.label ?? '删除'}
    </button>
  )
}

/** 批量删除操作条：显示已选数量 + 确认删除 / 取消选择。 */
export function BatchDeleteBar(props: {
  count: number
  itemName?: string
  onDelete: () => void
  onClear: () => void
}) {
  if (props.count <= 0) return null
  return (
    <div className="dshs-batchbar">
      <span className="dshs-compat">已选 {props.count} 个{props.itemName ?? '项目'}</span>
      <ConfirmDelete label={`删除所选（${props.count}）`} confirmText="确认删除所选" onConfirm={props.onDelete} />
      <button className="dshs-abtn" onClick={props.onClear}>取消选择</button>
    </div>
  )
}

/** 服务器源管理器（「我的」抽屉与底部「插件库」共用）：源卡片 + 校验添加。 */
export function SourceManager(props: {
  sources: ServerSource[]
  onAddSource: (url: string, password: string) => void
  onRemoveSource: (id: string) => void
  onPingSource: (id: string) => void
  onSwitchSource: (id: string) => void
}) {
  const [url, setUrl] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const removable = props.sources.filter((s) => !s.builtin)
  const selectedIds = removable.filter((s) => selected[s.id]).map((s) => s.id)
  const toggleSelect = (id: string) => {
    const next = { ...selected }
    if (next[id]) delete next[id]
    else next[id] = true
    setSelected(next)
  }

  const add = () => {
    const u = url.trim()
    if (!u) {
      setMsg('请先填写服务器网址')
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      setMsg('服务器网址需以 http:// 或 https:// 开头')
      return
    }
    setMsg(`正在校验并添加 ${u}…`)
    Promise.resolve(props.onAddSource(u, pass))
      .then(() => setMsg(`已添加源：${u}`))
      .catch((e) => setMsg(`添加失败：${String((e && (e as Error).message) || e)}`))
    setUrl('')
    setPass('')
  }

  return (
    <div className="dshs-source">
      <BatchDeleteBar
        count={selectedIds.length}
        itemName="服务器源"
        onDelete={() => {
          selectedIds.forEach((id) => props.onRemoveSource(id))
          setSelected({})
          setMsg(`已删除 ${selectedIds.length} 个服务器源`)
        }}
        onClear={() => setSelected({})}
      />
      {props.sources.map((s) => (
        <div className="dshs-src-card" key={s.id}>
          <div className="dshs-src-head">
            <div className="dshs-src-title">
              {!s.builtin ? <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleSelect(s.id)} /> : null}
              <span className="dshs-nm" title={s.name}>{s.name}</span>
              {s.builtin ? <span className="dshs-badge of">内置</span> : null}
            </div>
            <div className="dshs-pills">
              {s.role === 'primary' ? <span className="dshs-pill primary">主源</span> : <span className="dshs-pill off">备用</span>}
              {s.is_lb ? <span className="dshs-pill lb">⚖️ 负载均衡</span> : <span className="dshs-pill ind">独立源</span>}
              {s.status === 'connected' ? <span className="dshs-pill primary">已连接</span> : s.status === 'connecting' ? <span className="dshs-pill wa">连接中…</span> : s.status === 'unreachable' ? <span className="dshs-pill err">已断联</span> : <span className="dshs-pill off">未连接</span>}
            </div>
          </div>
          <div className="dshs-src-sub">
            <span className="dshs-src-url">{s.url}</span>
            <span>{s.latency_ms !== null ? `${s.latency_ms}ms` : '未测速'}</span>
          </div>
          <div className="dshs-actions">
            {s.role !== 'primary' ? (
              <button className="dshs-abtn pri" onClick={() => { setMsg(`已切换数据源：${s.name}`); props.onSwitchSource(s.id) }}>设为主源</button>
            ) : null}
            <button
              className="dshs-abtn"
              onClick={() => {
                setMsg(`正在测速 ${s.name}…`)
                Promise.resolve(props.onPingSource(s.id))
                  .then(() => setMsg(null)) // 测速完成：提示消失,延迟/状态已更新在源卡片上
                  .catch((e) => setMsg(`测速失败：${String((e && (e as Error).message) || e)}`))
              }}
            >
              测速
            </button>
            {s.builtin ? null : (
              <ConfirmDelete
                onConfirm={() => {
                  props.onRemoveSource(s.id)
                  setMsg(`已删除源：${s.name}`)
                }}
              />
            )}
          </div>
        </div>
      ))}
      {props.sources.length === 0 ? <div className="dshs-empty">暂无服务器源</div> : null}
      {msg ? (
        <div className="dshs-notif" style={{ borderLeftColor: 'var(--brand1)' }}>
          <div className="nt">{msg}</div>
        </div>
      ) : null}
      <div className="dshs-src-add">
        <div className="dshs-frow">
          <input className="dshs-input" placeholder="服务器网址，如 https://xxx.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="dshs-frow">
          <input className="dshs-input" placeholder="该源管理员设置的访问密码（可选）" value={pass} onChange={(e) => setPass(e.target.value)} />
        </div>
        <div className="dshs-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="dshs-ibtn" style={{ marginLeft: 0 }} onClick={add}>＋ 校验并添加源</button>
        </div>
      </div>
    </div>
  )
}

export function AccountDrawer(props: {
  loggedIn: boolean
  account: AccountInfo | null
  sources: ServerSource[]
  authUser: { login: string; name: string | null } | null
  /** GitHub 登录中：授权回传后同步云端清单需要几十秒,显示加载提示。 */
  authBusy?: boolean
  /** 登录结果（成功/失败）全局横幅内容：抽屉内也同步展示,避免被浮层遮挡。 */
  authNotice?: { ok: boolean; msg: string } | null
  /** 放置位置能力清单(壳侧广播)：section=设置页 / header=会话头部。 */
  storeLocs?: { section?: boolean; header?: boolean }
  /** 切换放置位置(写 localStorage + 通知壳侧)。 */
  onSetLoc?: (key: 'section' | 'header', on: boolean) => void
  serverUrl?: string
  /** 组合/数据更新频率（分钟，服务端配置下发，客户端按此心跳拉取）。 */
  heartbeatMin?: number
  /** 客户端插件自身版本（本地常量）与可用的新版本。 */
  clientVersion: string
  clientUpdate: { version: string; install: string } | null
  onClose: () => void
  onLogout: () => void
  onAddSource: (url: string, password: string) => void
  onRemoveSource: (id: string) => void
  onPingSource: (id: string) => void
  onSwitchSource: (id: string) => void
  onClientUpdate: (spec: string, version: string) => Promise<{ ok: boolean; message: string }>
  onDeleteAccount: (combos: 'delete' | 'anonymize') => Promise<{ ok: boolean; message: string }>
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [delMsg, setDelMsg] = useState<string | null>(null)
  const [updMsg, setUpdMsg] = useState<string | null>(null)

  // 服务器源管理（登录与否都可用：未登录也能先接好源再登录）
  const sourcesManager = (
    <SourceManager
      sources={props.sources}
      onAddSource={props.onAddSource}
      onRemoveSource={props.onRemoveSource}
      onPingSource={props.onPingSource}
      onSwitchSource={props.onSwitchSource}
    />
  )

  // 商城放置位置切换(两个位置：设置页/会话头部；悬浮球已移除)：
  // 能力清单缺失/为 false = 当前应用(打包版可能裁剪该位置)不适配 → 置灰并提醒。
  const locItems: Array<{ key: 'section' | 'header'; label: string; hint: string }> = [
    { key: 'section', label: '设置页', hint: '左下角设置中(默认)' },
    { key: 'header', label: '会话头部', hint: '对话/轨迹上方大页面' },
  ]
  const locsManager = (
    <div className="dshs-grp" style={{ marginTop: 10 }}>
      <div className="dshs-sec">🧩 商城放置位置</div>
      {locItems.map((it) => {
        const supported = props.storeLocs?.[it.key] !== false
        const on = supported && (() => {
          try { return localStorage.getItem('dsh_store_loc_' + it.key) !== '0' } catch { return true }
        })()
        return (
          <div key={it.key} className="dshs-mem" style={{ opacity: supported ? 1 : 0.55 }}>
            <span className="dshs-nm" style={{ fontWeight: 600 }}>{it.label}</span>
            <span className="dshs-compat" style={{ marginLeft: 0 }}>{it.hint}</span>
            {supported ? (
              <button
                className={'dshs-loc-toggle' + (on ? ' on' : '')}
                onClick={() => props.onSetLoc?.(it.key, !on)}
                title={on ? '点击关闭' : '点击开启'}
              >
                {on ? '已开启' : '已关闭'}
              </button>
            ) : (
              <span className="dshs-badge ba">不适配</span>
            )}
          </div>
        )
      })}
      {locItems.some((it) => props.storeLocs?.[it.key] === false) ? (
        <div className="dshs-subnote" style={{ color: 'var(--danger)' }}>
          ⚠ 部分位置在当前应用不适配（已置灰）：打包版应用可能未包含对应界面，商城会自动隐藏这些位置的入口。
        </div>
      ) : (
        <div className="dshs-subnote">切换后立即生效；关闭全部位置时,仅保留「我的」页入口。</div>
      )}
    </div>
  )

  if (!props.loggedIn) {
    return (
      <div className="dshs-drawer">
        <div className="dshs-dh">
          👤 我的
          <button onClick={props.onClose}>✕</button>
        </div>
        <div style={{ padding: 12, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {props.authBusy ? (
            <div className="dshs-notif" style={{ borderLeftColor: 'var(--brand2)' }}>
              <div className="nt">⏳ 正在登录 GitHub…正在同步云端清单与点赞状态，首次可能需要几十秒，请稍候</div>
            </div>
          ) : null}
          {props.authNotice ? (
            <div className="dshs-notif" style={{ borderLeftColor: props.authNotice.ok ? 'var(--brand2)' : 'var(--danger)' }}>
              <div className="nt">{props.authNotice.msg}</div>
            </div>
          ) : null}

          <div className="dshs-login-card">
            <div className="dshs-login-gh">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div className="dshs-login-title">使用 GitHub 登录</div>
            <div className="dshs-login-sub">一键授权 · 自动同步 · 无需复制 token</div>
            <div className="dshs-login-benefits">
              <div><span className="k">✓</span>云端同步<b>插件库</b>与<b>订阅组</b>,换机不丢</div>
              <div><span className="k">✓</span>创建、点赞<b>组合</b>,参与社区收录</div>
              <div><span className="k">✓</span>上报<b>库外插件</b>,加速官方收录</div>
              <div><span className="k">✓</span>安装记录与<b>一键还原</b>云端台账</div>
            </div>
            <button
              className="dshs-login-btn"
              onClick={() => {
                // window.open 保留 opener：授权完成后服务器自动 postMessage 回传 token，无需手动复制。
                // 被浏览器拦截时 window.open 返回 null：提示用户放行弹窗，绝不能导航 iframe（会丢失商城界面）。
                try {
                  const w = window.open((props.serverUrl ?? 'https://blog.1qwq1.top') + '/auth/login', '_blank')
                  if (!w) window.alert('弹窗被拦截：请在浏览器地址栏右侧允许本页弹出窗口后重试')
                } catch (e) {
                  window.alert('弹窗被拦截：请在浏览器地址栏右侧允许本页弹出窗口后重试')
                }
              }}
            >
              ⚡ 立即登录 GitHub
            </button>
            <div className="dshs-login-hint">点击后在新窗口完成授权,授权页自动关闭并回传登录,无需任何手动操作</div>
          </div>

          <div className="dshs-mem">
            <span className="dshs-nm" style={{ fontWeight: 600 }}>🌐 服务端</span>
            <span className="dshs-compat">{props.serverUrl ?? ''}</span>
          </div>
          <div className="dshs-mem">
            <span className="dshs-nm" style={{ fontWeight: 600 }}>📡 组合更新频率</span>
            <span className="dshs-compat">每 {props.heartbeatMin ?? 30} 分钟</span>
          </div>
          <div className="dshs-subnote">组合/插件数据按此周期自动刷新（服务端下发）；可在服务端管理端「配置中心 → 客户端更新频率」调整。</div>
          <div className="dshs-subnote">数据通道(浏览/安装插件)不登录也能用；登录仅用于云端同步与社区功能。</div>
          <div className="dshs-subnote" style={{ marginTop: 4 }}>云端插件在「插件库」页，云端订阅组在「订阅」页，均默认折叠。</div>

          {locsManager}

          {sourcesManager}
        </div>
      </div>
    )
  }

  const acct = props.account ?? { login: '', name: null, registered_at: '', combo_quota: '' }
  const loginName = props.authUser?.login || acct.login || '—'

  return (
    <div className="dshs-drawer">
      <div className="dshs-dh">
        👤 我的
        <button onClick={props.onClose}>✕</button>
      </div>
      <div style={{ padding: 12, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div className="dshs-sec">账号信息</div>
        <div className="dshs-mem">
          <span className="dshs-nm" style={{ fontWeight: 600 }}>{loginName}</span>
          <span className="dshs-badge of">GitHub</span>
          <span className="dshs-compat">{props.authUser ? '已登录' : ''}</span>
        </div>
        <div className="dshs-mem">
          <span className="dshs-nm" style={{ fontWeight: 600 }}>组合配额</span>
          <span className="dshs-compat">{acct.combo_quota || '—'}</span>
        </div>

        <div className="dshs-sec" style={{ marginTop: 10 }}>
          📦 版本更新
          <span>{props.clientUpdate ? '有新版本' : '已是最新'}</span>
        </div>
        <div className="dshs-mem">
          <span className="dshs-nm" style={{ fontWeight: 600 }}>客户端插件</span>
          <span className="dshs-compat">
            v{props.clientVersion}
            {props.clientUpdate ? ` → v${props.clientUpdate.version}` : ''}
          </span>
          {props.clientUpdate ? (
            <button
              className="dshs-ibtn"
              style={{ marginLeft: 0 }}
              onClick={() => {
                setUpdMsg(null)
                void props.onClientUpdate(props.clientUpdate!.install, props.clientUpdate!.version).then((r) => setUpdMsg(r.message))
              }}
            >
              一键更新
            </button>
          ) : null}
        </div>
        {updMsg ? (
          <div className="dshs-notif" style={{ borderLeftColor: 'var(--brand2)' }}>
            <div className="nt">{updMsg}</div>
          </div>
        ) : null}

        <div className="dshs-subnote" style={{ marginTop: 10 }}>
          ☁️ 云端插件已移到「插件库」页，云端订阅组已移到「订阅」页，默认折叠，点击即可展开。
        </div>
        <div className="dshs-mem" style={{ marginTop: 8 }}>
          <span className="dshs-nm" style={{ fontWeight: 600 }}>📡 组合更新频率</span>
          <span className="dshs-compat">每 {props.heartbeatMin ?? 30} 分钟（服务端配置）</span>
        </div>
        <div className="dshs-subnote">组合/插件数据按此周期自动刷新；调整位置：服务端管理端 → 配置中心 →「客户端更新频率」。</div>

        {locsManager}

        {sourcesManager}

        <div className="dshs-mrow" style={{ marginTop: 10 }}>
          <button className="dshs-abtn" onClick={props.onLogout}>退出登录</button>
          {!confirmDel ? <button className="dshs-abtn dan" onClick={() => { setConfirmDel(true); setDelMsg(null) }}>注销账号</button> : null}
        </div>
        {confirmDel ? (
          <div className="dshs-notif" style={{ marginTop: 8, borderLeftColor: 'var(--danger)' }}>
            <div className="nt">确认注销？将删除账号、云端清单、点赞、订阅（联动服务器）。已发布的组合：</div>
            <div className="na">
              <button className="dshs-ibtn" style={{ marginLeft: 0, background: 'var(--danger)' }} onClick={() => { void props.onDeleteAccount('delete').then((r) => { setDelMsg(r.message); setConfirmDel(false) }) }}>注销并删除组合</button>
              <button className="dshs-abtn" onClick={() => { void props.onDeleteAccount('anonymize').then((r) => { setDelMsg(r.message); setConfirmDel(false) }) }}>注销并匿名保留组合</button>
              <button className="dshs-abtn" onClick={() => setConfirmDel(false)}>取消</button>
            </div>
          </div>
        ) : null}
        {delMsg ? (
          <div className="dshs-notif" style={{ marginTop: 8, borderLeftColor: 'var(--gold)' }}>
            <div className="nt">{delMsg}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
