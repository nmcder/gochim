#!/usr/bin/env node
/**
 * 성능 측정.
 *
 * 교정기는 **타이핑 중에** 돌아야 한다. 그래서 재는 값은 "초당 몇 자"가 아니라
 * "한 번 검사에 몇 ms"다. 사람이 눈치채는 경계는 대략 16ms(한 프레임)다.
 *
 *   npm run bench
 *   npm run bench -- --morph
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { check } = await import(pathToFileURL(resolve(ROOT, 'packages/core/dist/index.js')).href)

const useMorph = process.argv.includes('--morph')
let analyzer = null
let initMs = 0
if (useMorph) {
  const { createAnalyzer } = await import(pathToFileURL(resolve(ROOT, 'packages/morph/dist/index.js')).href)
  const started = performance.now()
  analyzer = await createAnalyzer()
  initMs = performance.now() - started
}
const options = analyzer ? { analyzer } : {}

// 골든셋 문장을 이어 붙여 실제 글에 가까운 표본을 만든다.
const golden = JSON.parse(readFileSync(resolve(ROOT, 'data/golden/golden.json'), 'utf8'))
const sentences = [...golden.cases.map((c) => c.wrong), ...golden.negatives.map((n) => n.text)]

function corpus(targetLength) {
  let text = ''
  let i = 0
  while (text.length < targetLength) {
    text += `${sentences[i % sentences.length]} `
    i += 1
  }
  return text.slice(0, targetLength)
}

function measure(text, rounds) {
  // 워밍업 — 첫 호출은 JIT 때문에 느리다.
  for (let i = 0; i < (analyzer ? 1 : 3); i += 1) check(text, options)
  const samples = []
  for (let i = 0; i < rounds; i += 1) {
    const started = performance.now()
    check(text, options)
    samples.push(performance.now() - started)
  }
  samples.sort((a, b) => a - b)
  return {
    median: samples[Math.floor(samples.length / 2)],
    p95: samples[Math.floor(samples.length * 0.95)],
    min: samples[0],
  }
}

console.log(`\n고침 성능 측정${useMorph ? '  [1층 + 형태소 3층]' : '  [1층만]'}`)
console.log('='.repeat(62))
if (useMorph) console.log(`분석기 초기화  ${initMs.toFixed(0)}ms  (한 번만)\n`)
console.log('  글자수      중앙값      p95      오류수   1000자당')
console.log('  '.padEnd(2) + '-'.repeat(56))

for (const size of [200, 1000, 4000, 20000]) {
  const text = corpus(size)
  // 형태소 층은 한 번이 훨씬 비싸다. 회차를 줄여도 중앙값은 충분히 안정적이다.
  const rounds = analyzer ? (size > 10000 ? 3 : 20) : size > 10000 ? 20 : 200
  const { median, p95 } = measure(text, rounds)
  const found = check(text, options).length
  console.log(
    `  ${String(size).padStart(6)}  ${median.toFixed(2).padStart(9)}ms ${p95.toFixed(2).padStart(8)}ms ` +
      `${String(found).padStart(8)}  ${((median / size) * 1000).toFixed(2).padStart(8)}ms`,
  )
}

console.log('\n비교 기준: 한 프레임 = 16.7ms. 확장은 여기에 300ms 디바운스와')
console.log('4,000자 창(window)까지 더해 타이핑을 막지 않는다.')
if (analyzer) analyzer.destroy()
console.log()
