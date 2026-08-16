#!/usr/bin/env node
/**
 * dsh-storecloud 构建脚本（统一仓库：源码在 packages/，产物在 lib/ + preview/）
 *   1. npm run build --workspaces（tsc 编译 packages/shared + packages/client → dist）；
 *   2. 用 esbuild 打包客户端预览 UI（packages/client/dist/preview.js → preview/preview.js）；
 *   3. 语法检查 lib/ 两个半（host + client）。
 * 用法：npm install && npm run build
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

console.log('[build] 统一仓库构建：', root)

// 1) tsc 编译 shared + client（workspaces）
execFileSync('npm', ['run', 'build', '--workspaces'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
console.log('[build] tsc 编译完成（packages/shared + packages/client）')

// 2) esbuild 打包 preview（入口 = 编译产物 packages/client/dist/preview.js）
const require = createRequire(import.meta.url)
let esbuild
try {
  esbuild = require('esbuild')
} catch (e) {
  esbuild = require(join(root, 'node_modules', 'esbuild'))
}
const entry = join(root, 'packages', 'client', 'dist', 'preview.js')
if (!existsSync(entry)) {
  console.error('[build] 找不到入口:', entry, '（先 cd dsh-storecloud && npm install）')
  process.exit(1)
}
mkdirSync(join(root, 'preview'), { recursive: true })
const out = join(root, 'preview', 'preview.js')
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  outfile: out,
})
const size = readFileSync(out, 'utf8').length
console.log(`[build] preview 打包完成: preview/preview.js (${size} bytes)`)

// 3) 语法检查
for (const f of ['lib/index.js', 'lib/client.js']) {
  execFileSync(process.execPath, ['--check', join(root, f)], { stdio: 'inherit' })
  console.log(`[build] 语法检查通过: ${f}`)
}
console.log('[build] 完成。npm pack 可产出发布 tarball（仅 lib/preview/cordis.patch.yml/README/LICENSE）。')
