# DSH 插件商城 · 核心设计方案 v3.5（PostgreSQL 定案 · 数据保留 · 回滚与迁移）

> 版本：v3.5 · 2026-08-14 · 基于 v3.4 增补，未提及章节不变
> 本轮决策：① 数据库直接采用 **PostgreSQL**（Docker 自动安装/连接/迁移）② 非必要资料默认保留 2 天自动清理（可配置、磁盘余量可见）③ 备份恢复演练暂缓
> 附概念答疑：回滚策略是什么（D3）、PostgreSQL 如何做数据库迁移（D2）。

---

## D1. PostgreSQL 定案与 Docker 集成

### D1.1 为什么直接上 PG
LB 集群要求多节点数据实时一致，SQLite 多节点需自研应用层双向同步（坑深）；PG 一步到位，省一次迁移。**原"SQLite 起步"方案废弃。**

### D1.2 docker-compose（数据库自动安装 + 自动连接 + 自动迁移）

```yaml
services:
  db:                                  # PostgreSQL 自动安装
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: store
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: dshstore
    healthcheck:                       # 健康检查：就绪后才放行后续服务
      test: ["CMD-SHELL", "pg_isready -U store -d dshstore"]
      interval: 5s
      retries: 12

  migrate:                             # 启动时自动执行数据库迁移（跑完即退出）
    build: ./server
    command: node db/migrate.js        # 见 D2
    environment:
      DATABASE_URL: postgres://store:${DB_PASSWORD}@db:5432/dshstore
    depends_on:
      db: { condition: service_healthy }

  api:                                 # 主服务：等迁移完成后才启动 → 连接永远匹配最新表结构
    build: ./server
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: postgres://store:${DB_PASSWORD}@db:5432/dshstore
      # ……其余配置同 v2（GITHUB_TOKENS / JWT_SECRET 等）
    depends_on:
      migrate: { condition: service_completed_successfully }
      redis:   { condition: service_started }

  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]

volumes: { pgdata: {}, redisdata: {} }
```

要点：`docker compose up -d` 一条命令 = 装库 → 等就绪 → 跑迁移 → 起服务，**全自动，无需人工连库**。

---

## D2. PostgreSQL 的数据库迁移（回答"如何迁移"）

### D2.1 什么是迁移（migration）
功能迭代必然改表结构（加列、加表）。做法是把**每次结构变更写成一个带版本号的迁移脚本**，按序执行、记录已执行到第几号：

```
db/migrations/
  001_init.sql            -- 建 plugins / users / combos …
  002_add_star_snapshots.sql
  003_add_federation.sql
  004_add_retention.sql
```

数据库里有一张 `schema_migrations` 表记录已执行的版本号。`migrate.js` 启动时：**查出已执行到 N → 依次执行 N+1、N+2…… → 记录**。重复执行安全（已执行的跳过），新部署/升级都自动追平。

### D2.2 施工约束
- 迁移脚本**只增不随意删**（见 D3 的 expand-contract）；
- 每个脚本放事务里执行，失败整体回滚该脚本；
- 迁移工具选型自由（node-pg-migrate / Prisma Migrate / 手写均可），满足"版本号 + 有序 + 幂等 + 事务"即可。

---

## D3. 回滚策略（回答"是什么意思"）

### D3.1 定义
**回滚 = 新版本上线后发现严重问题，快速恢复到上一个正常版本的能力。** 没回滚策略的上线等于裸奔：出了问题只能现场修，用户全程围观故障。

### D3.2 三个层面各自的回滚

| 层 | 回滚方式 | 成本 |
|---|---|---|
| **服务端应用** | Docker 镜像保留上一版本 tag，出问题 `docker compose up` 切回旧镜像（秒级） | 极低 |
| **客户端插件** | npm 天然多版本，用户可 `npm i 包@旧版本`；商城内安装也锁版本（v3.1 还原点已覆盖用户侧回退） | 低 |
| **数据库** | ⚠️ **真正的难点**：直接"回滚表结构"容易丢数据（比如新版已经往新列写了数据，删掉就没了） | 见 D3.3 |

### D3.3 数据库回滚的正解：先扩后收（expand-contract）
不做"回滚数据库"，而是**让表结构变更始终兼容新旧两版代码**：

```
要改一个字段时，分两步走：
  第一步（扩展）：新版迁移只做"加法"——加新列/新表，旧列保留
        → 此时新旧代码都能跑 → 随便回滚应用都没事
  第二步（收缩）：新版稳定运行一个周期后，再出一个迁移删掉旧列
```

口诀：**应用随便滚，数据库只加不减（确认稳定后才减）**。这就是为什么 D2.2 要求迁移"只增不随意删"。

---

## D4. 数据保留策略（2 天清理 · 可配置 · 磁盘可见）

### D4.1 清理范围划分

| 类别 | 内容 | 保留策略 |
|---|---|---|
| **必要资料（永久保留）** | 插件索引、组、用户、点赞、聚合后的统计、公告、审计日志、安全情报 | 不删 |
| **非必要资料（默认保留 2 天）** | 抓取原始响应缓存、README 原文缓存、请求日志、匿名会话记录、下载**明细**（聚合成天数后明细即删） | 到期自动删 |

### D4.2 机制
- 定时清理任务（默认每日凌晨）删除超过保留期的非必要数据；
- 保留天数**管理端可配置**：`retention.raw_data_days`（默认 2，0 = 永久保留）；
- 每次清理写审计（删了哪类、多少行、释放多少空间）。

### D4.3 磁盘余量可见（用户要求）
- 安全监控页「服务健康」区显示：**数据卷用量 / 总量 / 占比**（容器内读取挂载点）；
- 占比 > 80% 触发告警（复用 v3.2 告警通道）。

### D4.4 备份（演练暂缓，按用户指示）
保留最简自动备份（每日快照到异地/对象存储），恢复演练**本期不做**，仅登记为后续事项。

---

## D5. 配置 / ADR 增补

**配置新增**：`retention.raw_data_days`（默认 2）。
**ADR**：

| 决策 | 结论 | 理由 |
|---|---|---|
| 数据库 | 直接 PostgreSQL 16 | LB 集群一致性的硬要求；Docker 全自动安装连接 |
| 迁移 | 版本号脚本 + 启动自动执行 | 升级零人工；新旧环境表结构始终一致 |
| 回滚 | 应用滚镜像；数据库 expand-contract | 直接回滚表结构会丢数据 |
| 非必要数据 | 默认留 2 天，可配，磁盘可见 | 小机器磁盘是第一死因，主动控制水位 |
| 恢复演练 | 暂缓 | 用户明确指示，登记为后续事项 |
