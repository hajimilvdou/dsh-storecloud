// 搜索专项检测：mock 数据 + 真实服务端数据（名称/简介/作者/仓库 + 错拼容错 + 中文）
import { searchPlugins } from './packages/client/dist/core/index.js'
import { MOCK_PLUGINS } from './packages/client/dist/data/mock.js'

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`)
  if (!ok) failed++
}
const ids = (r, n = 5) => r.slice(0, n).map((x) => x.id).join(',')

// ---------- mock 数据 ----------
check('mock：名称子串 memory', searchPlugins(MOCK_PLUGINS, 'memory').some((p) => p.id === 'dsh-memory'))
check('mock：中文简介「记忆」', searchPlugins(MOCK_PLUGINS, '记忆').some((p) => p.id === 'dsh-memory'))
check('mock：错拼 memry 容错', searchPlugins(MOCK_PLUGINS, 'memry').some((p) => p.id === 'dsh-memory'))
const byAuthor = searchPlugins(MOCK_PLUGINS, 'liwei')
check('mock：按作者 liwei', byAuthor.length >= 5 && byAuthor.every((p) => p.author === 'liwei'), ids(byAuthor))
check('mock：按仓库 dsh-store/dsh-skins', searchPlugins(MOCK_PLUGINS, 'dsh-store/dsh-skins').some((p) => p.id === 'dsh-skins'))
check('mock：空查询返回全部', searchPlugins(MOCK_PLUGINS, '').length === MOCK_PLUGINS.length)

// ---------- 真实服务端数据 ----------
const res = await fetch('http://127.0.0.1:8080/api/v1/plugins')
const data = await res.json()
const live = data.items.map((p) => ({ id: p.id, name: p.name, description: p.description, tags: p.tags, repo: p.repo, author: p.author, install: p.install }))
check('真实数据已就绪', live.length > 0, `items=${live.length}`)

check('真实：名称子串 open', searchPlugins(live, 'open').some((p) => p.id === 'open-design'))
const byAuthorLive = searchPlugins(live, 'nexu-io')
check('真实：按作者/仓库 nexu-io', byAuthorLive.length > 0 && byAuthorLive.every((p) => (p.author || '').includes('nexu-io') || (p.repo || '').includes('nexu-io')), ids(byAuthorLive))
check('真实：错拼 desgin 容错→open-design', searchPlugins(live, 'desgin').some((p) => p.id === 'open-design'))
check('真实：空查询返回全部', searchPlugins(live, '').length === live.length)
const noHit = searchPlugins(live, 'zzzz不存在的关键词qqq')
check('真实：无关关键词返回空（不乱匹配）', noHit.length === 0, ids(noHit))

console.log(failed === 0 ? '\n全部通过 ✅（搜索专项检测）' : `\n${failed} 项失败 ❌`)
process.exitCode = failed === 0 ? 0 : 1
