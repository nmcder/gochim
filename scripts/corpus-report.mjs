#!/usr/bin/env node
/**
 * 여러 갈래 실문 성적표.
 *
 * 일기 한 편으로만 재면 그 글에 없는 오류는 영영 보이지 않는다.
 * 실제로 그런 일이 있었다 — 일기 표본에서 재현율 1.000을 찍고도
 * 다른 갈래 글을 넣으면 못 잡는 것이 쏟아졌다.
 *
 * 그래서 갈래를 나눠 잰다. 메신저·이메일·자기소개서·댓글·후기·리포트·일기.
 * 갈래마다 자주 나오는 오류가 다르다 — 후기에는 외래어, 이메일에는 높임,
 * 댓글에는 띄어쓰기가 몰린다.
 *
 *   node scripts/corpus-report.mjs [--morph] [--verbose]
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../packages/core/dist/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const useMorph = process.argv.includes('--morph')
const verbose = process.argv.includes('--verbose')

const corpus = JSON.parse(readFileSync(resolve(ROOT, 'data/golden/corpus.json'), 'utf8'))

let analyzer = null
if (useMorph) {
  const { createAnalyzer } = await import('../packages/morph/dist/index.js')
  analyzer = await createAnalyzer()
}
const run = (text) => check(text, analyzer ? { analyzer } : {})

/** 정답 오류의 문자 구간을 원문에서 찾는다. 같은 표기가 여러 번 나와도 순서대로 짚는다. */
function locate(source, errors) {
  const located = []
  let cursor = 0
  for (const error of errors) {
    const at = source.indexOf(error.wrongText, cursor)
    if (at === -1) continue
    located.push({ ...error, start: at, end: at + error.wrongText.length })
    cursor = at
  }
  return located
}

/**
 * '모두 고치기'와 똑같이 오류를 전부 적용한다.
 *
 * 경고는 뺀다. 정답은 규정이 허용하는 표기를 그대로 두기로 한 판정이라
 * 경고까지 적용하면 정답과 어긋나는 게 당연하다.
 *
 * 확장과 마찬가지로 **여러 번 훑는다**. 한 어절에 오류가 둘 겹치면 엔진이 하나만 남기므로
 * (`먹을껄` = 띄어쓰기 + 표기) 한 번만 고치면 `먹을 껄`에서 멈춘다.
 */
const MAX_PASSES = 3

function applyOnce(source, diagnostics) {
  let out = source
  let earliest = Number.POSITIVE_INFINITY
  let changed = 0
  for (const d of [...diagnostics].filter((x) => x.severity !== 'warning').sort((a, b) => b.start - a.start)) {
    if (d.suggestions[0] == null) continue
    if (d.end > earliest) continue
    out = out.slice(0, d.start) + d.suggestions[0] + out.slice(d.end)
    earliest = d.start
    changed += 1
  }
  return { out, changed }
}

function applyAll(source, diagnostics) {
  let { out, changed } = applyOnce(source, diagnostics)
  for (let pass = 1; pass < MAX_PASSES && changed > 0; pass += 1) {
    const again = applyOnce(out, run(out))
    if (again.changed === 0) break
    out = again.out
    changed = again.changed
  }
  return out
}

const byCategory = new Map()
const rows = []
const allMissed = []
const allExtra = []
let grandTotal = 0
let grandHit = 0
let grandExtra = 0
let grandWarn = 0
let exactTexts = 0

