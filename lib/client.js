/* dsh-storecloud · client 半（浏览器 cordis 插件）
 * =================================================
 * 通过标准 client-modules 通道加载（package.json dsh.client 声明 → /plugins/dsh-storecloud/client.js）。
 * 环境契约：经典脚本 + window.__ModuleLoader__.load({id, factory})；factory 只拿到同步 require，
 * 不保证 React 可达 —— 因此本文件零依赖：
 *   - 元素用手写 ReactElement（$$typeof = Symbol.for('react.element')，与宿主 React 同符号）；
 *   - 组件用类组件（生命周期由宿主 React 驱动，不依赖 ReactCurrentDispatcher）；
 *   - 状态用 setState，效果用 componentDidMount/WillUnmount。
 * 功能说明：设置页 section / 会话视图 tab 双入口 + 位置开关 + tab 排序修正 + 视图 CSS。
 * （悬浮球入口已移除：占位且使用率低；测试版本保留在 dsh-store-shell/shell-client.js）
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

    // ---------------- 位置开关（localStorage，同源 storage 事件联动） ----------------
    var locKeys = { section: 'dsh_store_loc_section', header: 'dsh_store_loc_header' }
    function locEnabled(key) {
      try { return localStorage.getItem(locKeys[key]) !== '0' } catch (e) { return true }
    }
    function setLocEnabled(key, on) {
      try { localStorage.setItem(locKeys[key], on ? '1' : '0') } catch (e) {}
    }
    var locState = { section: null, header: null }
    function announceLocs() {
      try {
        var locs = {}
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

    // ---------------- 位置 1：设置页 section ----------------
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
    // 两处槽位逐个 try/catch 注册：失败 = 该位置不适配，广播能力清单置灰。
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
