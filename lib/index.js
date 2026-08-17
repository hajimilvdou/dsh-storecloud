'use strict'
/**
 * dsh-storecloud · host 半（Node 侧 cordis 插件）
 * ===============================================
 * 职责：
 *   1. 从包内 preview/ 目录提供 /dsh-store/preview.html + /dsh-store/preview.js（商城 UI 静态资源）；
 *   2. /dsh-store/auth/* —— OAuth 登录跳转与回调转发（跳转到配置的服务器）；
 *   3. /dsh-store/api/* + /dsh-store/health —— 反向代理到商店服务器（转发认证/访问口令/匿名凭证头）；
 *   4. /dsh-store/http —— 页面内通用 HTTP 转发（带 SSRF 防护）；
 *   5. /dsh-store/rpc/* —— 本地安装器：dsh plugin add/remove、Agent 预设安装/卸载、真实已装清单。
 *
 * 配置（cordis.patch.yml 中 id: dsh-storecloud 的 config，全部可选）：
 *   serverUrl   商店服务器根地址（默认 = 作者的服务器；可用 ?server= 在页面上临时切换）
 *   dshHome     DSH 家目录（默认 $DSH_HOME 或 ~/.dsh）
 *   profileName 目标 profile（默认 web）
 *   cacheTtlMs  静态资源缓存 TTL（默认 10000）
 *
 * 本文件不包含任何机器相关路径；DSH 家目录/CLI 路径全部运行时探测。
 */
const path = require('node:path')
const os = require('node:os')
const fsNode = require('node:fs')

const PACKAGE_ROOT = path.join(__dirname, '..')
const PREVIEW_DIR = path.join(PACKAGE_ROOT, 'preview')

