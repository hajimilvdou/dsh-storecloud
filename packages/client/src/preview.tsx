import { Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreApp } from './ui/StoreApp.js'
import { httpBridge, mockBridge, type StoreBridge, type TokenStore } from './ui/bridge.js'
import type { KeyValueStore } from './store/ledger.js'
import { STORE_CSS } from './ui/styles.js'

/**
 * 错误边界：渲染异常不再黑屏——显示错误卡片 + 重新加载按钮（生产级健壮性）。
 */
class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null }
  static getDerivedStateFromError(e: unknown): { err: Error | null } {
    return { err: e instanceof Error ? e : new Error(String(e)) }
  }
  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#ff8b8b',
            fontSize: 13,
            background: '#0b0e14',
            padding: 18,
            fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          }}
        >
          <div style={{ fontSize: 30 }}>⚠️</div>
          <div>界面渲染异常：{String(this.state.err.message ?? this.state.err)}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '6px 18px',
              borderRadius: 8,
              border: '1px solid #3b9eff',
              background: 'rgba(59,158,255,.15)',
              color: '#9fd0ff',
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * 浏览器独立预览入口：
 * - 默认连接作者的服务器（?mode=demo 强制演示数据）；
 * - `?server=http://127.0.0.1:8080` 可临时指向本地/自建源；
 * - 登录 token、源密码、自定义源清单与数据缓存保存在 localStorage；
 * - 界面立即渲染（本地缓存秒开/空态骨架），全量/增量同步在后台进行。
 */
const DEFAULT_SOURCE = 'https://blog.1qwq1.top'
const TOKEN_KEY = 'dsh_store_token'
const PASS_KEY = 'dsh_store_pass'
const SERVER_KEY = 'dsh_store_server'
const CLIENT_IGNORE_KEY = 'dsh_store_ignored_client_version'

function currentServer(): string {
  const params = new URLSearchParams(window.location.search)
  const fromQuery = params.get('server')?.trim() ?? ''
  if (fromQuery) {
    localStorage.setItem(SERVER_KEY, fromQuery)
    return fromQuery
  }
  return localStorage.getItem(SERVER_KEY) || DEFAULT_SOURCE
}

const tokenStore: TokenStore = {
  get current(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },
  set current(v: string | null) {
    if (v) localStorage.setItem(TOKEN_KEY, v)
    else localStorage.removeItem(TOKEN_KEY)
  },
}

const clientIgnoreStore: TokenStore = {
  get current(): string | null {
    return localStorage.getItem(CLIENT_IGNORE_KEY)
  },
  set current(v: string | null) {
    if (v) localStorage.setItem(CLIENT_IGNORE_KEY, v)
    else localStorage.removeItem(CLIENT_IGNORE_KEY)
  },
}

const sourceStore: KeyValueStore = {
  get: async (k) => localStorage.getItem(k),
  set: async (k, v) => localStorage.setItem(k, v),
  remove: async (k) => localStorage.removeItem(k),
}

async function pickBridge(): Promise<{ bridge: StoreBridge; banner: string | null }> {
  const server = currentServer()
  const rpcBase = new URLSearchParams(window.location.search).get('rpc')?.trim() ?? ''
  const demoMode = new URLSearchParams(window.location.search).get('mode') === 'demo'
  if (demoMode) {
    return { bridge: mockBridge(), banner: '演示数据模式：当前展示本地示例数据，可在右上角「我的」体验登录 / 云端同步 / 服务器源。' }
  }
  const live = httpBridge({
    baseUrl: server,
    tokenStore,
    accessPassword: server === DEFAULT_SOURCE ? localStorage.getItem(PASS_KEY) ?? '' : '',
    sourceStore,
    rpcBase,
  })
  // bootstrap 立即返回（本地缓存秒开 / 空态），全量同步在后台进行；
  // 无缓存且源未连接时给一条顶部提示（界面骨架照常渲染，不整页等待）。
  const state = await live.bootstrap()
  const offline = state.plugins.length === 0 && state.combos.length === 0 && state.sources.every((s) => s.status === 'unreachable')
  if (!offline) return { bridge: live, banner: null }
  return {
    bridge: live,
    banner: `正在连接 ${server}…首次同步插件库可能需要几十秒，请稍候（之后打开面板直接使用本地缓存，不再重复全量拉取）。`,
  }
}

async function boot() {
  const embed = new URLSearchParams(window.location.search).get('embed') === '1'
  const root = document.getElementById('root')
  if (!root) return
  const reactRoot = createRoot(root)

  let picked
  try {
    picked = await pickBridge()
  } catch (e) {
    reactRoot.render(
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#ff8b8b',
          fontSize: 13,
          background: '#0b0e14',
          padding: 18,
          fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
        }}
      >
        <div style={{ fontSize: 30 }}>⚠️</div>
        <div>商店初始化失败：{String((e as Error)?.message ?? e)}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: '6px 18px',
            borderRadius: 8,
            border: '1px solid #3b9eff',
            background: 'rgba(59,158,255,.15)',
            color: '#9fd0ff',
            cursor: 'pointer',
          }}
        >
          重新加载
        </button>
      </div>,
    )
    return
  }

  const style = document.createElement('style')
  style.textContent = STORE_CSS
  document.head.appendChild(style)

  reactRoot.render(
    <Boundary>
      {picked.banner ? (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            padding: '7px 12px',
            fontSize: 12,
            textAlign: 'center',
            color: '#ffd27d',
            background: 'rgba(92, 58, 0, .92)',
            borderBottom: '1px solid rgba(245,166,35,.5)',
          }}
        >
          {picked.banner}
        </div>
      ) : null}
      <StoreApp
        bridge={picked.bridge}
        tokenStore={tokenStore}
        clientIgnoreStore={clientIgnoreStore}
        serverUrl={currentServer()}
        embedded={embed}
      />
    </Boundary>,
  )
}

void boot()