for (const text of corpus.texts) {
  const gold = locate(text.source, text.errors)
  const found = run(text.source)
  const used = new Set()
  let hit = 0
  let extra = 0
  let warned = 0

  for (const g of gold) {
    const stat = byCategory.get(g.category) ?? { total: 0, hit: 0 }
    stat.total += 1

    // 구간이 가장 많이 겹치는 검출을 고른다. 정답끼리 붙어 있어도 선점당하지 않는다.
    let match = -1
    let best = 0
    found.forEach((d, i) => {
      if (used.has(i) || d.severity === 'warning') return
      const overlap = Math.min(d.end, g.end) - Math.max(d.start, g.start)
      if (overlap > best) {
        best = overlap
        match = i
      }
    })
    if (match === -1) allMissed.push({ register: text.register, ...g })
    else {
      used.add(match)
      hit += 1
      stat.hit += 1
    }
    byCategory.set(g.category, stat)
  }

  found.forEach((d, i) => {
    if (used.has(i)) return
    if (d.severity === 'warning') {
      warned += 1
      return
    }
    // 정답 하나를 진단 둘이 나눠 맡는 일이 있다 — `해결 될줄아냐고`는 붙이기와 가르기가 함께 걸린다.
    // 짝이 못 지어졌을 뿐 정답 구간 안이라면 과교정이 아니다. 정답과 아예 겹치지 않는 것만 센다.
    if (gold.some((g) => Math.min(d.end, g.end) - Math.max(d.start, g.start) > 0)) return
    extra += 1
    allExtra.push({ register: text.register, ruleId: d.ruleId, text: d.text, suggestion: d.suggestions[0] })
  })

  const fixed = applyAll(text.source, found)
  const exact = fixed === text.corrected
  if (exact) exactTexts += 1

  grandTotal += gold.length
  grandHit += hit
  grandExtra += extra
  grandWarn += warned
  rows.push({ register: text.register, chars: text.source.length, total: gold.length, hit, extra, warned, exact })
}

const bar = (ratio) => '█'.repeat(Math.round(ratio * 16)).padEnd(16, '·')
const pct = (n, d) => (d === 0 ? '—' : (n / d).toFixed(3))

console.log()
console.log(`여러 갈래 실문 성적표${useMorph ? ' (형태소 층 포함)' : ' (1층만)'}`)
console.log('='.repeat(72))
console.log(
  `표본 ${corpus.texts.length}편 · ${rows.reduce((n, r) => n + r.chars, 0)}자 · 정답 오류 ${grandTotal}건`,
)
console.log(
  `검출 ${grandHit}건 · 재현율 ${pct(grandHit, grandTotal)} · 과교정 ${grandExtra}건 · 원칙 안내(경고) ${grandWarn}건`,
)
console.log(`모두 고친 뒤 정답과 글자까지 같은 글 ${exactTexts}/${corpus.texts.length}`)
console.log('='.repeat(72))
console.log()

console.log('갈래별')
for (const r of rows) {
  console.log(
    `  ${r.register.padEnd(9)} ${bar(r.hit / Math.max(1, r.total))} ${pct(r.hit, r.total)}  ` +
      `(${String(r.hit).padStart(2)}/${String(r.total).padStart(2)})  과교정 ${r.extra}  ${r.exact ? '완전 일치' : ''}`,
  )
}

console.log()
console.log('분류별')
for (const [category, stat] of [...byCategory].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `  ${category.padEnd(12)} ${bar(stat.hit / stat.total)} ${pct(stat.hit, stat.total)}  (${stat.hit}/${stat.total})`,
  )
}

if (allExtra.length > 0) {
  console.log()
  console.log(`과교정 ${allExtra.length}건 — 정밀도를 깨는 것이라 가장 먼저 봐야 한다`)
  for (const e of allExtra) console.log(`  [${e.ruleId}] ${e.text} → ${e.suggestion}  (${e.register})`)
}

console.log()
console.log(`못 잡은 오류 ${allMissed.length}건`)
const grouped = new Map()
for (const m of allMissed) grouped.set(m.category, [...(grouped.get(m.category) ?? []), m])
for (const [category, items] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${category} — ${items.length}건`)
  for (const m of items.slice(0, verbose ? items.length : 6)) {
    console.log(`      ${m.wrongText} → ${m.rightText}   ${m.why ? `· ${m.why.slice(0, 60)}` : ''}`)
  }
  if (!verbose && items.length > 6) console.log(`      … 외 ${items.length - 6}건 (--verbose로 전부)`)
}

analyzer?.destroy()