function apply(ctx, config) {
  const ws = ctx.get('webServer')
  const shell = ctx.get('shell')
  if (ws === undefined) return
  const cfg = (config && typeof config === 'object') ? config : {}
  const REMOTE = String(cfg.serverUrl || process.env.DSH_STORE_SERVER_URL || 'https://blog.1qwq1.top').replace(/\/+$/, '')
  const DSH_HOME = String(cfg.dshHome || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')).replace(/[\\/]+$/, '')
  const PROFILE = String(cfg.profileName || 'web')
  const CACHE_TTL = Number(cfg.cacheTtlMs || 10000)

  // CLI 位置探测：优先 profile 装配目录，缺失时回退 PATH 上的 dsh 命令。
  const DSH_BIN = path.join(DSH_HOME, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const USE_DSH_BIN = fsNode.existsSync(DSH_BIN)

  // 沙箱工作区根（仅供 shell 任务声明 workspaceRoot；拿不到就不声明）。
  let wsRoot = ''
  try {
    const sp = ctx.get('sandboxPolicy')
    if (sp && sp.workspaceRoot) wsRoot = String(sp.workspaceRoot)
  } catch (e) {}

  // ---------------- 静态资源（包内 preview/，10s TTL 内存缓存） ----------------
  const fileCache = new Map()
  function serveText(rel) {
    const now = Date.now()
    const hit = fileCache.get(rel)
    if (hit && now - hit.at < CACHE_TTL) return hit.text
    try {
      const text = fsNode.readFileSync(path.join(PREVIEW_DIR, rel), 'utf8')
      fileCache.set(rel, { text, at: now })
      return text
    } catch (e) {
      return null
    }
  }

  function serve(p, rel, type) {
    return ws.register({
      kind: 'exact',
      path: p,
      handler: function (req, res) {
        try {
          const text = serveText(rel)
          if (text === null) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('preview file unavailable: ' + rel)
            return
          }
          res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' })
          res.end(text)
        } catch (e) {
          try {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
            res.end('serve error path=' + p + ' msg=' + String((e && e.message) || e))
          } catch (e2) {}
        }
      },
    })
  }
  const d1 = serve('/dsh-store/preview.html', 'preview.html', 'text/html; charset=utf-8')
  const d2 = serve('/dsh-store/preview.js', 'preview.js', 'text/javascript; charset=utf-8')

  // ---------------- OAuth 登录跳转 / 回调转发 ----------------
  function redirect(pathname) {
    return ws.register({
      kind: 'exact',
      path: pathname,
      handler: function (req, res) {
        const target = REMOTE + req.url.slice('/dsh-store'.length)
        res.writeHead(302, { Location: target, 'Cache-Control': 'no-store' })
        res.end('redirecting')
      },
    })
  }
  const GET_REDIRECT_SCRIPT = 'const u=process.argv[1];fetch(u,{redirect:"manual"}).then(function(r){const loc=r.headers.get("location")||"";process.stdout.write(JSON.stringify({status:r.status,loc:loc}))}).catch(function(e){process.stdout.write(JSON.stringify({status:502,loc:""}))})'
  async function authLogin(req, res) {
    const scriptB64 = btoa(GET_REDIRECT_SCRIPT)
    const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'' + REMOTE + '/auth/login\''
    try {
      const spec = shell.resolve({ command, timeoutMs: 20000, stdoutMaxBytes: 200000 })
      const run = await shell.run(spec)
      const out = run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : ''
      const j = out ? JSON.parse(out) : { status: 502, loc: '' }
      let loc = String(j.loc || '')
      if (loc.indexOf('github.com/login/oauth/authorize') >= 0) {
        loc = loc.replace(/(redirect_uri=)([^&]*)/, function (_m, p) {
          return p + encodeURIComponent(REMOTE + '/auth/callback')
        })
      }
      if (!loc) loc = REMOTE + '/auth/login'
      res.writeHead(302, { Location: loc, 'Cache-Control': 'no-store' })
      res.end('redirecting')
    } catch (e) {
      try {
        res.writeHead(302, { Location: REMOTE + '/auth/login', 'Cache-Control': 'no-store' })
        res.end('redirecting')
      } catch (e2) {}
    }
  }
  const d3 = ws.register({ kind: 'exact', path: '/dsh-store/auth/login', handler: function (req, res) { return authLogin(req, res) } })
  const d4 = redirect('/dsh-store/auth/callback')

  // ---------------- /api 反向代理 ----------------
  const FORWARD_SCRIPT = 'const u=process.argv[1],m=process.argv[2],hb=process.argv[3];let body="";process.stdin.setEncoding("utf8");process.stdin.on("data",function(c){body+=c});process.stdin.on("end",async function(){const headers=hb?JSON.parse(Buffer.from(hb,"base64").toString("utf8")):{};const opts={method:m,headers:headers};if(m!=="GET"&&m!=="HEAD")opts.body=body||undefined;let lastErr="";for(let i=0;i<4;i++){const ctrl=new AbortController();const timer=setTimeout(function(){ctrl.abort()},20000);try{const r=await fetch(u,Object.assign({},opts,{signal:ctrl.signal}));const text=await r.text();clearTimeout(timer);const out={};r.headers.forEach(function(v,k){const lk=k.toLowerCase();if(lk==="content-type"||lk==="content-length")out[lk]=v});process.stdout.write(JSON.stringify({status:r.status,headers:out,text:text}));return}catch(e){clearTimeout(timer);lastErr=String((e&&e.message)||e);if(i<3){await new Promise(function(ok){setTimeout(ok,300)})}}}process.stdout.write(JSON.stringify({status:502,headers:{"content-type":"text/plain; charset=utf-8"},text:"upstream fetch failed: "+lastErr}))})'

  function readReq(req) {
    return new Promise(function (resolve) {
      const chunks = []
      req.on('data', function (c) { chunks.push(String(c)) })
      req.on('end', function () { resolve(chunks.join('')) })
      req.on('error', function () { resolve('') })
    })
  }

  async function forward(req, res) {
    const url = REMOTE + req.url.slice('/dsh-store'.length)
    const body = await readReq(req)
    const fwd = {}
    const names = ['authorization', 'x-access-password', 'x-anon-token', 'content-type', 'accept']
    names.forEach(function (n) {
      const v = req.headers[n]
      if (typeof v === 'string' && v) fwd[n] = v
    })
    const hb = btoa(JSON.stringify(fwd))
    const scriptB64 = btoa(FORWARD_SCRIPT)
    const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'' + url + '\' \'' + req.method + '\' \'' + hb + '\''
    try {
      const spec = shell.resolve({ command, stdin: body, timeoutMs: 90000, stdoutMaxBytes: 10000000 })
      const run = await shell.run(spec)
      const out = run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : ''
      const j = out ? JSON.parse(out) : { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' }, text: 'proxy empty response' }
      const ct = j.headers && (j.headers['content-type'] || j.headers['Content-Type']) ? (j.headers['content-type'] || j.headers['Content-Type']) : 'application/json; charset=utf-8'
      res.writeHead(j.status || 502, { 'Content-Type': ct, 'Cache-Control': 'no-store' })
      res.end(j.text || '')
    } catch (e) {
      try {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('proxy error: ' + String((e && e.message) || e))
      } catch (e2) {}
    }
  }
  const d5 = ws.register({ kind: 'prefix', path: '/dsh-store/api', handler: function (req, res) { return forward(req, res) } })
  const d6 = ws.register({ kind: 'exact', path: '/dsh-store/health', handler: function (req, res) { return forward(req, res) } })

  // ---------------- 页面内通用 HTTP 转发（SSRF 防护） ----------------
  const HTTP_FWD_SCRIPT = 'const u=process.argv[1],m=process.argv[2],hb=process.argv[3];let body="";process.stdin.setEncoding("utf8");process.stdin.on("data",function(c){body+=c});process.stdin.on("end",async function(){const headers=hb?JSON.parse(Buffer.from(hb,"base64").toString("utf8")):{};headers["user-agent"]="dsh-store-client/1.0";const opts={method:m,headers:headers};if(m!=="GET"&&m!=="HEAD")opts.body=body||undefined;let lastErr="";for(let i=0;i<4;i++){const ctrl=new AbortController();const timer=setTimeout(function(){ctrl.abort()},20000);try{const r=await fetch(u,Object.assign({},opts,{signal:ctrl.signal}));const text=await r.text();clearTimeout(timer);const out={};r.headers.forEach(function(v,k){const lk=k.toLowerCase();if(lk==="content-type")out[lk]=v});process.stdout.write(JSON.stringify({status:r.status,headers:out,body:text}));return}catch(e){clearTimeout(timer);lastErr=String((e&&e.message)||e);if(i<3){await new Promise(function(ok){setTimeout(ok,400)})}}}process.stdout.write(JSON.stringify({status:502,headers:{"content-type":"text/plain; charset=utf-8"},body:"upstream fetch failed: "+lastErr}))})'

  async function httpHandler(req, res) {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 405, headers: { 'content-type': 'application/json; charset=utf-8' }, body: 'method not allowed' }))
      return
    }
    const host = String(req.headers.host || '')
    const origin = String(req.headers.origin || '')
    const site = String(req.headers['sec-fetch-site'] || '')
    // 同源优先：iframe 与壳同源（任意端口），自定义 DSH web 端口也能正常转发。
    const sameOrigin = origin === 'http://' + host || origin === 'https://' + host
    // 无头请求（curl 等）仅放行本机 loopback（任意端口）。
    const localHost = host.indexOf('127.0.0.1:') === 0 || host.indexOf('localhost:') === 0
    const allowed = site === 'same-origin' || sameOrigin || (!site && !origin && localHost)
    if (!allowed) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 403, headers: { 'content-type': 'application/json; charset=utf-8' }, body: 'forbidden origin' }))
      return
    }
    const text = await readReq(req)
    let inJ = {}
    try { inJ = text ? JSON.parse(text) : {} } catch (e) { inJ = {} }
    const url = String(inJ.url || '')
    const method = String(inJ.method || 'GET').toUpperCase()
    if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 400, headers: { 'content-type': 'application/json; charset=utf-8' }, body: 'bad url' }))
      return
    }
    // SSRF 防护：拒绝内网/回环/链路本地地址（商店服务器源不可能是内网地址）。
    // 仅拦 IP 字面量与 localhost 域名；DNS 重绑定类攻击不在本层防御范围。
    let urlHost = ''
    const um = url.match(/^https?:\/\/([^\/?#]+)/i)
    if (um) urlHost = String(um[1]).split('@').pop().split(':')[0].replace(/^\[|\]$/g, '').toLowerCase()
    const privateHost =
      urlHost === '' || urlHost === 'localhost' || urlHost === 'local' || urlHost === '0.0.0.0' || urlHost === '::1' ||
      /^127\./.test(urlHost) || /^10\./.test(urlHost) || /^192\.168\./.test(urlHost) || /^169\.254\./.test(urlHost) || /^172\.(1[6-9]|2\d|3[01])\./.test(urlHost) ||
      /^0\./.test(urlHost) || /^fe80:/.test(urlHost) || /^::ffff:127\./.test(urlHost)
    if (privateHost) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 400, headers: { 'content-type': 'application/json; charset=utf-8' }, body: 'private url not allowed' }))
      return
    }
    if (['GET', 'POST', 'PUT', 'DELETE'].indexOf(method) < 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ status: 400, headers: { 'content-type': 'application/json; charset=utf-8' }, body: 'bad method' }))
      return
    }
    const fwd = {}
    const names = ['authorization', 'x-access-password', 'x-anon-token', 'content-type', 'accept']
    names.forEach(function (n) {
      const v = inJ.headers && inJ.headers[n]
      if (typeof v === 'string' && v) fwd[n] = v
    })
    const scriptB64 = btoa(HTTP_FWD_SCRIPT)
    const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'' + url.replace(/'/g, '') + '\' \'' + method + '\' \'' + btoa(JSON.stringify(fwd)) + '\' 90000'
    try {
      const spec = shell.resolve({ command, stdin: String(inJ.body || ''), timeoutMs: 100000, stdoutMaxBytes: 12000000 })
      const run = await shell.run(spec)
      const out = run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : ''
      const j = out ? JSON.parse(out) : { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'proxy empty response' }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(j))
    } catch (e) {
      try {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: String((e && e.message) || e) }))
      } catch (e2) {}
    }
  }
  const d7 = ws.register({ kind: 'exact', path: '/dsh-store/http', handler: function (req, res) { return httpHandler(req, res) } })

  // ---------------- 本地安装器 RPC ----------------
  function safeSpec(s) {
    const x = String(s || '').trim()
    if (!x) return ''
    if (!/^[A-Za-z0-9@._:/#~-]+$/.test(x)) return ''
    return x
  }
  function cliBase() {
    return USE_DSH_BIN
      ? ('node "' + DSH_BIN + '" plugin --profile ' + PROFILE)
      : ('dsh plugin --profile ' + PROFILE)
  }
  async function runCli(args) {
    const command = cliBase() + ' ' + args.join(' ')
    const policy = wsRoot ? { mode: 'danger-full-access', workspaceRoot: wsRoot } : { mode: 'danger-full-access' }
    const spec = shell.resolve({ command, timeoutMs: 120000, stdoutMaxBytes: 2000000, sandboxPolicy: policy })
    const run = await shell.run(spec)
    const out = (run && run.stdout && run.stdout.text ? String(run.stdout.text) : '') + (run && run.stderr && run.stderr.text ? String(run.stderr.text) : '')
    const ok = run && run.exitCode === 0
    return { ok, message: ok ? '已执行：dsh plugin --profile ' + PROFILE + ' ' + args.join(' ') : '安装命令失败', output: out.slice(-800), exitCode: run ? run.exitCode : -1 }
  }
  function specFor(body) {
    let spec = safeSpec(body.install || body.pkg || '')
    if (!spec) return ''
    if (body.version && !spec.includes(':') && !spec.includes('/')) spec = spec + '@' + safeSpec(body.version)
    return spec
  }

  // Agent 预设安装：git clone → 找 preset/<name>/agent.cordis.yml → 复制到 ~/.dsh/.agent-presets/<name>。
  const PRESET_LINES = [
    '(function(){',
    'const fs=require("fs"),os=require("os"),path=require("path"),cp=require("child_process");',
    'const repo=process.argv[1],pref=process.argv[2],home=process.argv[3];',
    'let tmp="";',
    'function out(o){process.stdout.write(JSON.stringify(o))}',
    'try {',
    '  tmp=path.join(os.tmpdir(),"dsh-preset-"+Date.now()+"-"+Math.floor(Math.random()*10000));',
    '  let cloneErr="";',
    '  try {',
    '    cp.execSync("git clone --depth 1 --quiet \\"" + repo.replace(/"/g,"") + "\\" \\"" + tmp + "\\"",{stdio:"pipe",timeout:90000});',
    '  } catch(e) {',
    '    cloneErr=String((e&&e.stderr)||(e&&e.message)||e).replace(/[^\\x00-\\x7F]/g,"?").slice(0,400);',
    '  }',
    '  if(!cloneErr && fs.existsSync(tmp)) {',
    '    function have(d){try{return fs.existsSync(path.join(d,"agent.cordis.yml"))}catch(e){return false}}',
    '    var candidates=[];',
    '    if(pref && /^[A-Za-z0-9._-]+$/.test(pref)){candidates.push(path.join(tmp,"preset",pref))}',
    '    var pd=path.join(tmp,"preset");',
    '    if(fs.existsSync(pd)){',
    '      fs.readdirSync(pd).sort().forEach(function(n){',
    '        var d=path.join(pd,n);',
    '        try{if(fs.statSync(d).isDirectory() && have(d) && candidates.indexOf(d)<0){candidates.push(d)}}catch(e){}',
    '      });',
    '    }',
    '    if(have(tmp)){candidates.push(tmp)}',
    '    var src=null,found="";',
    '    for(var i=0;i<candidates.length;i++){',
    '      if(have(candidates[i])){src=candidates[i];found=src===tmp?"root":"preset/"+path.basename(src);break}',
    '    }',
    '    if(src){',
    '      var name=(pref && /^[A-Za-z0-9._-]+$/.test(pref))?pref:path.basename(src);',
    '      var dst=path.join(home,".agent-presets",name);',
    '      fs.rmSync(dst,{recursive:true,force:true});',
    '      fs.mkdirSync(path.dirname(dst),{recursive:true});',
    '      fs.cpSync(src,dst,{recursive:true,filter:function(s){return !String(s).includes(path.sep+".git")}});',
    '      out({ok:true,name:name,dst:dst,found:found});',
    '      return;',
    '    }',
    '    out({ok:false,code:"no_preset_structure",cloneErr:""});',
    '    return;',
    '  }',
    '  out({ok:false,code:"clone_failed",cloneErr:cloneErr});',
    '} catch(e) {',
    '  out({ok:false,code:"error",message:String((e&&e.message)||e).replace(/[^\\x00-\\x7F]/g,"?").slice(0,400)});',
    '} finally {',
    '  try{if(tmp){fs.rmSync(tmp,{recursive:true,force:true})}}catch(e){}',
    '}',
    '})()',
  ]
  const PRESET_SCRIPT = PRESET_LINES.join('\n')

  async function installPreset(body) {
    const repo = String(body.repoUrl || '').replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '')
    const name = String(body.presetName || body.pkg || '').trim()
    if (!/^[A-Za-z0-9._/-]+$/.test(repo) || !/^[A-Za-z0-9._-]+$/.test(name)) return { ok: false, message: '预设仓库或名称非法', output: '' }
    const scriptB64 = btoa(PRESET_SCRIPT)
    const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'https://github.com/' + repo + '\' \'' + name + '\' \'' + DSH_HOME + '\''
    try {
      const policy = wsRoot ? { mode: 'danger-full-access', workspaceRoot: wsRoot } : { mode: 'danger-full-access' }
      const spec = shell.resolve({ command, timeoutMs: 120000, stdoutMaxBytes: 2000000, sandboxPolicy: policy })
      const run = await shell.run(spec)
      const out = (run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : '') + (run && run.stderr && run.stderr.text ? String(run.stderr.text) : '')
      let j = null
      try { j = out ? JSON.parse(out.trim().split('\n').pop()) : null } catch (e) { j = null }
      if (j && j.ok) return { ok: true, message: '已安装 Agent 预设 ' + j.name + ' 到 ~/.dsh/.agent-presets/' + j.name + '（来源 ' + j.found + '），重启 DSH 后新建空白会话选择', output: '' }
      if (j && j.code === 'no_preset_structure') return { ok: false, message: '该条目被服务器标记为 Agent 预设，但仓库里没有 preset/<name>/agent.cordis.yml（也没有根目录 agent.cordis.yml），无法安装：服务器端分类与仓库结构不匹配。', output: '' }
      if (j && j.code === 'clone_failed') return { ok: false, message: '克隆预设仓库失败：' + String(j.cloneErr || '').slice(0, 200), output: '' }
      return { ok: false, message: (j && j.message) ? ('预设安装失败：' + j.message) : '预设安装失败（安装器无输出）', output: '' }
    } catch (e) {
      return { ok: false, message: String((e && e.message) || e), output: '' }
    }
  }

  const RM_PRESET_SCRIPT = 'const fs=require("fs"),path=require("path");const home=process.argv[1],name=process.argv[2];try{const dst=path.join(home,".agent-presets",name);const existed=fs.existsSync(dst);if(existed)fs.rmSync(dst,{recursive:true,force:true});process.stdout.write(JSON.stringify({ok:true,existed:!!existed,dst:dst}))}catch(e){process.stdout.write(JSON.stringify({ok:false,message:String((e&&e.message)||e)}))}'

  async function removePreset(name) {
    const scriptB64 = btoa(RM_PRESET_SCRIPT)
    const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'' + DSH_HOME + '\' \'' + name + '\''
    try {
      const policy = wsRoot ? { mode: 'danger-full-access', workspaceRoot: wsRoot } : { mode: 'danger-full-access' }
      const spec = shell.resolve({ command, timeoutMs: 30000, stdoutMaxBytes: 200000, sandboxPolicy: policy })
      const run = await shell.run(spec)
      const out = run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : ''
      let j = null
      try { j = out ? JSON.parse(out) : null } catch (e) { j = null }
      if (j && j.ok) return { ok: true, message: j.existed ? '已删除 Agent 预设 ~/.dsh/.agent-presets/' + name : '预设目录不存在，已同步本地台账', output: '' }
      return { ok: false, message: j && j.message ? j.message : '预设卸载失败', output: '' }
    } catch (e) {
      return { ok: false, message: String((e && e.message) || e), output: '' }
    }
  }

  const LIST_DIR_SCRIPT = 'const fs=require("fs"),path=require("path");const d=process.argv[1];try{const n=fs.readdirSync(d).filter(function(x){try{return fs.statSync(path.join(d,x)).isDirectory()}catch(e){return false}});process.stdout.write(JSON.stringify({ok:true,dirs:n}))}catch(e){process.stdout.write(JSON.stringify({ok:false,message:String((e&&e.message)||e)}))}'

  /**
   * 真实已装清单（防重复安装用，客户端本地台账之外的真实状态）：
   * 1. loader 装配投影（pluginInventory.moduleName，含 bundles 自带插件）；
   * 2. profile package.json 的 dependencies 键 + dsh.profile.bundles；
   * 3. ~/.dsh/.agent-presets 目录（已装 Agent 预设）。
   * 返回 [{ name, version|null }]。
   */
  async function installedList() {
    const map = {}
    const bump = function (n, v) { if (typeof n === 'string' && n) map[n] = v === undefined ? null : v }
    // 1) loader 装配投影
    try {
      const inv = ctx.get('pluginInventory')
      if (inv && typeof inv.list === 'function') {
        const snap = inv.list()
        const ents = snap && snap.entries ? snap.entries : []
        for (let i = 0; i < ents.length; i++) {
          bump(ents[i] && ents[i].moduleName)
        }
      }
    } catch (e) {}
    // 2) profile package.json（dependencies 带版本；bundles 无版本）
    try {
      const pjText = fsNode.readFileSync(path.join(DSH_HOME, 'profiles', PROFILE, 'package.json'), 'utf8')
      const pj = JSON.parse(pjText)
      if (pj) {
        if (pj.dependencies && typeof pj.dependencies === 'object') {
          Object.keys(pj.dependencies).forEach(function (k) { bump(k, pj.dependencies[k] || null) })
        }
        if (pj.dsh && pj.dsh.profile && Array.isArray(pj.dsh.profile.bundles)) {
          pj.dsh.profile.bundles.forEach(function (b) { bump(b) })
        }
      }
    } catch (e) {}
    // 3) .agent-presets 目录
    try {
      const scriptB64 = btoa(LIST_DIR_SCRIPT)
      const command = 'node -e "eval(atob(\'' + scriptB64 + '\'))" \'' + path.join(DSH_HOME, '.agent-presets') + '\''
      const spec = shell.resolve({ command, timeoutMs: 15000, stdoutMaxBytes: 200000 })
      const run = await shell.run(spec)
      const out = run && run.stdout && run.stdout.text ? String(run.stdout.text).trim() : ''
      const j = out ? JSON.parse(out) : null
      if (j && j.ok && Array.isArray(j.dirs)) {
        j.dirs.forEach(function (d) { bump(d) })
      }
    } catch (e) {}
    const list = Object.keys(map).map(function (n) { return { name: n, version: map[n] } })
    return { ok: true, installed: list }
  }

  async function rpcHandler(req, res) {
    const pathname = req.url.split('?')[0]
    const op = pathname.slice('/dsh-store/rpc'.length)
    const bodyText = await readReq(req)
    let body = {}
    try { body = bodyText ? JSON.parse(bodyText) : {} } catch (e) { body = {} }
    let result
    if (op === '/install' || op === '/update') {
      const s = specFor(body)
      if (!s) result = { ok: false, message: '安装地址缺失或包含非法字符' }
      else result = await runCli(['add', s])
      result.target = body.pkg || ''
    } else if (op === '/uninstall') {
      const inst = String(body.install || '')
      if (inst.indexOf('preset:') === 0) {
        const pn = String(body.presetName || inst.slice('preset:'.length) || body.pkg || '').trim()
        if (!/^[A-Za-z0-9._-]+$/.test(pn)) result = { ok: false, message: '预设名称非法' }
        else result = await removePreset(pn)
      } else {
        const s2 = safeSpec(body.install || body.pkg || '')
        if (!s2) result = { ok: false, message: '卸载地址缺失或包含非法字符' }
        else result = await runCli(['remove', s2])
      }
      result.target = body.pkg || ''
    } else if (op === '/preset') {
      result = await installPreset(body)
      result.target = body.pkg || ''
    } else if (op === '/client') {
      // 客户端插件自更新：specFor 支持 version 拼接（npm 包名场景 pkg@version 装指定版本；
      // github:/tgz 直链场景 version 无意义，仅按 spec 安装）。
      const s3 = specFor(body)
      if (!s3) result = { ok: false, message: '客户端更新地址缺失' }
      else {
        result = await runCli(['add', s3])
        // bundle 装配在启动时完成：新版本需重启 DSH web 才生效
        if (result.ok) result.message += '；重启 DSH web 后生效'
      }
      result.target = 'dsh-store-client'
    } else if (op === '/version') {
      // 真实安装版本（版本号单一事实来源）：读已装包 package.json——
      // git/npm/tgz 安装都返回实际版本，客户端据此与服务器推送比对。
      let v = ''
      try {
        v = String(JSON.parse(fsNode.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version || '')
      } catch (e) {}
      result = { ok: true, version: v || '0.0.0' }
    } else if (op === '/installed') {
      result = await installedList()
    } else {
      result = { ok: false, message: 'unknown rpc: ' + op }
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(result))
  }
  const d8 = ws.register({ kind: 'prefix', path: '/dsh-store/rpc', handler: function (req, res) { return rpcHandler(req, res) } })

  ctx.effect(function () {
    return function () {
      if (d1) d1()
      if (d2) d2()
      if (d3) d3()
      if (d4) d4()
      if (d5) d5()
      if (d6) d6()
      if (d7) d7()
      if (d8) d8()
    }
  })
}

// inject 声明：等待 webServer/shell 服务激活后再 apply（正式 bundle 装配下，
// 未声明 inject 会先于服务就绪执行，ctx.get 拿不到服务导致静默失效）。
module.exports = { apply, name: 'dsh-storecloud', inject: ['webServer', 'shell'] }
