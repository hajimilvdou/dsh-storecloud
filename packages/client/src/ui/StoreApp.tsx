import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { Announcement, Combo, ServerSource } from '@dsh-store/shared'
import { searchPlugins, sortPlugins, topTrending } from '../core/index.js'
import type { PluginSortKey } from '../core/index.js'
import { isUpdateAvailable } from '../core/versions.js'
import type { AccountInfo, CloudList, ComboMemberInput, ManualInstallItem, StoreBridge, StoreState, TokenStore } from './bridge.js'
import { CLIENT_PLUGIN_VERSION } from './bridge.js'
import {
  AccountDrawer,
  Drawer,
  Fab,
  hasUpdate,
  InstallNoticeModal,
  StorePanel,
  TopBar,
  ZoomModal,
  type Geo,
  type Pos,
} from './components.js'
import { AgentLibraryView, AgentView, ComboView, MyView, PublishPluginView, SearchView, SubscribeView } from './views.js'

type Tab = 'plugin' | 'combo' | 'agent' | 'my' | 'sub' | 'agentLib'

/** 悬浮窗可视边界：面板四个角都能拖拽缩放，移动/缩放后始终完整留在视口内。 */
const MARGIN = 8
const PANEL_MIN_W = 360
const PANEL_MIN_H = 480
const PANEL_MAX_W = 720
const PANEL_MAX_H = 900

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * 用 right/bottom + 宽高表示窗口几何；先把右/下边距夹进视口，
 * 再按锚边计算可用宽高，保证 panel 不会超出视口被裁掉一部分。
 */
function fitGeo(raw: Geo, vw: number, vh: number): Geo {
  const minW = Math.min(PANEL_MIN_W, Math.max(120, vw - MARGIN * 2))
  const minH = Math.min(PANEL_MIN_H, Math.max(160, vh - MARGIN * 2))
  const w0 = clamp(raw.w, minW, PANEL_MAX_W)
  const h0 = clamp(raw.h, minH, PANEL_MAX_H)
  const r = clamp(raw.r, MARGIN, Math.max(MARGIN, vw - w0 - MARGIN))
  const b = clamp(raw.b, MARGIN, Math.max(MARGIN, vh - h0 - MARGIN))
  const maxW = Math.max(minW, vw - r - MARGIN)
  const maxH = Math.max(minH, vh - b - MARGIN)
  return { r, b, w: clamp(raw.w, minW, maxW), h: clamp(raw.h, minH, maxH) }
}

function initialGeo(): Geo {
  if (typeof window === 'undefined') return { r: 26, b: 94, w: 460, h: 680 }
  return fitGeo({ r: 26, b: 94, w: 460, h: 680 }, window.innerWidth, window.innerHeight)
}

interface DragState {
  kind: 'move' | 'tl' | 'tr' | 'bl' | 'br'
  mx: number
  my: number
  r: number
  b: number
  w: number
  h: number
}

/**
 * 商城面板根组件：从 StoreBridge 拉数据，搜索/排序/趋势全部本地计算（读路径本地化），
 * 安装/更新/卸载/订阅/源/公告回写桥接（写路径实时化）。
 */
