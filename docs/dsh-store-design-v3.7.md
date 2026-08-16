# DSH 插件商城 · 核心设计方案 v3.7（服务端更新提醒 · 一键更新 · 空间评估 · README 运维章）

> 版本：v3.7 · 2026-08-14 · 基于 v3.6 增补
> 本轮：① 服务端更新提醒（GitHub Actions 构建检测 + 互联服版本不一致提醒）② 管理面板一键更新（免重新部署）③ 回滚/备份空间占用评估 ④ 迁移过程随项目开源 + README 运维章节
> 配套原型已同步更新（管理端新增「🔄 系统更新」页）。

---

## V1. 服务端更新提醒

### V1.1 检测源：本项目的 GitHub 仓库
管理端「系统更新」页输入**开源项目的 GitHub 地址**（如 `https://github.com/your-org/dsh-store`），服务器定时（默认 1h，可配）调 GitHub API：

| 检查项 | API | 说明 |
|---|---|---|
| 最新 Release | `GET /repos/{o}/{r}/releases/latest` | 取 tag 与当前运行版本比对 |
| 最新 Actions 构建 | `GET /repos/{o}/{r}/actions/runs?status=success&per_page=1` | 有成功构建的新 commit 也提示（可选只认 release，配置 `update.track=release|commit`） |

- 发现新版本 → 管理端仪表盘 + 系统更新页显示**更新提醒卡**（新版本号、发布日期、更新说明摘要、与当前版本差距）；
- 不自动更新——**只提醒，升级动作永远由管理员触发**。

### V1.2 互联服务器版本不一致提醒
- 联邦握手/心跳已交换 `software_version`（随 `protocol_version` 一起，v3.6）；
- 版本不一致时「联邦互联」页对应行高亮提醒：`对方 v0.4.1 / 本机 v0.3.2 · 协议按 min(双方) 运行`；
- 超出兼容窗口（默认 2 个 minor）时升级为**告警**（进安全监控页 + webhook）。

---

## V2. 一键更新（管理面板直接升级，免重新部署）

**可以实现，就这样做。** 管理端「系统更新」页提供【一键更新】按钮：

```
管理员点【一键更新到 vX.Y.Z】（需二次确认）
  → 服务端 updater 模块执行预置流水线（流式输出显示在面板）：
     ① 拉取：git fetch --tags && git checkout vX.Y.Z（或拉对应镜像）
     ② 构建：docker compose build
     ③ 迁移：docker compose up -d migrate（expand-contract，安全）
     ④ 切换：docker compose up -d api（逐容器滚动）
     ⑤ 自检：健康检查 + 冒烟（/health、manifest 拉取）
  → ⑤ 失败 → 自动切回旧镜像（回滚，见 v3.6）→ 面板标红并给出日志
  → ⑤ 通过 → 完成提示；更新前版本镜像自动保留（供回滚）
  → 全程写审计（谁、何时、从哪版到哪版、结果）
```

**安全约束**（这是服务器上最高权限操作）：
- updater **只执行预置脚本**，唯一参数是版本号（白名单格式校验 `^v\d+\.\d+\.\d+`），**不存在任意命令执行面**；
- 仅 `role=admin` 可调；操作需二次确认；
- 构建来源固定为 V1.1 配置的官方仓库地址，防投毒替换；
- LB 集群遵循 v3.6 滚动纪律：**一键更新只更新本机**，集群逐台点（面板会提示"联邦内还有 N 台旧版本"）。

---

## V3. 回滚与备份的空间占用评估（回答"占的多吗"）

**很少。** 以本业务规模估算：

| 项 | 单份大小 | 保留策略 | 总量估算 |
|---|---|---|---|
| 旧应用镜像（回滚用） | ~200MB/版（node:alpine 基础，层共享后增量更小） | 保留最近 2 版 | **≈ 400MB** |
| PG 备份（`pg_dump -Fc` 压缩） | 数据主体是文本：插件 1 万条 + 快照 90 天滚动 + 用户/组/点赞，压缩后 **≈ 20~50MB/份** | 每日 1 份 × 30 天 | **≈ 0.6~1.5GB** |
| Redis | 不备份（缓存可重建） | — | 0 |
| 非必要数据 | 2 天自动清（v3.5） | — | ≈ 0 |

**合计 < 3GB**，40GB 磁盘毫无压力。磁盘水位监控（v3.5）会在接近阈值时先告警，轮不到它撑爆。

---

## V4. 迁移过程随项目开源 + README 运维章节

### V4.1 仓库内包含（开源交付物的一部分）

```
repo/
├── docker-compose.yml          # db + migrate + api + redis（v3.5 定稿）
├── db/migrations/              # 全部迁移脚本（001_init.sql … 随版本递增）
├── scripts/update.sh           # 一键更新预置流水线（V2）
└── README.md                   # 含下方运维章节
```

### V4.2 README 运维章节（写入内容）

```markdown
## 部署
docker compose up -d        # 一条命令：装库 → 自动迁移 → 起服务

## 升级
方式一（推荐）：管理面板 → 系统更新 → 一键更新（自动构建+迁移+自检，失败自动回滚）
方式二（手动）：
  git fetch --tags && git checkout <新版本>
  docker compose up -d --build   # migrate 容器会先自动执行增量迁移

## 数据库迁移
- 全自动：每次启动由 migrate 容器按序执行 db/migrations/ 中的脚本
- 手动查看进度：
  docker compose exec db psql -U store -d dshstore \
    -c "SELECT version FROM schema_migrations ORDER BY version;"
- 纪律：迁移只加不减；删除类变更至少延迟一个版本周期

## 回滚
git checkout <旧版本> && docker compose up -d --build
（数据库无需回滚：expand-contract 保证旧代码兼容新表结构）

## 备份与恢复
- 备份：每日自动 pg_dump 到配置的对象存储
- 恢复：docker compose exec -T db pg_restore -U store -d dshstore --clean < 备份文件

## 磁盘策略
非必要数据默认保留 2 天自动清理（管理端可配）；磁盘余量见管理面板「安全监控」。
```

---

## V5. 配置 / ADR 增补

**配置新增**：`update.repo_url`（项目 GitHub 地址）、`update.check_interval_min`（默认 60）、`update.track`（release | commit）、`update.rollback_keep_images`（默认 2）。
**ADR**：

| 决策 | 结论 | 理由 |
|---|---|---|
| 更新提醒 | 检测 Release + Actions 成功构建，只提醒不自动更 | 升级决策权在管理员 |
| 一键更新 | 预置脚本流水线 + 失败自动回滚 | 免重新部署，且不引入任意命令执行面 |
| LB 升级 | 一键更新只管本机，逐台滚动 | 遵守混合版本纪律（v3.6） |
| 迁移脚本 | 随仓库开源 + README 运维章 | 部署/升级/回滚一条链全部可自助 |
