#!/usr/bin/env node
/**
 * dsh-storecloud 构建脚本：
 *   1. （可选）在 ../dsh-store 工作区执行 npm run build（tsc 编译 shared + client）；
 *   2. 用 esbuild 打包客户端预览 UI（packages/client/dist/preview.js → preview/preview.js）；
 *   3. 复制 preview.html；
 *   4. 语法检查 lib/ 两个半。
 * 用法：npm run build（在 dsh-storecloud 目录）；DSH_STORE_SRC 可指向 dsh-store 工作区路径。
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const storeSrc = resolve(process.env.DSH_STORE_SRC || join(root, '..', 'dsh-store'))

console.log('[build] 源工作区:', storeSrc)

// 1) 编译客户端源码（tsc）
try {
  execFileSync('npm', ['run', 'build'], { cwd: storeSrc, stdio: 'inherit', shell: process.platform === 'win32' })
  console.log('[build] tsc 编译完成')
} catch (e) {
  console.error('[build] tsc 编译失败（若已有产物可继续）:', String((e && e.message) || e))
}

// 2) esbuild 打包 preview（入口 = 编译产物 packages/client/dist/preview.js）
const require = createRequire(import.meta.url)
let esbuild
try {
  esbuild = require('esbuild')
} catch (e) {
  esbuild = require(join(storeSrc, 'node_modules', 'esbuild'))
}
const entry = join(storeSrc, 'packages', 'client', 'dist', 'preview.js')
if (!existsSync(entry)) {
  console.error('[build] 找不到入口:', entry, '（先 cd dsh-store && npm install && npm run build）')
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
copyFileSync(join(storeSrc, 'preview.html'), join(root, 'preview', 'preview.html'))
const size = readFileSync(out, 'utf8').length
console.log(`[build] preview 打包完成: preview/preview.js (${size} bytes)`)

// 3) 语法检查
for (const f of ['lib/index.js', 'lib/client.js']) {
  execFileSync(process.execPath, ['--check', join(root, f)], { stdio: 'inherit' })
  console.log(`[build] 语法检查通过: ${f}`)
}
console.log('[build] 完成。npm pack 可产出发布 tarball。')