export function StoreApp(props: {
  bridge: StoreBridge
  tokenStore?: TokenStore
  serverUrl?: string
  embedded?: boolean
  /** 客户端插件自身更新提醒的“忽略版本”持久化（localStorage / Host KV）。 */
  clientIgnoreStore?: TokenStore
}) {
  const [data, setData] = useState<StoreState | null>(null)
  const [open, setOpen] = useState(() => !!props.embedded)
  const [ignoredClientVersion, setIgnoredClientVersion] = useState<string | null>(() => props.clientIgnoreStore?.current ?? null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [tab, setTab] = useState<Tab>('plugin')
  const [query, setQuery] = useState('')
  /** 防抖后的搜索词：输入停顿 250ms 才触发本地搜索，避免 3000+ 条 × 每击键全量计算卡顿。 */
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<PluginSortKey>('default')
  const [drawer, setDrawer] = useState(false)
  const [acct, setAcct] = useState(false)
  const [publish, setPublish] = useState(false)
  const [read, setRead] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [zoomed, setZoomed] = useState<Announcement | null>(null)
  const [geo, setGeo] = useState<Geo>(initialGeo)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [installed, setInstalled] = useState<Record<string, string>>({})
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>({})
  const [combos, setCombos] = useState<Combo[]>([])
  const [sources, setSources] = useState<ServerSource[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [cloud, setCloud] = useState<CloudList>({ plugins: [], combos: [] })
  const [acked, setAcked] = useState<Record<string, string>>({})
  const [authUser, setAuthUser] = useState<{ login: string; name: string | null } | null>(null)
  const [pos, setPos] = useState<Pos>({ x: 26, y: 26 })
  const [serverUrl, setServerUrl] = useState<string>(props.serverUrl ?? '')
  /** 安装前须知弹窗：首次安装弹出；勾选"不再提醒"后 localStorage 持久化跳过。 */
  const [installNotice, setInstallNotice] = useState<{ repoUrl?: string; proceed: () => void } | null>(null)
  /** 正在安装/更新/下载的目标集合（按钮显示"⏳ 安装中…"禁用态；最长 120s 有反馈）。 */
  const [installing, setInstalling] = useState<Record<string, boolean>>({})
  /** GitHub 登录中（授权回传 token 后同步云端清单需要几十秒，界面显示加载提示）。 */
  const [authBusy, setAuthBusy] = useState(false)
  /** 组合一键安装时标记为手动安装的成员：弹窗逐个打开插件页面。 */
  const [manualList, setManualList] = useState<ManualInstallItem[] | null>(null)
  /** 放置位置能力清单(壳侧广播)：section=设置页 / header=会话头部。 */
  const [storeLocs, setStoreLocs] = useState<{ section?: boolean; header?: boolean }>({})
  /** 登录结果全局横幅（成功/失败都显示几秒后消失，任何页面可见，不依赖抽屉开关）。 */
  const [authNotice, setAuthNotice] = useState<{ ok: boolean; msg: string } | null>(null)

  const applyState = (s: StoreState) => {
    setData(s)
    setInstalled(s.installed)
    setSubscriptions(s.subscriptions)
    setCombos(s.combos)
    setSources(s.sources)
    setAnnouncements(s.announcements)
    setAccount(s.account)
    setCloud(s.cloud)
    setAcked(s.acked)
    setServerUrl(s.serverUrl)
    setLoggedIn(!!s.account.login)
    if (s.account.login) {
      setAuthUser({ login: s.account.login, name: s.account.name })
    } else {
      setAuthUser(null)
    }
  }

  useEffect(() => {
    let alive = true
    const apply = (s: StoreState) => {
      if (alive) applyState(s)
    }
    // bootstrap 立即返回（本地缓存/空态），后台全量/增量同步完成后经 subscribe 刷新。
    props.bridge.bootstrap().then(apply)
    const unsub = props.bridge.subscribe?.(apply)
    return () => {
      alive = false
      unsub?.()
    }
  }, [props.bridge])

  // 搜索防抖：输入停顿后才重算搜索结果（搜索 = 3000+ 条本地计算）。
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(t)
  }, [query])

  // 新公告实时到达（含管理端对组合操作后推送的私人公告）→ 点亮未读红点。
  // 只比较 id 集合：SSE/心跳触发的普通刷新（无新公告）不误报未读。
  const seenAnnoIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    const ids = new Set(announcements.map((a) => a.id))
    if (seenAnnoIds.current === null) {
      seenAnnoIds.current = ids
      return
    }
    const fresh = [...ids].some((id) => !(seenAnnoIds.current as Set<string>).has(id))
    seenAnnoIds.current = ids
    if (fresh) setRead(false)
  }, [announcements])

  // GitHub OAuth 自动取 token：授权窗口完成回调后 postMessage 回传，无需手动复制粘贴。
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = (e.data ?? null) as { type?: string; token?: string; locs?: { section?: boolean; header?: boolean } } | null
      if (d && d.type === 'dsh-store-auth' && typeof d.token === 'string' && d.token) {
        // 自动登录路径：doSetToken 内部负责全局横幅（登录中/成功/失败），不依赖抽屉是否打开。
        void doSetToken(d.token)
      }
      // 壳侧广播的放置位置能力清单(打包版不适配的位置会缺失/为 false)
      if (d && d.type === 'dsh-store-locs' && d.locs) {
        setStoreLocs(d.locs)
      }
    }
    window.addEventListener('message', onMsg)
    // 主动向壳侧询问能力清单(壳可能先于 iframe 就绪)
    try {
      window.parent.postMessage({ type: 'dsh-store-locs-query' }, '*')
    } catch {
      /* 顶层窗口时忽略 */
    }
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 登录结果横幅 5 秒后自动消失
  useEffect(() => {
    if (!authNotice) return
    const t = window.setTimeout(() => setAuthNotice(null), 5000)
    return () => window.clearTimeout(t)
  }, [authNotice])

  // 周期心跳：按服务端下发的 data_heartbeat_min（分钟）自动重拉数据，
  // 服务端插件库/版本推送/公告变化后无需手动刷新页面。
  useEffect(() => {
    if (!data || !data.heartbeatMin) return
    const timer = window.setInterval(() => {
      void props.bridge.refresh().then(applyState)
    }, data.heartbeatMin * 60000)
    return () => window.clearInterval(timer)
  }, [data?.heartbeatMin, props.bridge])

  // 视口变化时重新约束窗口，避免小窗口/旋转屏幕后面板跑到可视区外。
  useEffect(() => {
    const onResize = () => setGeo((g) => fitGeo(g, window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 面板拖动/缩放统一挂 window：指针移出面板或松开位置不准确也不会中断。
  useEffect(() => {
    if (!drag) return
    const onMove = (e: globalThis.MouseEvent) => {
      const dx = e.clientX - drag.mx
      const dy = e.clientY - drag.my
      const base: Geo = { r: drag.r, b: drag.b, w: drag.w, h: drag.h }
      let next: Geo
      if (drag.kind === 'move') {
        next = { ...base, r: base.r - dx, b: base.b - dy }
      } else if (drag.kind === 'br') {
        next = { r: base.r - dx, b: base.b - dy, w: base.w + dx, h: base.h + dy }
      } else if (drag.kind === 'bl') {
        next = { r: base.r, b: base.b - dy, w: base.w - dx, h: base.h + dy }
      } else if (drag.kind === 'tr') {
        next = { r: base.r - dx, b: base.b, w: base.w + dx, h: base.h - dy }
      } else {
        next = { r: base.r, b: base.b, w: base.w - dx, h: base.h - dy }
      }
      setGeo(fitGeo(next, window.innerWidth, window.innerHeight))
    }
    const onUp = () => setDrag(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag])

  // Esc 逐层关闭：弹窗/侧栏 → 悬浮面板（非嵌入模式）。
  useEffect(() => {
    if (props.embedded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (zoomed) setZoomed(null)
      else if (publish) setPublish(false)
      else if (acct) setAcct(false)
      else if (drawer) setDrawer(false)
      else setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.embedded, zoomed, publish, acct, drawer])

  // ⚠️ Hooks 必须无条件调用（Rules of Hooks）：data 未就绪时用空数组占位，
  // 骨架分支在下方 return，不能放在任何 hook 之前。
  const plugins = useMemo(() => (data ? data.plugins.filter((p) => p.kind !== 'preset') : []), [data])
  const agents = useMemo(() => (data ? data.plugins.filter((p) => p.kind === 'preset') : []), [data])
  // 功能开关(管理端配置中心):趋势榜/组合/公告,关掉后对应 UI 隐藏(真实门控)
  const features = data?.features ?? { trending: true, combos: true, announcements: true }
  const trending = useMemo(() => (features.trending ? topTrending(plugins, data?.trendingSize ?? 20) : []), [features.trending, plugins, data?.trendingSize])
  const results = useMemo(
    () => sortPlugins(searchPlugins(plugins, debouncedQuery), sort),
    [plugins, debouncedQuery, sort],
  )
  const updateCount = useMemo(
    () => plugins.filter((p) => hasUpdate(p, installed) && acked[p.id] !== p.version).length,
    [plugins, installed, acked],
  )

  // ⚠️ 骨架分支不能提前 return：组件函数体内后续的所有 const 函数定义
  // (doInstall/doSetToken/doLike…) 若被提前 return 跳过，将被 message 监听等
  // 闭包引用时触发 TDZ（Cannot access before initialization）——自动登录会静默失败。
  // 因此骨架 return 放在组件函数最末尾（所有定义之后）。
  // 插件与 Agent 分页：Plugin 页展示 kind=plugin（含双形态），Agent 页展示 kind=preset。
  // 更新判断以真实安装版本为准（host /version RPC，回落构建注入版本）
  const clientUpdate =
    data?.clientPlugin &&
    isUpdateAvailable(data.clientVersion ?? CLIENT_PLUGIN_VERSION, data.clientPlugin.version) &&
    ignoredClientVersion !== data.clientPlugin.version
      ? data.clientPlugin
      : null

  const beginDrag = (kind: 'move' | 'tl' | 'tr' | 'bl' | 'br', e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ kind, mx: e.clientX, my: e.clientY, r: geo.r, b: geo.b, w: geo.w, h: geo.h })
  }

  /** 本地台账/订阅变化后，把最新云端清单同步回「我的」界面。 */
  const refreshCloud = () => void props.bridge.pushCloud().then(setCloud)

  /** 安装前须知：未勾选"不再提醒"时先弹窗，确认后执行安装动作。 */
  const INSTALL_NOTICE_KEY = 'dsh_store_install_notice'
  const beginInstall = (repoUrl: string | undefined, action: () => void) => {
    try {
      if (localStorage.getItem(INSTALL_NOTICE_KEY) === '1') {
        action()
        return
      }
    } catch {
      /* localStorage 不可用时直接放行 */
    }
    setInstallNotice({ repoUrl, proceed: action })
  }

  /** 执行安装类操作并标记按钮"安装中…"（无论成功/失败都清除标记）。 */
  const runInstalling = <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    setInstalling((prev) => ({ ...prev, [key]: true }))
    return fn().finally(() => {
      setInstalling((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    })
  }

  const doInstall = (pkg: string) => {
    const p = plugins.find((x) => x.id === pkg)
    beginInstall(p?.repo_url, () =>
      void runInstalling(pkg, () => props.bridge.install(pkg)).then((r) => {
        setInstalled(r)
        if (loggedIn) refreshCloud()
      }).catch(function (e) { window.alert(String((e && e.message) || e)) }),
    )
  }
  const doInstallPreset = (pkg: string, presetName?: string) => {
    const p = plugins.find((x) => x.id === pkg)
    beginInstall(p?.repo_url, () =>
      void runInstalling(pkg, () => props.bridge.installPreset(pkg, presetName)).then((r) => {
        setInstalled(r)
        if (loggedIn) refreshCloud()
      }).catch(function (e) { window.alert(String((e && e.message) || e)) }),
    )
  }
  const doUninstall = (pkg: string) =>
    void props.bridge.uninstall(pkg).then((r) => {
      setInstalled(r)
      if (loggedIn) refreshCloud()
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doUpdate = (pkg: string) =>
    void runInstalling(pkg, () => props.bridge.update(pkg)).then((r) => {
      setInstalled(r)
      if (loggedIn) refreshCloud()
      void props.bridge.ackUpdate(pkg).then(setAcked)
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doInstallCombo = (name: string) =>
    beginInstall(undefined, () =>
      void runInstalling('combo:' + name, () => props.bridge.installCombo(name)).then((r) => {
        setInstalled(r.installed)
        setSubscriptions(r.subscriptions)
        if (r.manual && r.manual.length > 0) {
          // 手动安装成员：自动装的部分已完成,弹窗逐个打开插件页面
          setManualList(r.manual)
        }
        if (loggedIn) refreshCloud()
      }).catch(function (e) { window.alert(String((e && e.message) || e)) }),
    )
  const doUnsubscribe = (name: string) =>
    void props.bridge.unsubscribe(name).then((r) => {
      setSubscriptions(r.subscriptions)
      if (loggedIn) refreshCloud()
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doRemoveAnno = (id: string) => void props.bridge.removeAnnouncement(id).then(setAnnouncements)
  /** 切换商城放置位置(设置页/会话头部；悬浮球已移除)：写 localStorage + 通知壳侧即时生效。 */
  const doSetLoc = (key: 'section' | 'header', on: boolean) => {
    try {
      localStorage.setItem('dsh_store_loc_' + key, on ? '1' : '0')
    } catch {
      /* 持久化失败不影响本次会话 */
    }
    try {
      window.parent.postMessage({ type: 'dsh-store-loc-change', key, on }, '*')
    } catch {
      /* 顶层窗口时忽略 */
    }
  }
  /* 点赞功能已取消：客户端无入口,服务端 /api/v1/likes 由 feature.likes 门控(旧客户端兼容)。 */
  const doAddCombo = (name: string, desc: string, members: ComboMemberInput[]) =>
    void props.bridge.addCombo(name, desc, members).then((cs) => {
      setCombos(cs)
      void props.bridge.refreshCombos().then(applyState)
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doUpdateCombo = (id: string, name: string, desc: string, members: ComboMemberInput[]) =>
    void props.bridge.updateCombo(id, name, desc, members).then((cs) => {
      setCombos(cs)
      void props.bridge.refreshCombos().then(applyState)
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doRemoveCombo = (id: string) =>
    void props.bridge.removeCombo(id).then((cs) => {
      setCombos(cs)
      void props.bridge.refreshCombos().then(applyState)
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doReport = (pkg: string, repoUrl: string | null, version: string) =>
    props.bridge.reportMissing(pkg, repoUrl, version)
  const doClientUpdate = (spec: string, version: string) =>
    props.bridge.updateClientPlugin(spec, version)
  const doDeleteAccount = (combos: 'delete' | 'anonymize') =>
    props.bridge.deleteAccount(combos).then(async (r) => {
      if (r.ok) {
        setLoggedIn(false)
        setAuthUser(null)
        await props.bridge.bootstrap().then(applyState)
      }
      return r
    })
  const doRestorePlugins = (plugins: string[]) =>
    void runInstalling('restore', () => props.bridge.restorePlugins(plugins)).then((r) => {
      setInstalled(r.installed)
      setSubscriptions(r.subscriptions)
      if (loggedIn) refreshCloud()
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doRestoreSubs = (combos: string[]) =>
    void runInstalling('restore', () => props.bridge.restoreSubscriptions(combos)).then((r) => {
      setInstalled(r.installed)
      setSubscriptions(r.subscriptions)
      if (loggedIn) refreshCloud()
    }).catch(function (e) { window.alert(String((e && e.message) || e)) })
  const doAckAll = () => void props.bridge.ackAll().then(setAcked)
  const doAddSource = (url: string, password: string) => props.bridge.addSource(url, password).then(setSources)
  const doRemoveSource = (id: string) => void props.bridge.removeSource(id).then(setSources)
  const doPingSource = (id: string) => props.bridge.pingSource(id).then(setSources)
  const doSwitchSource = (id: string) =>
    void props.bridge.switchSource(id).then((s) => {
      applyState(s)
      if (s.account.login) refreshCloud()
    })
  const doSetToken = async (token: string): Promise<{ ok: boolean; message: string }> => {
    const t = (token || '').trim()
    if (!t) return { ok: false, message: '请先粘贴 GitHub 授权页返回的 token' }
    setAuthBusy(true)
    try {
      if (props.tokenStore) props.tokenStore.current = t
      const s = await props.bridge.refresh()
      applyState(s)
      if (!s.account.login) {
        // token 已写入本地：若服务器确认无效（401）bridge 会自动清 token；
        // 这里不再主动清，避免服务器暂时不可达时误删登录凭证。
        setAuthNotice({ ok: false, msg: '登录尚未生效：服务器暂时不可达或 token 无效。token 已保留，连接恢复后自动登录；若持续失败请重新授权' })
        return { ok: false, message: '登录尚未生效：token 已保留，连接恢复后自动重试' }
      }
      setAuthNotice({ ok: true, msg: `✅ 已通过 GitHub 登录：${s.account.login}，云端清单已加载` })
      return { ok: true, message: `已通过 GitHub 登录：${s.account.login}，云端清单已加载` }
    } catch (e) {
      // 网络/同步异常：保留已写入的 token（下次打开商城会自动重试登录），仅提示本次失败。
      const msg = e instanceof Error ? e.message : String(e)
      setAuthNotice({ ok: false, msg: `登录失败：${msg}。token 已保留，稍后会自动重试；也可重新授权` })
      return { ok: false, message: `登录失败：${msg}` }
    } finally {
      setAuthBusy(false)
    }
  }
  const doLogout = () => {
    if (props.tokenStore) props.tokenStore.current = null
    setLoggedIn(false)
    setAuthUser(null)
    setCloud({ plugins: [], combos: [] })
    void props.bridge.bootstrap().then(applyState)
  }
  const doPushCloud = async () => {
    const c = await props.bridge.pushCloud()
    setCloud(c)
    return c
  }
  const doRefreshCloud = async () => {
    const s = await props.bridge.refresh()
    applyState(s)
    return s.cloud
  }

  const body =
    tab === 'plugin' ? (
      <SearchView trending={trending} results={results} query={debouncedQuery} installed={installed} sort={sort} loggedIn={loggedIn} installing={installing} onSort={setSort} onInstall={doInstall} onInstallPreset={doInstallPreset} onUpdate={doUpdate} onPublish={() => setPublish(true)} onOpenAccount={() => setAcct(true)} />
    ) : tab === 'combo' ? (
      <ComboView
        combos={combos}
        plugins={plugins}
        subscriptions={subscriptions}
        installed={installed}
        loggedIn={loggedIn}
        myLogin={authUser?.login || account?.login || ''}
        query={debouncedQuery}
        installing={installing}
        onLogin={() => setAcct(true)}
        onInstallCombo={doInstallCombo}
        onInstallPlugin={doInstall}
        onAddCombo={doAddCombo}
        onUpdateCombo={doUpdateCombo}
        onRemoveCombo={doRemoveCombo}
        reviewEnabled={data ? data.comboReviewEnabled !== false : true}
      />
    ) : tab === 'agent' ? (
      <AgentView agents={agents} installed={installed} query={debouncedQuery} installing={installing} onInstallPreset={doInstallPreset} />
    ) : tab === 'my' ? (
      <MyView
        plugins={plugins}
        installed={installed}
        acked={acked}
        cloud={cloud}
        installing={installing}
        onPushCloud={doPushCloud}
        onRefreshCloud={doRefreshCloud}
        onRestorePlugins={doRestorePlugins}
        onUpdate={doUpdate}
        onUninstall={doUninstall}
        onAckAll={doAckAll}
      />
    ) : tab === 'sub' ? (
      <SubscribeView
        combos={combos}
        subscriptions={subscriptions}
        installed={installed}
        plugins={plugins}
        cloud={cloud}
        installing={installing}
        onInstallCombo={doInstallCombo}
        onInstallPlugin={doInstall}
        onUpdate={doUpdate}
        onUnsubscribe={doUnsubscribe}
        onPushCloud={doPushCloud}
        onRefreshCloud={doRefreshCloud}
        onRestoreSubs={doRestoreSubs}
      />
    ) : (
      <AgentLibraryView
        agents={agents}
        installed={installed}
        installing={installing}
        onInstallPreset={doInstallPreset}
        onUninstall={doUninstall}
        onGoMarket={() => setTab('agent')}
      />
    )

  const tabBtns = (['plugin', 'combo', 'agent', 'my', 'sub', 'agentLib'] as Tab[])
    .filter((k) => !(k === 'combo' || k === 'sub') || features.combos)
    .map((k) => (
      <button
        key={k}
        className={tab === k ? 'on' : ''}
        onClick={() => {
          setTab(k)
          // 组合在线模式：进入组合/组合库页即向服务器拉取组合全量（覆盖本地缓存）
          if (k === 'combo' || k === 'sub') void props.bridge.refreshCombos().then(applyState)
        }}
      >
        {k === 'plugin' ? '插件' : k === 'combo' ? '组合' : k === 'agent' ? 'Agent' : k === 'my' ? '插件库' : k === 'sub' ? '组合库' : 'Agent库'}
      </button>
    ))

  const panelKids = [
    <TopBar
      key="top"
      query={query}
      onQuery={setQuery}
      theme={theme}
      onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      onDrawer={() => { setDrawer(true); setRead(true) }}
      onAccount={() => setAcct(true)}
      unread={!read}
      onDragStart={props.embedded ? (e) => { e.preventDefault() } : (e) => beginDrag('move', e)}
    />,
    clientUpdate ? (
      <div key="cbanner" className="dshs-cbanner">
        <span className="dshs-cbanner-text" onClick={() => setAcct(true)}>
          🆕 客户端插件有新版本 <b>v{clientUpdate.version}</b>
        </span>
        <span className="dshs-cbanner-actions">
          <button className="dshs-ibtn" onClick={() => setAcct(true)}>点击更新</button>
          <button
            className="dshs-abtn"
            onClick={() => {
              const v = clientUpdate.version
              if (props.clientIgnoreStore) props.clientIgnoreStore.current = v
              setIgnoredClientVersion(v)
            }}
          >
            忽略该版本
          </button>
        </span>
      </div>
    ) : null,
    authBusy ? (
      <div key="authbusy" className="dshs-cbanner" style={{ borderLeftColor: 'var(--brand2)' }}>
        <span className="dshs-cbanner-text">⏳ 正在登录 GitHub…正在同步云端清单与点赞状态，首次可能需要几十秒，请稍候</span>
      </div>
    ) : null,
    authNotice ? (
      <div key="authnotice" className="dshs-cbanner" style={{ borderLeftColor: authNotice.ok ? 'var(--brand2)' : 'var(--danger)' }}>
        <span className="dshs-cbanner-text">{authNotice.msg}</span>
      </div>
    ) : null,
    <div className="dshs-tabs" key="tabs">{tabBtns}</div>,
    <div className="dshs-body" key="body">{body}</div>,
    drawer ? (
      <Drawer key="drawer" announcements={features.announcements ? announcements : []} onClose={() => setDrawer(false)} onZoom={setZoomed} onRemove={doRemoveAnno} />
    ) : null,
    acct ? (
      <AccountDrawer
        key="acct"
        loggedIn={loggedIn}
        account={account}
        sources={sources}
        authUser={authUser}
        authBusy={authBusy}
        authNotice={authNotice}
        storeLocs={storeLocs}
        onSetLoc={doSetLoc}
        serverUrl={serverUrl || props.serverUrl}
        heartbeatMin={data?.heartbeatMin ?? 30}
        clientVersion={data?.clientVersion ?? CLIENT_PLUGIN_VERSION}
        clientUpdate={clientUpdate}
        onClose={() => setAcct(false)}
        onLogout={doLogout}
        onAddSource={doAddSource}
        onRemoveSource={doRemoveSource}
        onPingSource={doPingSource}
        onSwitchSource={doSwitchSource}
        onClientUpdate={doClientUpdate}
        onDeleteAccount={doDeleteAccount}
      />
    ) : null,
  ]

  const rootKids = [
    props.embedded ? null : <Fab key="fab" pos={pos} onMove={setPos} onToggle={() => setOpen(!open)} badge={{ announcement: !read, count: updateCount }} />,
    props.embedded
      ? <div className="dshs-panel embed" key="panel">{panelKids}</div>
      : open ? <StorePanel key="panel" geo={geo} onBegin={beginDrag}>{panelKids}</StorePanel> : null,
    zoomed ? <ZoomModal key="zoom" a={zoomed} onClose={() => setZoomed(null)} /> : null,
    publish ? <PublishPluginView key="publish" loggedIn={loggedIn} plugins={plugins} onClose={() => setPublish(false)} onLogin={() => setAcct(true)} onReport={doReport} /> : null,
    installNotice ? (
      <InstallNoticeModal
        key="notice"
        repoUrl={installNotice.repoUrl}
        onConfirm={(neverAgain) => {
          if (neverAgain) {
            try {
              localStorage.setItem(INSTALL_NOTICE_KEY, '1')
            } catch {
              /* 持久化失败不影响本次 */
            }
          }
          const proceed = installNotice.proceed
          setInstallNotice(null)
          proceed()
        }}
        onCancel={() => setInstallNotice(null)}
      />
    ) : null,
    // 手动安装成员弹窗：组合中标记 ✋ 手动的插件逐个打开页面安装
    manualList && manualList.length > 0 ? (
      <div key="manual" className="dshs-modal" onClick={() => setManualList(null)}>
        <div className="dshs-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="t">
            🤲 需要手动安装的插件
            <button onClick={() => setManualList(null)}>✕</button>
          </div>
          <div className="c">
            <div className="dshs-subnote" style={{ marginBottom: 8 }}>
              组内其他插件已自动安装完成。以下插件在组合中标记为<strong>手动安装</strong>，请逐个打开插件页面按说明安装，装完回到「插件库」确认。
            </div>
            {manualList.map((m) => (
              <div className="dshs-mem" key={m.pkg}>
                <span className="dshs-nm" style={{ fontWeight: 600 }}>{m.name}</span>
                <span className="dshs-compat">{m.pkg}</span>
                <a className="dshs-abtn" href={m.url} target="_blank" rel="noopener noreferrer">打开页面 ↗</a>
              </div>
            ))}
          </div>
          <div className="dshs-modal-foot">
            <button className="dshs-ibtn" onClick={() => setManualList(null)}>我知道了</button>
          </div>
        </div>
      </div>
    ) : null,
  ]

  // 数据未就绪（首次加载/后台同步中）：显示界面骨架，不黑屏、不整页等待。
  // ⚠️ 必须放在组件函数最末尾：提前 return 会让上方所有 const 函数定义（含
  // doSetToken）在骨架态渲染中被跳过，message 监听闭包访问时触发 TDZ 错误，
  // 导致 GitHub 自动登录静默失败。
  if (!data) {
    // 骨架态也显示登录横幅：授权回传的自动登录可能在首次同步期间发生，
    // 此时面板未就绪，横幅是唯一可见的登录反馈（doSetToken 已定义，不会 TDZ）。
    const skeleton = [
      authBusy ? (
        <div key="authbusy" className="dshs-cbanner" style={{ borderLeftColor: 'var(--brand2)' }}>
          <span className="dshs-cbanner-text">⏳ 正在登录 GitHub…正在同步云端清单与点赞状态，首次可能需要几十秒，请稍候</span>
        </div>
      ) : null,
      authNotice ? (
        <div key="authnotice" className="dshs-cbanner" style={{ borderLeftColor: authNotice.ok ? 'var(--brand2)' : 'var(--danger)' }}>
          <span className="dshs-cbanner-text">{authNotice.msg}</span>
        </div>
      ) : null,
      <div className="dshs-body" key="skeleton">
        <div className="dshs-sec">
          🔄 正在同步插件库
          <span>首次拉取可能需要几十秒，完成后自动显示</span>
        </div>
        <div className="dshs-empty">
          <div style={{ fontSize: 26, marginBottom: 8 }}>🧩</div>
          正在连接 DSH 商店服务器…
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--tx2)' }}>
            数据已在本机缓存时立即显示；同步在后台进行，之后打开面板不再重复全量拉取
          </div>
        </div>
      </div>,
    ]
    const kids = [
      props.embedded
        ? null
        : <Fab key="fab" pos={pos} onMove={setPos} onToggle={() => setOpen(!open)} badge={{ announcement: false, count: 0 }} />,
      props.embedded ? (
        <div className="dshs-panel embed" key="panel">{skeleton}</div>
      ) : open ? (
        <StorePanel key="panel" geo={geo} onBegin={() => {}}>{skeleton}</StorePanel>
      ) : null,
    ]
    return <div className="dshs-root" data-theme={theme}>{kids}</div>
  }

  return <div className="dshs-root" data-theme={theme}>{rootKids}</div>
}
