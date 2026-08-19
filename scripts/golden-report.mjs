#!/usr/bin/env node
/**
 * 골든 테스트셋 성적표.
 *
 * 테스트는 합격/불합격만 말한다. 이 스크립트는 **어디서 얼마나 놓치고 있는지**를
 * 분류별로 보여 준다. 다음에 만들 규칙을 고르는 근거가 된다.
 *
 *   npm run golden:report
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { check: rawCheck, fix: rawFix } = await import(pathToFileURL(resolve(ROOT, 'packages/core/dist/index.js')).href)

// --morph: 형태소 층(3층)까지 켜고 잰다. 끄고 잰 값과 나란히 보면 층별 기여가 드러난다.
const useMorph = process.argv.includes('--morph')
let analyzer = null
if (useMorph) {
  const { createAnalyzer } = await import(pathToFileURL(resolve(ROOT, 'packages/morph/dist/index.js')).href)
  analyzer = await createAnalyzer()
}
const options = analyzer ? { analyzer } : {}
const check = (t) => rawCheck(t, options)
const fix = (t) => rawFix(t, options)

const golden = JSON.parse(readFileSync(resolve(ROOT, 'data/golden/golden.json'), 'utf8'))
const overlaps = (d, s) => d.start < s.end && s.start < d.end

const byCluster = new Map()
const pick = (key) => {
  if (!byCluster.has(key)) byCluster.set(key, { spans: 0, hit: 0, fp: 0, exact: 0, cases: 0 })
  return byCluster.get(key)
}

const falsePositives = []
const warnings = []
const misses = []
let tp = 0

for (const c of golden.cases) {
  const bucket = pick(c.cluster)
  bucket.cases += 1
  bucket.spans += c.spans.length

  const diagnostics = check(c.wrong)
  const covered = new Set()
  for (const d of diagnostics) {
    const index = c.spans.findIndex((s) => overlaps(d, s))
    if (index === -1) {
      bucket.fp += 1
      falsePositives.push({ sentence: c.wrong, rule: d.ruleId, text: d.text })
    } else {
      covered.add(index)
      bucket.hit += 1
      tp += 1
    }
  }
  c.spans.forEach((span, index) => {
    if (!covered.has(index)) misses.push({ id: c.id, cluster: c.cluster, sentence: c.wrong, span })
  })
  if (fix(c.wrong) === c.right) bucket.exact += 1
}

const cleanSentences = [...new Set(golden.cases.map((c) => c.right)), ...golden.negatives.map((n) => n.text)]
for (const sentence of cleanSentences) {
  // 경고는 "이게 틀렸다"가 아니라 "원칙은 이쪽이다"라는 안내다.
    // 오탐으로 세면 규정이 허용하는 표기를 알려 주는 일 자체가 불가능해진다.
    for (const d of check(sentence)) {
      if (d.severity === 'warning') { warnings.push({ sentence, rule: d.ruleId, text: d.text }); continue }
      falsePositives.push({ sentence, rule: d.ruleId, text: d.text, clean: true })
    }
}

const precision = tp / Math.max(1, tp + falsePositives.length)
const recall = tp / Math.max(1, tp + misses.length)

console.log('\n고침 골든 테스트셋 성적표')
console.log('='.repeat(64))
console.log(
  `표본  오류 문장 ${golden.cases.length} · 오류 구간 ${golden.counts.spans} · ` +
    `정상 문장 ${cleanSentences.length} (정답 ${golden.counts.rightSentences} + 함정 ${golden.negatives.length})`,
)
console.log(`정밀도 ${precision.toFixed(4)}   재현율 ${recall.toFixed(4)}   오탐 ${falsePositives.length}건` + (warnings.length ? `   경고 ${warnings.length}건` : ''))
console.log('='.repeat(64))

console.log('\n분류별')
const rows = [...byCluster.entries()].sort((a, b) => b[1].spans - a[1].spans)
for (const [cluster, v] of rows) {
  const rate = v.spans === 0 ? 0 : v.hit / v.spans
  const bar = '█'.repeat(Math.round(rate * 20)).padEnd(20, '·')
  console.log(
    `  ${cluster.padEnd(12)} ${bar} ${(rate * 100).toFixed(0).padStart(3)}%  ` +
      `(${v.hit}/${v.spans})  문장 완전교정 ${v.exact}/${v.cases}${v.fp ? `  오탐 ${v.fp}` : ''}`,
  )
}

if (falsePositives.length > 0) {
  console.log(`\n오탐 ${falsePositives.length}건 — 규칙을 좁혀야 한다`)
  for (const fp of falsePositives.slice(0, 25)) {
    console.log(`  [${fp.rule}] "${fp.text}"${fp.clean ? ' (정상 문장!)' : ''}\n      ${fp.sentence}`)
  }
}

console.log(`\n아직 못 잡는 오류 ${misses.length}건 — 다음 규칙 후보`)
const byHint = new Map()
for (const m of misses) {
  const hint = (m.span.ruleHint || '기타').split('|')[0]
  byHint.set(hint, [...(byHint.get(hint) ?? []), m])
}
for (const [hint, items] of [...byHint.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(items.length).padStart(3)}건  ${hint}`)
  console.log(`         예) ${items[0].span.wrong} → ${items[0].span.right}   «${items[0].sentence}»`)
}
if (analyzer) analyzer.destroy()
console.log()
