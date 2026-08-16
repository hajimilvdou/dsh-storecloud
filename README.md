# dsh-storecloud

**DSH 插件商城 · 用户端** —— 插件组一键装机、云端同步、联邦自建服，一体化的 DSH 插件商店客户端（源码 + 产物统一仓库）。

在 DSH Web 界面里浏览、搜索、安装 DSH 插件与 Agent 预设，**跟着社区推荐的插件组整组装机，换环境一键拉回自己的插件**，无需在海量插件里自己查找试错。

---

## ✨ 项目特色

### 🧩 插件组（组合）—— 用别人的推荐，避免自己试错

插件很多，逐个查找、试错成本高。商城把插件与 Agent 预设编成**组合（combos）**，一键整组安装：

- **社区推荐组合**：浏览/搜索他人分享的组合，按「推荐」「热门」「最新」筛选，组合详情里能看到完整成员清单与各自的安装模式；
- **一键整组安装**：点安装即按组合成员的安装模式逐个执行真实的 `dsh plugin add`（`直接安装` / `安装前询问` / `跳过`），Agent 预设自动装进 `~/.dsh/.agent-presets/`；
- **启动复核开关**：安装带启动复核的组合时逐项确认，安装完的组合可一键复查状态；
- **订阅组合**：订阅作者持续更新的组合，跟随推荐升级，不用自己维护清单；
- **创建并分享自己的组合**：从已装插件/预设里挑选成员、设定安装模式与自动发布，一键发布到云端供他人订阅。

### ☁️ 云端同步 —— 换开发环境，一键拉回自己的插件

换电脑、重装环境，不用再翻历史记录重新查找：

- **GitHub 登录**：OAuth 一键登录，身份与数据跟随账号；
- **云端台账**：你创建的组合、订阅的组合、安装记录全部同步到云端；
- **一键拉取**：新环境装好插件 → 登录 → 从「我的」一键拉取自己的组合与已装清单，整组批量装回，开箱即续；
- **多源切换**：`?server=<地址>` 可随时切换服务器源，本地缓存秒开、后台增量同步。

### 🛰️ 联邦与自建服务器 —— 数据在自己手里，还支持热更新

不想用作者的服务器？完全可以自己部署：

- **自建云端**：服务端是独立开源仓库，一条命令部署到自己的服务器（PostgreSQL + Docker），插件库、组合、用户、联邦关系全在自己手里；
- **联邦互联**：多台服务器之间握手互连，可选共享插件 / Agent 预设 / 组合 / 用户，服务器集群互为镜像，一处收录处处可用；
- **热更新**：服务端管理面板支持**一键在线更新**（拉新镜像 → 自动迁移 → 重建容器 → 自检，失败自动回滚），日常升级不用登录服务器敲命令；
- **开箱即用**：默认连接作者的服务器，零配置即可体验完整功能。

> 服务器端部署、管理端配置、联邦设置等详见文末「服务器端」章节。

### 其他亮点

- **双入口**：⚙️ 设置页区块 + 📑 会话视图 Tab，每个入口可在「我的」页独立开关（悬浮球入口已移除，测试版保留在 `dsh-store-shell/`）；
- **页内直接安装**：浏览到的插件点「安装」即执行真实的 `dsh plugin add`（pnpm 安装 + 自动入组合层），安装/卸载/已装清单实时核对本地真实状态；
- **零依赖客户端半**：走 DSH 标准 client-modules 通道（`dsh.client` 声明），不捆绑 React、不依赖框架内部 API，随 DSH 主版本长期兼容；
- **无缝反向代理桥**：`/dsh-store/api` 同源转发（自动携带登录态/访问口令/匿名凭证），OAuth 登录后 token 自动回传，无跨域无复制粘贴；通用转发带 SSRF 防护；
- **源码与产物统一仓库**：`npm install && npm run build` 全链路可复现；npm 发布物只含产物（约 100 kB）。

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

装完 **重启 DSH web 进程**（bundle 层在启动时装配）。重启后：设置页出现「🧩 插件商城」区块；会话头部出现「🧩 插件商城」视图（排最右）。

卸载：`dsh plugin --profile web remove dsh-storecloud`

> ⚠️ Windows 注意：tarball/目录路径含空格时 `dsh plugin add` 的 cmd 拼接会失败，请用不含空格的路径（npm 包名安装不受影响）。

---

## 使用说明

### 首次使用（三步）

1. 按上面命令安装并**重启 DSH web 进程**；
2. 打开商城：设置页「🧩 插件商城」区块，或会话头部「🧩 插件商城」Tab；
3. 等待插件库首次同步（本地缓存秒开，全量数据后台拉取，之后打开即用）。

### 登录与登录 token

- 商城「**我的**」页 → 点「⚡ 立即登录 GitHub」→ 新窗口完成授权 → **token 自动回传并保存到本地**（`dsh_store_token`），全程无需手动复制/粘贴；
- 再次打开商城自动恢复登录态；**换电脑/换环境**：装好插件 → 登录一次 → 云端组合/订阅/安装记录自动拉回，无需额外查找记录；
- **数据通道（浏览/搜索/安装）不登录也能用**；登录仅用于云端同步与社区功能（发布插件/组合、订阅、点赞）；
- 如果登录按钮跳转后无反应：服务器端未配置 OAuth（需在服务端管理端配置中心填入 GitHub OAuth Client ID/Secret + JWT_SECRET，见服务器端 README「使用说明」）。

### 自建服务器的搜索 token

- 插件库的自动收录依赖服务端的 **GitHub 搜索 token**（classic PAT）：在 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) 生成，填入**服务端管理端 → 配置中心 → 搜索 token**（或环境变量 `GITHUB_TOKENS`）；
- 只有打了 **`dsh-plugin`** topic 的仓库才会被收录；未配置搜索 token 时服务端同步与登录休眠，浏览/下载计数不受影响。

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
│   └── client.js            # 产物 · client 半（浏览器）：双入口槽位（零依赖）
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

## 服务器端

**仓库地址：<https://github.com/hajimilvdou/dsh-store-server>**

- 部署自己的云端服务器（一条命令从零拉起：建库 → 迁移 → 起服务 → 自检）；
- GitHub 自动收录插件库（`topic:dsh-plugin`）、联邦互联、管理端配置中心、面板一键热更新；
- 部署、配置、联邦、升级回滚等细节**具体看服务器端仓库**的 README。

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

- **装完看不到商城？** 确认重启了 web 进程；或在浏览器设置页 →「插件管理」检查 `dsh-storecloud` 状态。
- **连不上服务器？** 默认服务器需可访问；页面右上角「我的」可查看连接状态，`?server=` 可临时切换。
- **本地安装按钮报错？** 安装器需要本机 `dsh` CLI 可达（`~/.dsh/profiles/node_modules/@deepseek-ai/dsh` 或 PATH）；服务器需放行对应插件条目。
