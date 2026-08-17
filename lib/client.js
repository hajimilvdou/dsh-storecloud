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

    // ---------------- 位置开关 / 自定义标题 / tab 排序（localStorage，同源 storage 事件联动） ----------------
    var locKeys = { section: 'dsh_store_loc_section', header: 'dsh_store_loc_header' }
    var locTitleKeys = { section: 'dsh_store_loc_title_section', header: 'dsh_store_loc_title_header' }
    var TAB_POS_KEY = 'dsh_store_loc_tab_pos'
    function locEnabled(key) {
      try { return localStorage.getItem(locKeys[key]) !== '0' } catch (e) { return true }
    }
    function setLocEnabled(key, on) {
      try { localStorage.setItem(locKeys[key], on ? '1' : '0') } catch (e) {}
    }
    // 入口标题：可自定义（防与其他插件标题撞名），默认「🧩 插件商城」。
    function locTitle(key) {
      try {
        var t = localStorage.getItem(locTitleKeys[key])
        if (t && t.trim()) return t.trim()
      } catch (e) {}
      return '🧩 插件商城'
    }
    function setLocTitle(key, title) {
      try { localStorage.setItem(locTitleKeys[key], (title || '').trim()) } catch (e) {}
      syncEntranceVisibility()
    }
    // 会话头部 tab 的拖动位置（0-based；-1/缺失 = 不接管排序，默认排最右）。
    function locTabPos() {
      try {
        var v = parseInt(localStorage.getItem(TAB_POS_KEY), 10)
        return (isNaN(v) || v < 0) ? -1 : v
      } catch (e) { return -1 }
    }
    function setLocTabPos(pos) {
      try {
        if (pos < 0) localStorage.removeItem(TAB_POS_KEY)
        else localStorage.setItem(TAB_POS_KEY, String(pos))
      } catch (e) {}
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
              var list = lists[i]
              var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'))
              var storeIdx = -1
              for (var j = 0; j < tabs.length; j++) {
                var txt = (tabs[j].innerText || '').trim()
                var isStore = tabs[j].getAttribute('data-dsh-store-ent') === '1' || txt.indexOf('插件商城') >= 0
                if (isStore) {
                  tabs[j].setAttribute('data-dsh-store-ent', '1')
                  storeIdx = j
                }
              }
              var storeTab = storeIdx >= 0 ? tabs[storeIdx] : null
              var pos = locTabPos()
              if (storeTab && pos >= 0) {
                // 用户拖过位置：接管整个 tablist 排序（商城插入第 pos 位）
                layoutTabs(list, pos)
              } else if (storeTab) {
                // 无持久化位置：默认排最右（不动其他 tab 的 order，避免覆盖别的插件排序）
                if (storeTab.style.order !== '99') storeTab.style.order = '99'
              }
              if (storeTab) bindStoreTabDrag(storeTab, list)
            }
            syncEntranceVisibility()
          } catch (e) {}
        })
        mo.observe(document.body, { childList: true, subtree: true })
      } catch (e) {}
    }
    // 按目标索引分配 order：商城 tab 插入第 storePos 位（CSS flex order 决定视觉顺序，不动 DOM）。
    function layoutTabs(list, storePos) {
      try {
        var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'))
        var storeIdx = -1
        for (var i = 0; i < tabs.length; i++) if (tabs[i].getAttribute('data-dsh-store-ent') === '1') storeIdx = i
        if (storeIdx < 0) return
        var storeTab = tabs[storeIdx]
        var others = []
        for (var j = 0; j < tabs.length; j++) if (j !== storeIdx) others.push(tabs[j])
        others.splice(Math.max(0, Math.min(storePos, others.length)), 0, storeTab)
        for (var m = 0; m < others.length; m++) {
          var want = String((m + 1) * 10)
          if (others[m].style.order !== want) others[m].style.order = want
        }
      } catch (e) {}
    }
    // 落点：按鼠标横坐标与各 tab 中心比较，得到商城应插入的索引。
    function dropPos(tabsAll, x) {
      try {
        var storeIdx = -1
        for (var i = 0; i < tabsAll.length; i++) if (tabsAll[i].getAttribute('data-dsh-store-ent') === '1') storeIdx = i
        var others = []
        for (var j = 0; j < tabsAll.length; j++) if (j !== storeIdx) others.push(tabsAll[j])
        var pos = others.length
        for (var k = 0; k < others.length; k++) {
          var r = others[k].getBoundingClientRect()
          if (x < r.left + r.width / 2) { pos = k; break }
        }
        return pos
      } catch (e) { return 0 }
    }
    // 拖拽绑定（商城 tab 可拖动到 tablist 任意位置，记忆到 localStorage）。
    function bindStoreTabDrag(tab, list) {
      try {
        var tabBound = tab.getAttribute('data-dsh-store-dnd') === '1'
        var listBound = list.getAttribute('data-dsh-store-dnd-list') === '1'
        if (tabBound && listBound) return
        if (!tabBound) {
          tab.setAttribute('data-dsh-store-dnd', '1')
          tab.setAttribute('draggable', 'true')
          tab.addEventListener('dragstart', function (e) {
            try {
              if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', 'dsh-store-tab')
                e.dataTransfer.effectAllowed = 'move'
              }
              tab.style.opacity = '0.5'
            } catch (err) {}
          })
          tab.addEventListener('dragend', function () {
            try {
              tab.style.opacity = ''
              var p = locTabPos()
              if (p >= 0) layoutTabs(list, p)
              else if (tab.style.order !== '99') tab.style.order = '99'
            } catch (err) {}
          })
        }
        if (!listBound) {
          list.setAttribute('data-dsh-store-dnd-list', '1')
          list.addEventListener('dragover', function (e) {
            try {
              if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.indexOf('text/plain') >= 0) e.preventDefault()
              var tabsAll = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'))
              layoutTabs(list, dropPos(tabsAll, e.clientX))
            } catch (err) {}
          })
          list.addEventListener('drop', function (e) {
            try {
              e.preventDefault()
              var tabsAll = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'))
              var pos = dropPos(tabsAll, e.clientX)
              setLocTabPos(pos)
              layoutTabs(list, pos)
            } catch (err) {}
          })
        }
      } catch (e) {}
    }
    // 入口可见性 + 标题联动：位置开关 → 入口隐藏/显示；自定义标题 → 入口文本同步替换。
    function syncEntranceVisibility() {
      try {
        var all = document.querySelectorAll('*')
        for (var i = 0; i < all.length; i++) {
          var el0 = all[i]
          if (el0.tagName === 'IFRAME') continue
          var marked = el0.getAttribute('data-dsh-store-ent') === '1'
          var matched = marked
          if (!matched) {
            var kids = el0.childNodes
            if (kids && kids.length) {
              for (var j = 0; j < kids.length; j++) {
                if (kids[j].nodeType === 3 && kids[j].nodeValue && kids[j].nodeValue.indexOf('插件商城') >= 0) { matched = true; break }
              }
            }
          }
          if (!matched) continue
          var isTab = el0.getAttribute('role') === 'tab'
          var target = el0
          if (!isTab && !marked) {
            var anc = el0
            for (var k = 0; k < 4 && anc; k++) {
              var rr = anc.getAttribute && anc.getAttribute('role')
              var tg = anc.tagName
              if (rr === 'button' || rr === 'tab' || tg === 'LI' || tg === 'BUTTON' || tg === 'A') { target = anc; break }
              anc = anc.parentElement
            }
            isTab = target.getAttribute('role') === 'tab'
          }
          if (target.getAttribute('data-dsh-store-ent') !== '1') target.setAttribute('data-dsh-store-ent', '1')
          applyTitleText(target, isTab)
          var on = locEnabled(isTab ? 'header' : 'section')
          var cur = target.getAttribute('data-dsh-store-vis')
          if (cur !== (on ? '1' : '0')) {
            target.setAttribute('data-dsh-store-vis', on ? '1' : '0')
            target.style.display = on ? '' : 'none'
          }
        }
      } catch (e) {}
    }
    // 标题文本替换：tab 直接改文本；设置页入口只替换最小文本节点（不动图标/描述）。
    // data-dsh-store-last-title 记录上次应用的标题，二次改名也能命中旧标题节点。
    function applyTitleText(target, isTab) {
      try {
        var want = isTab ? locTitle('header') : locTitle('section')
        if (isTab) {
          if ((target.innerText || '') !== want) target.innerText = want
          target.setAttribute('data-dsh-store-last-title', want)
          return
        }
        var last = target.getAttribute('data-dsh-store-last-title')
        var w = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
        var node = null
        while (w.nextNode()) {
          var v = (w.currentNode.nodeValue || '')
          if (last !== null) {
            if (v === last) { node = w.currentNode; break }
          } else if (v.indexOf('插件商城') >= 0) {
            node = w.currentNode
            if (v.trim().length < 20) break
          }
        }
        if (node) {
          node.nodeValue = want
          target.setAttribute('data-dsh-store-last-title', want)
        }
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
            var entry = slots.register({ name: 'settings.section', id: 'dsh-store', order: 2000, label: function () { return locTitle('section') } }, SectionEntry)
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
            var entry = slots.register({ name: 'conversation.view', id: 'dsh-store-view', priority: 100, order: 1000, label: function () { return locTitle('header') } }, StoreViewTab)
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
      // 商城 iframe 里的开关/标题切换 → 落盘并广播；iframe 挂载即发 query → 回广播能力清单
      var onMessage = function (e) {
        var d = (e.data || null)
        if (!d || typeof d !== 'object') return
        if (d.type === 'dsh-store-loc-change' && d.key && typeof d.on === 'boolean') {
          setLocEnabled(d.key, d.on)
          announceLocs()
        } else if (d.type === 'dsh-store-loc-title' && d.key) {
          setLocTitle(d.key, typeof d.title === 'string' ? d.title : '')
          announceLocs()
        } else if (d.type === 'dsh-store-locs-query') {
          announceLocs()
        }
      }
      // 同源 iframe 内 localStorage 变更会以 storage 事件广播到壳页：开关/标题/排序全部即时联动。
      var onStorageAny = function (e) {
        try {
          if (e.key && e.key.indexOf('dsh_store_loc_') === 0) syncEntranceVisibility()
        } catch (err) {}
      }
      window.addEventListener('storage', onStorageAny)
      window.addEventListener('message', onMessage)
      ctx.effect(function () {
        return function () {
          window.removeEventListener('message', onMessage)
          window.removeEventListener('storage', onStorageAny)
        }
      })
    }

    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
