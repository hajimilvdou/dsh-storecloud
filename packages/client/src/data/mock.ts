import type {
  Announcement,
  Combo,
  Delta,
  Manifest,
  Plugin,
  ServerSource,
} from '@dsh-store/shared'
import { PROTOCOL_VERSION } from '@dsh-store/shared'
import type { DataSource } from './source.js'

/**
 * Mock 数据源：与原型 dsh-store-ui-prototype.html 的演示数据对齐。
 * 用于「客户端优先」阶段在无服务端时跑通全链路；接入真实服务端后替换为 HttpDataSource。
 */

/* [name, description, stars, stars_delta_day, likes, source, is_new] */
type RawPlugin = [string, string, number, number, number, string, number]

const RAW_PLUGINS: RawPlugin[] = [
  ['dsh-memory', '为 Agent 提供持久化记忆与跨会话召回，支持本地向量存储，开箱即用。', 2841, 213, 96, '官方', 1],
  ['dsh-web-ui', '第三方增强 Web 界面：任务面板、Git 图、文件树预览一网打尽。', 2312, 187, 121, '社区', 0],
  ['dsh-cc-tui', 'Claude Code 风格全屏终端 UI，npm 一键安装，键盘党福音。', 1976, 164, 58, '社区', 0],
  ['dsh-browser-panel', '内嵌浏览器面板，让 Agent 边看网页边操作，支持截图回传。', 1654, 142, 77, '社区', 0],
  ['dsh-checkpoint', '会话检查点与一键回滚，Agent 改崩了也能秒级恢复现场。', 1522, 121, 64, '官方', 0],
  ['dsh-deep-research', '多步深度研究插件：自动检索、交叉验证、输出带引用的报告。', 1387, 118, 83, '社区', 1],
  ['dsh-vision', '为纯文本模型补上眼睛：OCR、图像问答、UI 截图理解。', 1290, 102, 45, '社区', 0],
  ['dsh-session-search', '全文检索历史会话，按工具调用/文件/错误信息精准定位。', 1108, 97, 39, '社区', 0],
  ['dsh-skins', 'WebUI 换肤中心，十余套主题一键切换，支持自定义 CSS。', 987, 88, 52, '社区', 0],
  ['dsh-tool-regex', '零依赖正则工具箱：匹配、替换、提取，附带常用规则库。', 876, 79, 31, '社区', 0],
  ['dsh-pet', '桌面宠物常驻 WebUI 角落，会随任务进度做表情，摸鱼伴侣。', 812, 74, 66, '社区', 0],
  ['dsh-auto-chess', '自走棋小游戏插件，跑长任务时来一局，内置排行榜。', 764, 69, 88, '社区', 0],
  ['dsh-data-agent', '连接数据库/CSV 的数据分析 Agent 技能包，自动生成图表。', 701, 63, 42, '社区', 0],
  ['dsh-a2a', 'Agent 网格通信协议实现，多 Agent 协同编排的基础设施。', 655, 57, 25, '官方', 0],
  ['dsh-rewind', '时间旅行调试：回放任意一步上下文注入，精确定位幻觉来源。', 598, 52, 34, '社区', 0],
  ['dsh-kimi-browser', 'Kimi 浏览器自动化桥接，网页抓取与表单填写一气呵成。', 540, 47, 29, '社区', 0],
  ['dsh-tool-diff', '文件/目录差异对比工具，支持语法高亮与三方合并视图。', 489, 41, 18, '社区', 0],
  ['dsh-session-hub', '会话共享中心：把一次成功的 Agent 轨迹分享给团队复用。', 431, 36, 22, '社区', 0],
  ['dsh-tool-encoding', '编码探测与转换全家桶，GBK/UTF-8/BOM 问题一键解决。', 388, 31, 15, '社区', 0],
  ['dsh-gomoku', '五子棋人机对战插件，内置三种难度，支持让子。', 342, 27, 49, '社区', 0],
]

const MOCK_AUTHORS: Record<string, string> = {
  'dsh-memory': 'liwei',
  'dsh-web-ui': 'xiaoyu',
  'dsh-cc-tui': 'vim_rock',
  'dsh-browser-panel': 'datasci_hao',
  'dsh-checkpoint': 'liwei',
  'dsh-deep-research': 'datasci_hao',
  'dsh-vision': 'xiaoyu',
  'dsh-session-search': 'liwei',
  'dsh-skins': 'xiaoyu',
  'dsh-tool-regex': 'vim_rock',
  'dsh-pet': 'xiaoyu',
  'dsh-auto-chess': 'gamer_wang',
  'dsh-data-agent': 'datasci_hao',
  'dsh-a2a': 'liwei',
  'dsh-rewind': 'liwei',
  'dsh-kimi-browser': 'datasci_hao',
  'dsh-tool-diff': 'vim_rock',
  'dsh-session-hub': 'liwei',
  'dsh-tool-encoding': 'vim_rock',
  'dsh-gomoku': 'gamer_wang',
}

