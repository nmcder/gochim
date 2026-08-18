#!/usr/bin/env node
/**
 * garu-ko 브라우저 실측 하네스 동기화.
 *
 * `tools/probe/`는 형태소 분석기(garu-ko)가 **실제 크롬에서** 로드되는지,
 * 초기화·추론이 몇 ms인지 눈으로 확인하는 자리다.
 * 에셋은 node_modules에서 복제하므로 저장소에 넣지 않는다(.gitignore).
 *
 *   npm run probe:sync
 *   npx vite preview  또는 아무 정적 서버로 tools/probe/ 를 연다
 *
 * ⚠ garu-ko는 **0.9.14로 정확히 고정**되어 있다. 0.9.15는 wasm-compact-imports
 *   제안을 켠 채 빌드돼 플래그 없는 크롬에서 `CompileError: Invalid import kind 127`로
 *   로드 자체가 실패한다. 올리기 전에 반드시 이 하네스로 브라우저 실측을 통과시킬 것.
 */

import { cpSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'node_modules/garu-ko')
const DEST = resolve(ROOT, 'tools/probe')

if (!existsSync(SRC)) {
  console.error('node_modules/garu-ko 가 없습니다. 먼저 `npm install` 을 실행하세요.')
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(resolve(SRC, 'package.json'), 'utf8'))
if (version !== '0.9.14') {
  console.error(`⚠ garu-ko 버전이 ${version} 입니다. 이 프로젝트는 0.9.14로 고정되어 있습니다.`)
  console.error('  0.9.15+ 는 stock 크롬에서 WASM 로드가 실패합니다. package.json의 고정을 확인하세요.')
  process.exit(1)
}

for (const dir of ['pkg', 'models', 'dist']) {
  rmSync(resolve(DEST, dir), { recursive: true, force: true })
  cpSync(resolve(SRC, dir), resolve(DEST, dir), { recursive: true })
}

const size = (p) => `${(statSync(resolve(DEST, p)).size / 1024).toFixed(0)} KB`
console.log(`garu-ko@${version} 에셋을 tools/probe/ 로 복제했습니다.`)
console.log(`  WASM  ${size('pkg/garu_wasm_bg.wasm')}`)
console.log(`  모델  ${size('models/base.gmdl')}`)
console.log('\n정적 서버로 tools/probe/index.html 을 열어 실측하세요.')
