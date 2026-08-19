#!/usr/bin/env node
/**
 * 확장 빌드.
 *
 * Vite 대신 esbuild를 직접 부른다. 이유가 있다 —
 * 콘텐츠 스크립트는 **ESM이 될 수 없어서**(MV3는 content script의 type: module을 지원하지 않는다)
 * IIFE로 뽑아야 하고, 서비스 워커와 설정 화면은 ESM이어야 한다.
 * 한 도구에 서로 다른 출력 형식 세 개를 시키느니 esbuild를 세 번 부르는 편이 짧고 분명하다.
 *
 *   node build.mjs            # dist/ 에 빌드
 *   node build.mjs --watch    # 고칠 때마다 다시 빌드
 */

import { context, build as esbuild } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const REPO = resolve(ROOT, '../..')
const OUT = resolve(ROOT, 'dist')
const watch = process.argv.includes('--watch')

/** 워크스페이스 패키지는 소스를 직접 본다. 빌드 순서를 신경 쓸 일이 없어진다. */
const alias = {
  '@gochim/core': resolve(REPO, 'packages/core/src/index.ts'),
  '@gochim/store': resolve(REPO, 'packages/store/src/index.ts'),
  '@gochim/morph': resolve(REPO, 'packages/morph/src/index.ts'),
}

const common = {
  bundle: true,
  target: 'chrome110',
  platform: 'browser',
  alias,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
}

const targets = [
  // 콘텐츠 스크립트 — MV3에서 모듈이 될 수 없으므로 IIFE.
  { entryPoints: [resolve(ROOT, 'src/content/index.ts')], outfile: resolve(OUT, 'content.js'), format: 'iife' },
  { entryPoints: [resolve(ROOT, 'src/background.ts')], outfile: resolve(OUT, 'background.js'), format: 'esm' },
  { entryPoints: [resolve(ROOT, 'src/options/index.ts')], outfile: resolve(OUT, 'options.js'), format: 'esm' },
  { entryPoints: [resolve(ROOT, 'src/popup/index.ts')], outfile: resolve(OUT, 'popup.js'), format: 'esm' },
  // 형태소 워커는 garu/ 안에 둔다. WASM과 모델을 바로 옆에 놓기 위해서다.
  {
    entryPoints: [resolve(ROOT, 'src/worker/morph-worker.ts')],
    outfile: resolve(OUT, 'garu/morph-worker.js'),
    format: 'esm',
  },
]

function copyStatic() {
  mkdirSync(OUT, { recursive: true })
  cpSync(resolve(ROOT, 'public'), OUT, { recursive: true })
  cpSync(resolve(ROOT, 'manifest.json'), resolve(OUT, 'manifest.json'))
  cpSync(resolve(ROOT, 'src/content/content.css'), resolve(OUT, 'content.css'))

  // garu-ko의 WASM과 모델을 워커 옆으로 복제한다.
  // wasm-bindgen 글루가 자기 옆에서 .wasm을 찾고, 워커는 모델 URL을 명시적으로 넘긴다.
  const garu = resolve(REPO, 'node_modules/garu-ko')
  mkdirSync(resolve(OUT, 'garu'), { recursive: true })
  cpSync(resolve(garu, 'pkg/garu_wasm_bg.wasm'), resolve(OUT, 'garu/garu_wasm_bg.wasm'))
  cpSync(resolve(garu, 'models/base.gmdl'), resolve(OUT, 'garu/base.gmdl'))
}

function report() {
  const manifest = JSON.parse(readFileSync(resolve(OUT, 'manifest.json'), 'utf8'))
  const files = ['content.js', 'background.js', 'options.js', 'popup.js', 'content.css', 'garu/morph-worker.js']
  const total = files.reduce((sum, file) => sum + statSync(resolve(OUT, file)).size, 0)
  console.log(`\n고침 확장 v${manifest.version}`)
  for (const file of files) console.log(`  ${file.padEnd(16)} ${(statSync(resolve(OUT, file)).size / 1024).toFixed(1)} kB`)
  console.log(`  ${'합계'.padEnd(15)} ${(total / 1024).toFixed(1)} kB`)
  const assets = ['garu/garu_wasm_bg.wasm', 'garu/base.gmdl']
  for (const file of assets) console.log(`  ${file.padEnd(16)} ${(statSync(resolve(OUT, file)).size / 1024).toFixed(0)} kB  (켠 사람만 내려받음)`)
  console.log(`  권한             ${manifest.permissions.join(', ')} (네트워크 권한 없음)`)
  console.log(`\n크롬에서 불러오기: chrome://extensions → 개발자 모드 → '압축해제된 확장 프로그램을 로드' → ${OUT}`)
}

rmSync(OUT, { recursive: true, force: true })
copyStatic()

if (watch) {
  for (const target of targets) {
    const ctx = await context({ ...common, ...target })
    await ctx.watch()
  }
  console.log('감시 중… (Ctrl+C로 종료)')
} else {
  await Promise.all(targets.map((target) => esbuild({ ...common, ...target })))
  report()
}