export const MOCK_PLUGINS: Plugin[] = RAW_PLUGINS.map(
  ([id, description, stars, stars_delta_day, likes, src, isNew], i) => ({
    id,
    kind: 'plugin' as const,
    version: '1.0.0',
    name: id,
    description,
    repo: `dsh-store/${id}`,
    repo_url: `https://github.com/dsh-store/${id}`,
    author: MOCK_AUTHORS[id] ?? '',
    source: src === '官方' ? 'official' : 'community',
    stars,
    stars_delta_day,
    stars_delta_7d: Math.round(stars_delta_day * 4.6),
    trending_rank: i < 20 ? i + 1 : null,
    likes,
    downloads_7d: Math.round(stars * 0.31),
    quality_score: Math.max(38, 92 - i * 3),
    tags: [],
    compat: 'dsh ≥0.1.0-rc.5',
    install: `github:dsh-store/${id}`,
    is_new: isNew === 1,
    security: { level: 2, score: 90 + (i % 10), risk_tags: [], blocked: false },
    status: 'listed',
    updated_at: '2026-08-14T00:00:00Z',
  }),
)

// Agent（Preset）演示数据：kind=preset，安装方式为文件复制到 .agent-presets/
MOCK_PLUGINS.push(
  {
    id: 'creator-agent',
    kind: 'preset',
    preset_name: 'creator',
    version: '1.0.0',
    name: '创造模式 Agent',
    description: '以创作者视角组织的 Agent 预设：包含创作工作流、灵感管理与发布流程。安装后重启 DSH，在新建空白会话时选择 creator 预设。',
    repo: 'dsh-store/creator-agent',
    repo_url: 'https://github.com/dsh-store/creator-agent',
    author: 'liwei',
    source: 'community',
    stars: 1388,
    stars_delta_day: 55,
    stars_delta_7d: 253,
    trending_rank: null,
    likes: 42,
    downloads_7d: 331,
    quality_score: 88,
    tags: ['agent', 'preset'],
    compat: 'DSH 预设（重启后新建空白会话选择）',
    install: 'preset:creator',
    is_new: false,
    security: { level: 0, score: 95, risk_tags: [], blocked: false },
    status: 'listed',
    updated_at: '2026-08-14T00:00:00Z',
  },
  {
    id: 'minimal-agent',
    kind: 'preset',
    preset_name: 'minimal',
    version: '1.0.0',
    name: '极简模式 Agent',
    description: '只挂载最基础的模型与工具，适合快速问答和轻量任务。复制到 .agent-presets/minimal 后重启 DSH 生效。',
    repo: 'dsh-store/minimal-agent',
    repo_url: 'https://github.com/dsh-store/minimal-agent',
    author: 'xiaoyu',
    source: 'community',
    stars: 764,
    stars_delta_day: 28,
    stars_delta_7d: 129,
    trending_rank: null,
    likes: 19,
    downloads_7d: 208,
    quality_score: 82,
    tags: ['agent', 'preset'],
    compat: 'DSH 预设（重启后新建空白会话选择）',
    install: 'preset:minimal',
    is_new: false,
    security: { level: 0, score: 96, risk_tags: [], blocked: false },
    status: 'listed',
    updated_at: '2026-08-14T00:00:00Z',
  },
)

/* [name, description, members[], likes, downloads_7d, author] */
type RawCombo = [string, string, string[], number, number, string]

const RAW_COMBOS: RawCombo[] = [
  ['新手启航包', '刚装 dsh 闭眼入：记忆 + 检查点 + 会话搜索，日常开发三件套。', ['dsh-memory', 'dsh-checkpoint', 'dsh-session-search'], 486, 1203, 'liwei'],
  ['前端摸鱼套装', '增强界面 + 换肤 + 桌宠，让你的 dsh 好看又好玩。', ['dsh-web-ui', 'dsh-skins', 'dsh-pet'], 352, 891, 'xiaoyu'],
  ['深度研究工位', '检索、浏览、出报告一条龙，调研类任务直接起飞。', ['dsh-deep-research', 'dsh-browser-panel', 'dsh-data-agent'], 297, 764, 'datasci_hao'],
  ['终端极客包', 'TUI + 正则 + diff + 编码，纯键盘流的全套装备。', ['dsh-cc-tui', 'dsh-tool-regex', 'dsh-tool-diff', 'dsh-tool-encoding'], 188, 502, 'vim_rock'],
]

export const MOCK_COMBOS: Combo[] = RAW_COMBOS.map(
  ([name, description, members, likes, downloads_7d, author], i) => ({
    id: `blog.1qwq1.top:combo_${i + 1}`,
    slug: name,
    name,
    description,
    members: members.map((pkg) => ({ pkg, version: '*', install_mode: 'auto' as const })),
    author,
    author_github: author,
    likes,
    downloads_7d,
    status: 'published',
    origin_server: 'blog.1qwq1.top',
    version: 1,
    updated_at: '2026-08-14T00:00:00Z',
  }),
)

