/* dsh-storecloud · client 半（浏览器 cordis 插件）
 * =================================================
 * 通过标准 client-modules 通道加载（package.json dsh.client 声明 → /plugins/dsh-storecloud/client.js）。
 * 环境契约：经典脚本 + window.__ModuleLoader__.load({id, factory})；factory 只拿到同步 require，
 * 不保证 React 可达 —— 因此本文件零依赖：
 *   - 元素用手写 ReactElement（$$typeof = Symbol.for('react.element')，与宿主 React 同符号）；
 *   - 组件用类组件（生命周期由宿主 React 驱动，不依赖 ReactCurrentDispatcher）；
 *   - 状态用 setState，效果用 componentDidMount/WillUnmount。
 * 功能与 dsh-store-shell/shell-client.js 完全一致：
 *   设置页 section / 悬浮球 overlay / 会话视图 tab 三入口 + 位置开关 + tab 排序修正 + 视图 CSS。
 */
window.__ModuleLoader__.load({
  id: 'dsh-storecloud',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    // ---------------- 手写 ReactElement（与宿主 React 同符号，可被其渲染） ----------------
    var REACT_ELEMENT_TYPE = (typeof Symbol === 'function' && Symbol.for) ? Symbol.for('react.element') : 0xeac7
    function el(type, props) {
      var rest = []
      for (var i = 2; i < arguments.length; i++) rest.push(arguments[i])
      var p = props || null
      if (rest.length) {
        p = p ? Object.assign({}, p) : {}
        p.children = rest.length === 1 ? rest[0] : rest
      }
      return { $$typeof: REACT_ELEMENT_TYPE, type: type, key: null, ref: null, props: p, _owner: null }
    }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

    // ---------------- 位置开关（localStorage，同源 storage 事件联动） ----------------
    var locKeys = { fab: 'dsh_store_loc_fab', section: 'dsh_store_loc_section', header: 'dsh_store_loc_header' }
    function locEnabled(key) {
      try { return localStorage.getItem(locKeys[key]) !== '0' } catch (e) { return true }
    }
    function setLocEnabled(key, on) {
      try { localStorage.setItem(locKeys[key], on ? '1' : '0') } catch (e) {}
    }
    var locState = { fab: null, section: null, header: null }
    function announceLocs() {
      try {
        var locs = {}
        if (locState.fab !== null) locs.fab = locState.fab
        if (locState.section !== null) locs.section = locState.section
        if (locState.header !== null) locs.header = locState.header
        var frames = Array.prototype.slice.call(document.querySelectorAll('iframe[title="DSH 插件商城"]'))
        for (var i = 0; i < frames.length; i++) {
          try { frames[i].contentWindow.postMessage({ type: 'dsh-store-locs', locs: locs }, '*') } catch (e) {}
        }
      } catch (e) {}
    }

    // ---------------- 统一 iframe（embed 模式） ----------------
    function storeIframe() {
      return el('iframe', {
        title: 'DSH 插件商城',
        src: window.location.origin + '/dsh-store/preview.html?embed=1&rpc=' + encodeURIComponent(window.location.origin + '/dsh-store/rpc'),
        style: { width: '100%', height: '100%', border: 'none', display: 'block', background: '#0b0e14' },
      })
    }

    // ---------------- 位置 1：悬浮球 ----------------
    var MARGIN = 8
    var ShellWidget = (function () {
      function ShellWidget(props) {
        var self = this
        this._drag = null
        this._onStorage = function (e) { if (e.key === locKeys.fab) self.setState({ enabled: locEnabled('fab') }) }
        this._onMove = function (e) { self._handleMove(e) }
        this._onUp = function () { self._detachDrag() }
        this.state = {
          open: (function () {
            try {
              var v = localStorage.getItem('dsh_store_shell_open')
              if (v === '1') return true
              if (v === '0') return false
            } catch (e) {}
            return true
          })(),
          geo: { r: 26, b: 80, w: 640, h: 640 },
          fab: { x: 26, y: 90 },
          enabled: locEnabled('fab'),
        }
      }
      ShellWidget.prototype.componentDidMount = function () {
        window.addEventListener('storage', this._onStorage)
      }
      ShellWidget.prototype.componentWillUnmount = function () {
        window.removeEventListener('storage', this._onStorage)
        this._detachDrag()
      }
      ShellWidget.prototype._fit = function (g) {
        var vw = window.innerWidth, vh = window.innerHeight
        var w0 = clamp(g.w, 360, Math.min(720, Math.max(360, vw - MARGIN * 2)))
        var h0 = clamp(g.h, 480, Math.min(900, Math.max(480, vh - MARGIN * 2)))
        var r = clamp(g.r, MARGIN, Math.max(MARGIN, vw - w0 - MARGIN))
        var b = clamp(g.b, MARGIN, Math.max(MARGIN, vh - h0 - MARGIN))
        var maxW = Math.max(360, vw - r - MARGIN)
        var maxH = Math.max(480, vh - b - MARGIN)
        return { r: r, b: b, w: clamp(g.w, 360, maxW), h: clamp(g.h, 480, maxH) }
      }
      ShellWidget.prototype._detachDrag = function () {
        if (!this._drag) return
        window.removeEventListener('mousemove', this._onMove)
        window.removeEventListener('mouseup', this._onUp)
        this._drag = null
      }
      ShellWidget.prototype._beginDrag = function (kind, e) {
        e.preventDefault()
        e.stopPropagation()
        this._detachDrag()
        var s = this.state
        this._drag = (kind === 'fab')
          ? { kind: kind, mx: e.clientX, my: e.clientY, x: s.fab.x, y: s.fab.y }
          : { kind: kind, mx: e.clientX, my: e.clientY, r: s.geo.r, b: s.geo.b, w: s.geo.w, h: s.geo.h }
        window.addEventListener('mousemove', this._onMove)
        window.addEventListener('mouseup', this._onUp)
      }
      ShellWidget.prototype._handleMove = function (e) {
        var d = this._drag
        if (!d) return
        var dx = e.clientX - d.mx
        var dy = e.clientY - d.my
        if (d.kind === 'fab') {
          var nx = clamp(d.x - dx, MARGIN, Math.max(MARGIN, window.innerWidth - 56 - MARGIN))
          var ny = clamp(d.y - dy, MARGIN, Math.max(MARGIN, window.innerHeight - 56 - MARGIN))
          this.setState({ fab: { x: nx, y: ny } })
          return
        }
        var base = { r: d.r, b: d.b, w: d.w, h: d.h }
        var next
        if (d.kind === 'move') next = { r: base.r - dx, b: base.b - dy, w: base.w, h: base.h }
        else if (d.kind === 'br') next = { r: base.r - dx, b: base.b - dy, w: base.w + dx, h: base.h + dy }
        else if (d.kind === 'bl') next = { r: base.r, b: base.b - dy, w: base.w - dx, h: base.h + dy }
        else if (d.kind === 'tr') next = { r: base.r - dx, b: base.b, w: base.w + dx, h: base.h - dy }
        else next = { r: base.r, b: base.b, w: base.w - dx, h: base.h - dy }
        this.setState({ geo: this._fit(next) })
      }
      ShellWidget.prototype._toggleOpen = function () {
        var next = !this.state.open
        this.setState({ open: next })
        try { localStorage.setItem('dsh_store_shell_open', next ? '1' : '0') } catch (e) {}
      }
      ShellWidget.prototype.render = function () {
        var self = this
        if (!this.state.enabled) return null
        var iframe = storeIframe()
        var handles = ['tl', 'tr', 'bl', 'br'].map(function (k) {
          var cursor = k === 'tl' || k === 'tr' ? 'nwse-resize' : 'nesw-resize'
          var style = { position: 'absolute', width: 18, height: 18, cursor: cursor, zIndex: 5 }
          if (k === 'tl') { style.left = 0; style.top = 0 }
          else if (k === 'tr') { style.right = 0; style.top = 0 }
          else if (k === 'bl') { style.left = 0; style.bottom = 0 }
          else { style.right = 0; style.bottom = 0 }
          return el('div', { key: k, style: style, onMouseDown: function (e) { self._beginDrag(k, e) } })
        })
        var geo = this.state.geo
        var fab = this.state.fab
        var panel = el('div', {
          style: {
            position: 'fixed', right: geo.r + 'px', bottom: geo.b + 'px',
            width: geo.w + 'px', height: geo.h + 'px',
            display: this.state.open ? 'flex' : 'none',
            flexDirection: 'column',
            background: '#0b0e14', border: '1px solid #2b3340', borderRadius: 18,
            boxShadow: '0 18px 50px rgba(0,0,0,.5)', overflow: 'hidden',
            pointerEvents: 'auto', zIndex: 2, color: '#e6edf3',
          },
        },
          el('div', {
            style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #2b3340', background: '#161b22', flex: 'none', cursor: 'move', userSelect: 'none' },
            onMouseDown: function (e) { self._beginDrag('move', e) },
          },
            el('span', { style: { fontWeight: 700, fontSize: 13 } }, '🧩 插件商城'),
            el('span', { style: { marginLeft: 'auto', fontSize: 11, color: '#8b98a5' } }, '拖动移动 · 四角缩放'),
            el('button', {
              style: { border: 'none', background: 'none', color: '#8b98a5', fontSize: 15, cursor: 'pointer', padding: '2px 6px' },
              onClick: function (e) { e.stopPropagation(); self._toggleOpen() },
            }, '✕'),
          ),
          el('div', { style: { flex: 1, minHeight: 0, position: 'relative' } }, iframe, handles),
        )
        var fabEl = el('div', {
          title: 'DSH 插件商城',
          style: {
            position: 'fixed', right: fab.x + 'px', bottom: fab.y + 'px',
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg,#6a5cff,#00c2a8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, cursor: 'grab', boxShadow: '0 6px 22px rgba(106,92,255,.45)',
            pointerEvents: 'auto', userSelect: 'none', zIndex: 3, color: '#fff',
          },
          onClick: function () { self._toggleOpen() },
          onMouseDown: function (e) { self._beginDrag('fab', e) },
        }, '🧩')
        return el('div', {
          style: {
            position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483000,
            fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          },
        }, fabEl, panel)
      }
      return ShellWidget
    })()
    // 宿主 React 依 isReactComponent 标记识别类组件（不依赖继承 React.Component）
    ShellWidget.prototype.isReactComponent = {}

    // ---------------- 位置 2：设置页 section ----------------
    var StoreSection = (function () {
      function StoreSection(props) {}
      StoreSection.prototype.render = function () {
        return el('div', {
          style: {
            width: '100%', height: '100%', minHeight: 480,
            background: '#0b0e14', position: 'relative', overflow: 'hidden', borderRadius: 16,
          },
        }, storeIframe())
      }
      return StoreSection
    })()
    StoreSection.prototype.isReactComponent = {}
    var SectionEntry = (function () {
      function SectionEntry(props) {
        var self = this
        this._onStorage = function (e) { if (e.key === locKeys.section) self.setState({ enabled: locEnabled('section') }) }
        this.state = { enabled: locEnabled('section') }
      }
      SectionEntry.prototype.componentDidMount = function () {
        window.addEventListener('storage', this._onStorage)
      }
      SectionEntry.prototype.componentWillUnmount = function () {
        window.removeEventListener('storage', this._onStorage)
      }
      SectionEntry.prototype.render = function () {
        if (!this.state.enabled) return null
        return el(StoreSection)
      }
      return SectionEntry
    })()
    SectionEntry.prototype.isReactComponent = {}

    // ---------------- 位置 3：会话视图 tab ----------------
    var STORE_VIEW_CSS_ID = 'dsh-store-view-css'
    function applyTabsFix() {
      try {
        if (window.__dshStoreTabsFix) return
        window.__dshStoreTabsFix = true
        var mo = new MutationObserver(function () {
          try {
            var lists = document.querySelectorAll('[role="tablist"]')
            for (var i = 0; i < lists.length; i++) {
              var tabs = lists[i].querySelectorAll('[role="tab"]')
              for (var j = 0; j < tabs.length; j++) {
                var txt = (tabs[j].innerText || '').trim()
                var isStore = txt.indexOf('插件商城') >= 0
                var want = isStore ? '99' : '0'
                if (tabs[j].style.order !== want) tabs[j].style.order = want
              }
            }
          } catch (e) {}
        })
        mo.observe(document.body, { childList: true, subtree: true })
      } catch (e) {}
    }
    function applyViewCss(on) {
      try {
        var el0 = document.getElementById(STORE_VIEW_CSS_ID)
        if (on && !el0) {
          var s = document.createElement('style')
          s.id = STORE_VIEW_CSS_ID
          s.textContent = '[data-composer-seat]{display:none!important}'
          document.head.appendChild(s)
        } else if (!on && el0) {
          el0.remove()
        }
      } catch (e) {}
    }
    var StoreViewTab = (function () {
      function StoreViewTab(props) {
        var self = this
        this._onStorage = function (e) { if (e.key === locKeys.header) self.setState({ enabled: locEnabled('header') }) }
        this.state = { enabled: locEnabled('header') }
      }
      StoreViewTab.prototype.componentDidMount = function () {
        window.addEventListener('storage', this._onStorage)
        if (this.state.enabled) applyViewCss(true)
      }
      StoreViewTab.prototype.componentDidUpdate = function (prevProps, prevState) {
        if (prevState.enabled === this.state.enabled) return
        applyViewCss(this.state.enabled)
      }
      StoreViewTab.prototype.componentWillUnmount = function () {
        window.removeEventListener('storage', this._onStorage)
        applyViewCss(false)
      }
      StoreViewTab.prototype.render = function () {
        if (!this.state.enabled) return null
        return el('div', {
          style: {
            width: '100%', height: '100%', minHeight: 480,
            background: '#0b0e14', position: 'relative', overflow: 'hidden', borderRadius: 14,
          },
        }, storeIframe())
      }
      return StoreViewTab
    })()
    StoreViewTab.prototype.isReactComponent = {}

    // ---------------- 插件体 ----------------
    // 三处槽位逐个 try/catch 注册：失败 = 该位置不适配，广播能力清单置灰。
    function apply(ctx) {
      var slots = ctx.get('slots')
      if (!slots) return
      applyTabsFix()
      ctx.effect(function () {
        return slots.inject('settings.section', function () {
          try {
            var entry = slots.register({ name: 'settings.section', id: 'dsh-store', order: 2000, label: function () { return '🧩 插件商城' } }, SectionEntry)
            locState.section = true
            announceLocs()
            return entry
          } catch (e) {
            console.error('[dsh-store] 位置注册失败(当前应用不适配): section', String((e && e.message) || e))
            locState.section = false
            announceLocs()
            return null
          }
        })
      })
      ctx.effect(function () {
        return slots.inject('shell.overlay', function () {
          try {
            var entry = slots.register({ name: 'shell.overlay', id: 'dsh-store-shell', order: 100, label: 'DSH 插件商城' }, ShellWidget)
            locState.fab = true
            announceLocs()
            return entry
          } catch (e) {
            console.error('[dsh-store] 位置注册失败(当前应用不适配): fab', String((e && e.message) || e))
            locState.fab = false
            announceLocs()
            return null
          }
        })
      })
      ctx.effect(function () {
        return slots.inject('conversation.view', function () {
          try {
            var entry = slots.register({ name: 'conversation.view', id: 'dsh-store-view', priority: 100, order: 1000, label: function () { return '🧩 插件商城' } }, StoreViewTab)
            locState.header = true
            announceLocs()
            return entry
          } catch (e) {
            console.error('[dsh-store] 位置注册失败(当前应用不适配): header', String((e && e.message) || e))
            locState.header = false
            announceLocs()
            return null
          }
        })
      })
      // 商城 iframe 里的开关切换 → 落盘并广播；iframe 挂载即发 query → 回广播能力清单
      var onMessage = function (e) {
        var d = (e.data || null)
        if (!d || typeof d !== 'object') return
        if (d.type === 'dsh-store-loc-change' && d.key && typeof d.on === 'boolean') {
          setLocEnabled(d.key, d.on)
          announceLocs()
        } else if (d.type === 'dsh-store-locs-query') {
          announceLocs()
        }
      }
      window.addEventListener('message', onMessage)
      ctx.effect(function () {
        return function () {
          window.removeEventListener('message', onMessage)
        }
      })
    }

    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
