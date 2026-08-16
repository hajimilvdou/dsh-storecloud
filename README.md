# dsh-storecloud

DSH 插件商城 · **用户端统一仓库**（源码 + 编译产物一体）。安装后提供：

- 🧩 **三处入口**：悬浮球（shell.overlay）/ 设置页 section / 会话视图 tab，各自可在商城内「我的」页开关；
- 🔌 **本地安装器**：商城内「安装」直接执行 `dsh plugin add`，Agent 预设安装到 `~/.dsh/.agent-presets/`；
- 🔁 **反向代理桥**：`/dsh-store/api` 转发到商店服务器（自动携带登录态/访问口令/匿名凭证），无跨域问题；
- 🔑 **OAuth 登录桥**：`/dsh-store/auth/login` 跳转 + 回调转发，登录后 token 自动回传页面；
- 🖥️ **零 React 依赖的客户端半**：走 DSH 标准 client-modules 通道（`dsh.client` 声明），任何 Web 装配都可用。

> 服务端在独立仓库 [dsh-store-server](https://github.com/hajimilvdou/dsh-store-server)：REST API / GitHub 同步 / 联邦 / 管理端 / 数据库迁移。
> 本包默认连接官方源 `https://blog.1qwq1.top`，也支持自建源（见下文配置）。

---

## 一键安装（npm）

```bash
# 方式 A：官方装配命令（推荐）——装完重启 DSH web 进程即可
dsh plugin --profile web add dsh-storecloud

# 方式 B：本地 tarball / git 仓库
dsh plugin --profile web add ./dsh-storecloud-0.1.0.tgz
dsh plugin --profile web add github:hajimilvdou/dsh-storecloud

# 方式 C：直接 pnpm 装进 profile（等价）
cd ~/.dsh/profiles/web && pnpm add dsh-storecloud
```

装完 **重启 DSH web 进程**（bundle 层在启动时装配）。重启后：
- 页面右下角出现 🧩 悬浮球（可拖动、可缩放）；
- 设置页出现「🧩 插件商城」区块；
- 会话头部 tab 行出现「🧩 插件商城」视图（排在最右）。

卸载：

```bash
dsh plugin --profile web remove dsh-storecloud
```

> ⚠️ Windows 注意：tarball/目录路径含空格时 `dsh plugin add` 的 cmd 拼接会失败，
> 请用不含空格的路径（npm 包名安装不受影响）。

---

## 仓库结构（源码 + 产物统一）

```
dsh-storecloud/
├── packages/                # 📦 源码（改 bug 在这里改）
│   ├── shared/              #   @dsh-store/shared —— 跨端契约（协议/模型/API/配置）
│   └── client/              #   @dsh-store/client —— 商城 UI（React）+ 数据层/台账/核心纯函数
├── docs/                    # 设计文档（v3 ~ v3.7）与界面原型
├── lib/
│   ├── index.js             # 产物 · host 半（Node cordis 插件）：路由/反代/RPC/静态资源
│   └── client.js            # 产物 · client 半（浏览器）：三入口槽位（零依赖，类组件 + 手写 ReactElement）
├── preview/                 # 产物 · 商城 UI 静态资源（preview.html + preview.js，由 packages 构建）
├── cordis.patch.yml         # bundle 层：插入本插件 loader 行
├── scripts/
│   ├── build.mjs            # 全链路构建：tsc workspaces → esbuild preview → 语法检查
│   └── verify-client.mjs    # 客户端半渲染自检（真实 React 渲染三槽位）
├── smoke-test.mjs           # 冒烟测试（core 纯函数 + mock 桥接全链路）
└── preview-server.mjs       # 本地预览服务器（http://127.0.0.1:4173）
```

**npm 发布物（tarball）只含产物**：`lib/` + `preview/` + `cordis.patch.yml` + `README.md` + `LICENSE`（`files` 白名单）；
**GitHub 仓库含全部源码**：`packages/` + `docs/` + 产物一起提交，随时可重新构建。

---

## 开发 / 修 bug

```bash
npm install                # 安装构建依赖（tsc / esbuild / react 类型）
npm run build              # 全链路：tsc → esbuild → preview/preview.js
npm run typecheck          # 源码类型检查 + lib 语法检查
npm run smoke              # 冒烟测试
npm run verify:client      # 客户端半渲染自检
npm pack                   # 产出发布 tarball
```

改 bug 流程：改 `packages/client/src/**`（UI/数据层）→ `npm run build` → 产物 `preview/preview.js` 更新；
改壳层（入口/安装器）→ 直接改 `lib/index.js` / `lib/client.js`。重新发布：`npm pack` + 上传 tarball / push git。

---

## 配置

插件通过 profile 的 `cordis.patch.yml` 传配置（全部可选）：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-storecloud
  config:
    serverUrl: https://你的商店服务器   # 默认 https://blog.1qwq1.top
    profileName: web                    # 本地安装器目标 profile（默认 web）
    # dshHome: ~/.dsh                  # DSH 家目录（默认 $DSH_HOME 或 ~/.dsh）
    # cacheTtlMs: 10000                # 静态资源缓存 TTL
```

环境变量兜底：`DSH_STORE_SERVER_URL`（服务器地址）、`DSH_HOME`（家目录）。
页面内也支持 `?server=<url>` 临时切换服务器（存 localStorage）。

**隐私说明**：本包不含任何机器相关路径 / 凭据 / 个人信息。DSH 家目录与 CLI 路径全部运行时探测
（`$DSH_HOME` 或 `~/.dsh`）；唯一的外部地址是默认服务器 `https://blog.1qwq1.top`（官方公开源，可配置替换）。

---

## 常见问题

- **装完没有悬浮球？** 确认重启了 web 进程；或在浏览器设置页 →「插件管理」检查 `dsh-storecloud` 状态。
- **连不上服务器？** 服务器需开启（`/health` 可访问）；页面右上角「我的」可查看连接状态，`?server=` 可临时切换。
- **本地安装按钮报错？** 安装器需要本机 `dsh` CLI 可达（`~/.dsh/profiles/node_modules/@deepseek-ai/dsh` 或 PATH）；`serverUrl` 指向的服务器需放行对应插件条目。
