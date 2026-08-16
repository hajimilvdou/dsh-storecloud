/* 客户端半验证：在 Node 里模拟 client-modules 环境（window/document/localStorage 垫片 +
 * 捕获 __ModuleLoader__.load 的 factory），用真实 ReactDOMServer 渲染三个槽位组件，
 * 确认手写 ReactElement 与类组件能被宿主 React 正常渲染。 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const React = require('react')
const { renderToString } = require('react-dom/server')

let captured = null
const listeners = {}
global.window = {
  location: { origin: 'http://dsh.test' },
  addEventListener: (k, fn) => { (listeners[k] ||= []).push(fn) },
  removeEventListener: (k, fn) => { listeners[k] = (listeners[k] || []).filter((f) => f !== fn) },
  innerWidth: 1280,
  innerHeight: 800,
}
global.document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  createElement: () => ({ appendChild() {}, remove() {} }),
  createTextNode: () => ({}),
  head: { appendChild() {} },
  body: {},
}
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
global.MutationObserver = class { observe() {} disconnect() {} }
const moduleLoader = { load: (h) => { captured = h } }
global.window.__ModuleLoader__ = moduleLoader
global.__ModuleLoader__ = moduleLoader

const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
eval(code)
if (!captured) { console.error('FAIL: __ModuleLoader__.load 未被调用'); process.exit(1) }
if (captured.id !== 'dsh-storecloud') { console.error('FAIL: id != dsh-storecloud ->', captured.id); process.exit(1) }

const mod = captured.factory(function (spec) { throw new Error('unexpected require: ' + spec) })
if (!mod || typeof mod.apply !== 'function') { console.error('FAIL: factory 未导出 apply'); process.exit(1) }
if (!Array.isArray(mod.inject) || mod.inject.indexOf('slots') < 0) { console.error('FAIL: inject 缺 slots'); process.exit(1) }

// 假 slots 服务：捕获注册的组件
const registered = []
const fakeSlots = {
  register: (opts, comp) => { registered.push({ opts, comp }); return () => {} },
  inject: (_name, fn) => fn(),
}
const applied = mod.apply({ get: (k) => (k === 'slots' ? fakeSlots : undefined), effect: (fn) => fn() })

if (registered.length !== 3) { console.error('FAIL: 槽位注册数 != 3 ->', registered.length); process.exit(1) }
const kinds = registered.map((r) => r.opts.name).sort()
console.log('槽位注册:', kinds.join(', '))

// 逐一用真实 React 渲染（element form -> 宿主 React 渲染类组件）
for (const { opts, comp } of registered) {
  const html = renderToString(React.createElement(comp, { label: opts.label }))
  const ok = html.includes('iframe') || html.includes('plugin') || html.length > 0
  console.log(`渲染 ${opts.name} (${opts.id}): ${ok ? 'OK' : 'EMPTY'} len=${html.length}`)
  if (!ok) process.exit(1)
}
console.log('PASS: 客户端半可在宿主 React 下渲染')