/* [version, level, content, published_at, origin_server] */
const RAW_ANNOS: [string, string, string, string, string][] = [
  ['v0.3.0', 'imp', '新增「今日星增 Top 20」趋势榜；面板支持拖拽缩放与明暗主题；非 WebUI 环境新增地址模式。', '2026-08-14', '官方源'],
  ['v0.2.1', 'inf', '修复组合安装时版本锁定的边界问题；本地索引构建提速约 40%。', '2026-08-10', '官方源'],
  ['v1.1-m', 'inf', '【mirror-01.cn】节点公告：本周六凌晨例行维护，期间可自动切换至官方源，数据无差别。', '2026-08-12', 'mirror-01.cn'],
  ['v0.2.0', 'inf', '组合功能上线：创建、一键安装、点赞；每用户上限 3 个组合。', '2026-08-05', '官方源'],
]

export const MOCK_ANNOS: Announcement[] = RAW_ANNOS.map(
  ([version, level, content, published_at, origin_server], i) => ({
    id: `anno_${i + 1}`,
    version,
    level: level === 'imp' ? 'important' : 'info',
    content,
    published_at,
    origin_server,
  }),
)

export const MOCK_SOURCES: ServerSource[] = [
  { id: 'official', name: '官方源', url: 'https://blog.1qwq1.top', builtin: true, enabled: true, latency_ms: 18, cluster_id: 'lb-official', is_lb: false, last_seen_at: '2026-08-14T00:00:00Z', role: 'primary', status: 'connected' },
  { id: 'mirror-01', name: 'mirror-01.cn', url: 'mirror-01.cn', builtin: false, enabled: true, latency_ms: 12, cluster_id: 'lb-official', is_lb: true, last_seen_at: '2026-08-14T00:00:00Z', role: 'backup', status: 'connected' },
  { id: 'mirror-02', name: 'mirror-02.cn', url: 'mirror-02.cn', builtin: false, enabled: true, latency_ms: 23, cluster_id: 'lb-official', is_lb: true, last_seen_at: '2026-08-14T00:00:00Z', role: 'backup', status: 'connected' },
  { id: 'store-friend', name: 'store-friend.com', url: 'store-friend.com', builtin: false, enabled: false, latency_ms: null, cluster_id: null, is_lb: false, last_seen_at: null, role: 'backup', status: 'disconnected' },
  { id: 'legacy', name: 'legacy-store.net', url: 'legacy-store.net', builtin: false, enabled: false, latency_ms: null, cluster_id: null, is_lb: false, last_seen_at: '2026-08-10T00:00:00Z', role: 'backup', status: 'unreachable' },
]

/** Mock 数据源：立即返回内存数据，模拟零网络延迟。 */
export class MockDataSource implements DataSource {
  id = 'official'
  name = '官方源（mock）'

  async latencyMs(): Promise<number> {
    return 18
  }

  async fetchManifest(): Promise<Manifest> {
    return {
      protocol_version: PROTOCOL_VERSION,
      software_version: '0.3.0',
      cluster_id: 'lb-official',
      server_time: new Date().toISOString(),
      plugins_revision: 'mock-1',
      combos_revision: 'mock-1',
      latest_announcement_id: MOCK_ANNOS[0]?.id ?? null,
      features: { trending: true, likes: true, combos: true, announcements: true, federation: true },
      nodes: MOCK_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        rtt_ms: s.latency_ms,
        healthy: s.enabled,
        is_lb: s.is_lb,
      })),
      client_plugin: { version: '0.3.0', install: 'github:dsh-store/dsh-store' },
      client_config: {
        trending_size: 20,
        search_threshold: 0,
        onboarding_auto_open_times: 3,
        server_local_port: 0,
        ui_default_theme: 'system',
        ui_window_min: [360, 480],
        ui_window_max: [720, 900],
        data_heartbeat_min: 30,
        combos_refresh_min: 30,
        restore_max_points: 10,
        combo_limit: 3,
      },
    }
  }

  async fetchPlugins(since?: string): Promise<Delta<Plugin>> {
    const full = !since || since === 'mock-1'
    return { revision: 'mock-1', items: full ? MOCK_PLUGINS : [], full, tombstones: [] }
  }

  async fetchCombos(since?: string): Promise<Delta<Combo>> {
    const full = !since || since === 'mock-1'
    return { revision: 'mock-1', items: full ? MOCK_COMBOS : [], full, tombstones: [] }
  }

  async fetchAnnouncements(): Promise<Announcement[]> {
    return MOCK_ANNOS
  }

  async listNodes(): Promise<ServerSource[]> {
    return MOCK_SOURCES
  }

  async reportInstall(_target: string): Promise<void> {
    /* mock 数据源无服务端，计数上报跳过 */
  }
}
