# dsh-storecloud

**DSH 插件商城 · 用户端** —— 把插件商店装进 DSH 的一体化插件（源码 + 产物统一仓库）。

在 DSH Web 界面里直接浏览、搜索、安装 DSH 插件与 Agent 预设，无需离开会话。配合服务端仓库，即可拥有自己的插件商店。

> 📌 配套服务端见 [dsh-store-server](https://github.com/hajimilvdou/dsh-store-server)（REST API / GitHub 同步 / 联邦互联 / 管理端）。
> 两者联动：装好本插件 → 默认连接**作者的服务器**即开即用；自建服则把服务端部署到自己的机器，再把本插件指向它。

---

## ✨ 项目特色

**① 三处入口，随处可达**
- 🧩 **悬浮球**：页面右下角常驻，可拖动、四角缩放、开关面板；
- ⚙️ **设置页区块**：设置页内嵌完整商城；
- 📑 **会话视图**：与「对话」「轨迹」同列的独立视图 Tab，占满工作区；
- 每个入口都可在商城「我的」页独立开关，跨页面实时联动。

**② 零依赖的客户端半**
- 走 DSH 标准 client-modules 通道（`dsh.client` 声明），不捆绑 React、不依赖框架内部 API；
- 类组件 + 手写 ReactElement 实现，任何 Web 装配环境都可用，随 DSH 主版本长期兼容。

**③ 商城页内直接安装**
- 浏览到的插件点「安装」即执行真实的 `dsh plugin add`（pnpm 安装 + 自动入组合层）；
- Agent 预设一键安装到 `~/.dsh/.agent-presets/`，重启后即可选用；
- 安装/卸载/已装清单全部实时核对本地真实状态，不靠前端台账自欺。

**④ 无缝反向代理桥**
- `/dsh-store/api` 同源转发到商店服务器，自动携带登录态 / 访问口令 / 匿名凭证；
- OAuth 登录走本地跳转桥，登录后 token 自动回传页面，无跨域、无复制粘贴；
- 通用 `/dsh-store/http` 转发带 SSRF 防护，页面内任何外部请求都安全。

**⑤ 源码与产物统一仓库**
- `packages/`（源码）+ `lib/` + `preview/`（产物）一体提交，`npm install && npm run build` 全链路可复现；
- npm 发布物（tarball）只含产物，轻量干净（约 100 kB）；
- 修 bug / 迭代 = 改 `packages/client/src/**` → `npm run build` → `npm pack`，一个仓库闭环。

**⑥ 多服务器可配**
- 默认连接**作者的服务器**，开箱即用；自建服务端后通过 `serverUrl` 配置切换；
- 页面内 `?server=<地址>` 可临时切换，支持多源并存。

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

装完 **重启 DSH web 进程**（bundle 层在启动时装配）。重启后：右下角出现 🧩 悬浮球；设置页出现「🧩 插件商城」区块；会话头部出现「🧩 插件商城」视图（排最右）。

卸载：`dsh plugin --profile web remove dsh-storecloud`

> ⚠️ Windows 注意：tarball/目录路径含空格时 `dsh plugin add` 的 cmd 拼接会失败，请用不含空格的路径（npm 包名安装不受影响）。

---

## 配置

插件通过 profile 的 `cordis.patch.yml` 传配置（全部可选，默认即用）：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: dsh-storecloud
  config:
    serverUrl: https://你的商店服务器   # 默认连接作者的服务器
    profileName: web                    # 本地安装器目标 profile（默认 web）
    # dshHome: ~/.dsh                  # DSH 家目录（默认 $DSH_HOME 或 ~/.dsh）
    # cacheTtlMs: 10000                # 静态资源缓存 TTL
```

环境变量兜底：`DSH_STORE_SERVER_URL`（服务器地址）、`DSH_HOME`（家目录）。

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
│   └── client.js            # 产物 · client 半（浏览器）：三入口槽位（零依赖）
├── preview/                 # 产物 · 商城 UI 静态资源（由 packages 构建）
├── cordis.patch.yml         # bundle 层：插入本插件 loader 行
├── scripts/
│   ├── build.mjs            # 全链路构建：tsc workspaces → esbuild preview → 语法检查
│   └── verify-client.mjs    # 客户端半渲染自检（真实 React 渲染三槽位）
├── smoke-test.mjs           # 冒烟测试（core 纯函数 + mock 桥接全链路）
└── preview-server.mjs       # 本地预览服务器
```

**npm 发布物（tarball）只含产物**（`files` 白名单）；**GitHub 仓库含全部源码**，随时可重新构建。

---

## 开发 / 修 bug

```bash
npm install                # 安装构建依赖
npm run build              # 全链路：tsc → esbuild → preview/preview.js
npm run typecheck          # 源码类型检查 + lib 语法检查
npm run smoke              # 冒烟测试
npm run verify:client      # 客户端半渲染自检
npm pack                   # 产出发布 tarball
```

改 bug 流程：改 `packages/client/src/**`（UI/数据层）→ `npm run build`；改壳层（入口/安装器）→ 直接改 `lib/index.js` / `lib/client.js`。重新发布：`npm pack` + 上传 tarball / push git。

---

## GitHub 标签（Topics）

DSH 插件商店的服务端通过 GitHub **topic 自动收录**插件仓库，请给本仓库打上以下标签：

| Topic | 作用 |
|---|---|
| **`dsh-plugin`** | **必打**：商店服务器按此 topic 搜索并收录插件 |
| `dsh` / `dsh-store` | 生态检索 |
| `cordis` / `plugin-marketplace` | 技术分类 |

> 打上 `dsh-plugin` topic 后，运行中的商店服务器会在下一次同步时自动收录本仓库；`package.json` 的 `name` 即插件安装名，未发布 npm 时商店自动回落为 `github:owner/repo` 安装地址。

---

## 许可

本项目采用 **CC BY-NC-SA 4.0（署名-非商业性使用-相同方式共享）** 开源协议：

- ✅ 可自由使用、修改、分发，但**禁止商业化使用**；
- 📝 使用须署名；衍生作品须以相同协议共享；
- 🔗 完整法律文本：<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>

---

## 常见问题

- **装完没有悬浮球？** 确认重启了 web 进程；或在浏览器设置页 →「插件管理」检查 `dsh-storecloud` 状态。
- **连不上服务器？** 默认服务器需可访问；页面右上角「我的」可查看连接状态，`?server=` 可临时切换。
- **本地安装按钮报错？** 安装器需要本机 `dsh` CLI 可达（`~/.dsh/profiles/node_modules/@deepseek-ai/dsh` 或 PATH）；服务器需放行对应插件条目。
