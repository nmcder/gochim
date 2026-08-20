#!/usr/bin/env node
/**
 * 지켜야 할 선을 한 번에 확인한다.
 *
 * 규칙을 더할 때 가장 흔한 사고는 **재현율을 올리면서 정밀도를 깨뜨리는 것**이다.
 * 성적표를 따로따로 돌리면 그 순간을 놓치기 쉬워서, 넘으면 안 되는 선을 여기 못 박는다.
 *
 *   node scripts/guard.mjs
 *
 * 하나라도 어기면 종료 코드 1로 끝난다.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../packages/core/dist/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))

/** 경고는 "이게 틀렸다"가 아니라 "원칙은 이쪽이다"라는 안내라 오탐으로 세지 않는다. */
const errorsOf = (text) => check(text).filter((d) => d.severity !== 'warning')

const golden = read('data/golden/golden.json')
const prose = read('data/golden/prose.json')
const corpus = read('data/golden/corpus.json')

const lines = []
let failed = 0

function must(label, ok, detail) {
  lines.push(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed += 1
}

/* ── 1. 정상 문장에 오류 밑줄이 그이지 않는가 ────────────────── */

const clean = [
  ...new Set([
    ...golden.cases.map((c) => c.right),
    ...golden.negatives.map((n) => (typeof n === 'string' ? n : n.text)),
    ...prose.paragraphs.map((p) => p.corrected),
    ...corpus.texts.flatMap((t) => t.corrected.split(/\n+/).flatMap((l) => l.split(/(?<=[.!?])\s+/))),
  ]),
].filter((s) => s && s.trim().length > 4)

const falsePositives = []
for (const sentence of clean) {
  for (const d of errorsOf(sentence)) falsePositives.push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence.slice(0, 50)}`)
}
must(`정상 문장 ${clean.length}개에 오류 0건`, falsePositives.length === 0, `오탐 ${falsePositives.length}건`)

/* ── 2. 규칙이 제 예시를 스스로 고치는가 ─────────────────────── */

const { allRules } = await import('../packages/core/dist/index.js')
const { applyFixes } = await import('../packages/core/dist/index.js')
const brokenExamples = []
for (const rule of allRules) {
  for (const example of rule.examples) {
    const found = check(example.wrong, { rules: [rule] })
    if (found.length === 0 || applyFixes(example.wrong, found) !== example.right) {
      brokenExamples.push(`${rule.id}: ${example.wrong} → ${applyFixes(example.wrong, found)} (정답 ${example.right})`)
    }
  }
}
must(`규칙 ${allRules.length}개의 예시가 전부 제 정답으로 고쳐짐`, brokenExamples.length === 0, `어긋남 ${brokenExamples.length}건`)

/* ── 3. 정답셋 불변식 — 오류를 다 적용하면 정답이 나오는가 ──── */

const brokenGold = []
for (const t of corpus.texts) {
  let s = t.source
  for (const e of t.errors) {
    const at = s.indexOf(e.wrongText)
    if (at === -1) {
      brokenGold.push(`${t.register}: 원문에 없음 "${e.wrongText}"`)
      continue
    }
    s = s.slice(0, at) + e.rightText + s.slice(at + e.wrongText.length)
  }
  if (s !== t.corrected) brokenGold.push(`${t.register}: 오류를 다 적용해도 정답과 다르다`)
}
must(`표본 ${corpus.texts.length}편의 정답 불변식`, brokenGold.length === 0, `어긋남 ${brokenGold.length}건`)

/* ── 4. 재현율이 뒷걸음질하지 않았는가 ──────────────────────── */

function recall(texts, key) {
  let total = 0
  let hit = 0
  for (const t of texts) {
    const found = errorsOf(t[key.source])
    const used = new Set()
    let cursor = 0
    for (const e of t[key.errors]) {
      const at = t[key.source].indexOf(e[key.wrong], cursor)
      if (at === -1) continue
      cursor = at
      total += 1
      const end = at + e[key.wrong].length
      const i = found.findIndex((d, j) => !used.has(j) && Math.min(d.end, end) - Math.max(d.start, at) > 0)
      if (i !== -1) {
        used.add(i)
        hit += 1
      }
    }
  }
  return { total, hit, ratio: hit / Math.max(1, total) }
}

const proseR = recall(prose.paragraphs, { source: 'source', errors: 'errors', wrong: 'wrongText' })
const corpusR = recall(corpus.texts, { source: 'source', errors: 'errors', wrong: 'wrongText' })

// 아래 두 값은 지금까지 도달한 최고치다. 규칙을 더하면서 이 밑으로 내려가면 무언가 망가진 것이다.
const FLOOR_PROSE = 0.98
const FLOOR_CORPUS = 0.43

must(
  `일기 표본 재현율 ${proseR.ratio.toFixed(3)} ≥ ${FLOOR_PROSE}`,
  proseR.ratio >= FLOOR_PROSE,
  `${proseR.hit}/${proseR.total}`,
)
must(
  `여러 갈래 표본 재현율 ${corpusR.ratio.toFixed(3)} ≥ ${FLOOR_CORPUS}`,
  corpusR.ratio >= FLOOR_CORPUS,
  `${corpusR.hit}/${corpusR.total}`,
)

/* ── 결과 ────────────────────────────────────────────────────── */

console.log()
console.log('고침 — 지켜야 할 선')
console.log('='.repeat(60))
for (const line of lines) console.log(line)
console.log('='.repeat(60))

if (falsePositives.length > 0) {
  console.log()
  console.log('오탐 — 정밀도를 깨는 것이라 가장 먼저 고쳐야 한다')
  for (const f of falsePositives.slice(0, 20)) console.log(`  ${f}`)
  if (falsePositives.length > 20) console.log(`  … 외 ${falsePositives.length - 20}건`)
}
for (const [title, list] of [
  ['예시가 제 정답으로 안 고쳐짐', brokenExamples],
  ['정답 불변식 어긋남', brokenGold],
]) {
  if (list.length === 0) continue
  console.log()
  console.log(title)
  for (const x of list.slice(0, 15)) console.log(`  ${x}`)
  if (list.length > 15) console.log(`  … 외 ${list.length - 15}건`)
}

console.log()
if (failed > 0) {
  console.log(`${failed}가지가 선을 넘었다.`)
  process.exit(1)
}
console.log('전부 통과.')
