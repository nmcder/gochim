#!/usr/bin/env node
/**
 * 번들 크기를 **잰다.** 적어 두지 않는다.
 *
 *   node scripts/size-report.mjs
 *
 * README에 "gzip 18.5 kB"라고 적혀 있던 적이 있다. 실측은 125 kB였다 — 6.8배.
 * 그 줄은 npm 첫 화면에 박히는 자리였다. 자기가 재고 싶은 수치를 적어 두는 것이
 * 이 저장소가 내내 싸운 병인데, 성적표가 아니라 **배포용 README**에 남아 있었다.
 *
 * 그래서 숫자를 손으로 고치는 대신 부르면 나오게 한다. README에 새 숫자를 적을 때는
 * 이걸 돌려서 나온 값을 그대로 옮긴다.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 자바스크립트 API로 부른다. `.bin` 의 실행 파일을 직접 부르면 윈도에서는
// 확장자 없는 쪽이 셸 스크립트라 spawn 이 ENOENT 로 끝난다.
let esbuild
try {
  esbuild = await import('esbuild')
} catch {
  console.error('esbuild가 없다. `npm install` 을 먼저 돌릴 것.')
  process.exit(1)
}

/** 1 kB = 1,000바이트로 센다. esbuild가 찍는 "kb"는 1,024바이트라 서로 다르다. */
const kB = (bytes) => `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} kB`

const targets = [
  { name: '@gochim/core', entry: 'packages/core/dist/index.js' },
  { name: '@gochim/store', entry: 'packages/store/dist/index.js' },
]

console.log()
console.log('고침 — 번들 크기 (esbuild --bundle --minify, ESM, es2022)')
console.log('='.repeat(60))

let missing = 0
for (const t of targets) {
  const entry = resolve(ROOT, t.entry)
  if (!existsSync(entry)) {
    console.log(`  ! ${t.name} — 빌드가 없다 (npm run build)`)
    missing += 1
    continue
  }
  const built = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    write: false,
  })
  const bytes = built.outputFiles[0].contents
  console.log(`  ${t.name.padEnd(16)} minified ${kB(bytes.length).padStart(9)}   gzip ${kB(gzipSync(bytes, { level: 9 }).length).padStart(9)}`)
}

// 형태소 층은 코드가 아니라 에셋이 크다. 번들러로 재면 실제로 받는 양을 못 잰다.
const wasm = resolve(ROOT, 'node_modules/garu-ko/pkg/garu_wasm_bg.wasm')
const model = resolve(ROOT, 'node_modules/garu-ko/models/base.gmdl')
if (existsSync(wasm) && existsSync(model)) {
  const w = readFileSync(wasm).length
  const m = readFileSync(model).length
  console.log(`  ${'@gochim/morph'.padEnd(16)} WASM ${kB(w).padStart(13)}   모델 ${kB(m).padStart(9)}   합계 ${kB(w + m)}`)
}

console.log('='.repeat(60))
console.log('  README의 숫자는 이 값을 그대로 옮긴 것이어야 한다.')
console.log()

process.exit(missing > 0 ? 1 : 0)
