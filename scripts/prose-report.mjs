#!/usr/bin/env node
/**
 * 실문(實文) 성적표.
 *
 * 골든 테스트셋은 오류 유형마다 문장을 하나씩 만든 것이라, 실제 글에서 어떤 유형이
 * 얼마나 자주 나오는지는 반영하지 않는다. 그래서 골든셋 재현율이 0.95여도
 * 진짜 일기 한 편에서는 10건밖에 못 잡는 일이 생긴다.
 *
 * 이 스크립트는 사람이 쓴 글 한 편과 그 정답을 놓고 실제 재현율을 잰다.
 *
 *   node scripts/prose-report.mjs [--morph]
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check } from '../packages/core/dist/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const useMorph = process.argv.includes('--morph')

const corpus = JSON.parse(readFileSync(resolve(ROOT, 'data/golden/prose.json'), 'utf8'))

let analyzer = null
if (useMorph) {
  const { createAnalyzer } = await import('../packages/morph/dist/index.js')
  analyzer = await createAnalyzer()
}
const options = analyzer ? { analyzer } : {}

const run = (text) => check(text, options)

/** 정답 오류의 문자 구간을 원문에서 찾는다. */
function locate(source, errors) {
  const located = []
  let cursor = 0
  for (const error of errors) {
    const at = source.indexOf(error.wrongText, cursor)
    if (at === -1) {
      located.push({ ...error, start: -1, end: -1 })
      continue
    }
    located.push({ ...error, start: at, end: at + error.wrongText.length })
    cursor = at // 같은 표기가 여러 번 나와도 순서대로 잡는다
  }
  return located
}

const byCategory = new Map()
let total = 0
let hit = 0
let extra = 0
let warned = 0
const missed = []
const extras = []

for (const para of corpus.paragraphs) {
  const gold = locate(para.source, para.errors).filter((e) => e.start !== -1)
  const found = run(para.source)
  const used = new Set()

  for (const g of gold) {
    total += 1
    const stat = byCategory.get(g.category) ?? { total: 0, hit: 0 }
    stat.total += 1

    // 구간이 겹치면 잡은 것으로 센다. 제안까지 정확한지는 따로 표시한다.
    // 정답끼리 구간이 겹칠 때 앞의 정답이 엉뚱한 검출을 선점하지 않도록,
    // 먼저 온 순서가 아니라 **가장 많이 겹치는** 검출을 고른다.
    let match = -1
    let best = 0
    found.forEach((d, i) => {
      if (used.has(i)) return
      const overlap = Math.min(d.end, g.end) - Math.max(d.start, g.start)
      if (overlap > best) {
        best = overlap
        match = i
      }
    })
    if (match === -1) {
      missed.push({ para: para.index + 1, ...g })
    } else {
      used.add(match)
      hit += 1
      stat.hit += 1
      const d = found[match]
      const exact = d.suggestions[0] === g.rightText || g.rightText.includes(d.suggestions[0])
      if (!exact) missed.push({ para: para.index + 1, ...g, partial: d.suggestions[0] })
    }
    byCategory.set(g.category, stat)
  }

  found.forEach((d, i) => {
    if (used.has(i)) return
    // 경고는 정답에 없는 게 당연하다 — 규정이 허용하는 표기를 알려 주는 것뿐이다.
    if (d.severity === 'warning') { warned += 1; return }
    extra += 1
    extras.push({ para: para.index + 1, ruleId: d.ruleId, text: d.text, suggestion: d.suggestions[0] })
  })
}

/**
 * '모두 고치기'를 누른 것과 똑같이 전부 적용하고 정답과 통째로 견준다.
 *
 * 구간 겹침으로만 세면 점수가 후하게 나온다. `몇분뒤에`를 `몇 분뒤에`까지만 고쳐도
 * 겹치기 때문에 잡은 것으로 세지만, 사용자 눈에는 여전히 틀린 글이 남는다.
 * 확장의 '모두 고치기'가 생긴 뒤로는 이쪽이 진짜 성적이다.
 *
 * 확장과 마찬가지로 **여러 번 훑는다.** 한 자리에 오류가 둘 겹치면 엔진이 하나만 남기므로
 * (`약속시간 보다`는 붙이기와 가르기가 함께 걸린다) 한 번만 고치면 절반이 남는다.
 */
const MAX_PASSES = 3

function applyOnce(source, diagnostics) {
  let out = source
  let earliest = Number.POSITIVE_INFINITY
  let changed = 0
  // 경고는 빼고 잰다. 정답은 규정이 허용하는 표기를 그대로 두기로 한 판정이라
  // ('좀더'·'다음날') 경고까지 적용하면 정답과 어긋나는 게 당연하다.
  // 확장의 '모두 고치기'는 사용자가 직접 누르는 것이라 경고까지 고친다 — 여기와 다르다.
  for (const d of [...diagnostics].filter((x) => x.severity !== 'warning').sort((a, b) => b.start - a.start)) {
    if (d.suggestions[0] == null) continue
    if (d.end > earliest) continue // 겹치는 진단은 뒤엣것만 쓴다 — 확장과 같은 규칙
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

/** 어절 단위로 견준다. 글자 단위 거리는 사람이 읽고 판단하기 어렵다. */
function wordDiff(got, want) {
  const a = got.split(/\s+/).filter(Boolean)
  const b = want.split(/\s+/).filter(Boolean)
  const same = new Set()
  let i = 0
  for (const word of b) {
    const at = a.indexOf(word, i)
    if (at !== -1) {
      same.add(at)
      i = at + 1
    }
  }
  return { matched: same.size, wanted: b.length, leftover: b.filter((w) => !a.includes(w)) }
}

let exactParas = 0
const residue = []
for (const para of corpus.paragraphs) {
  const fixed = applyAll(para.source, run(para.source))
  if (fixed === para.corrected) exactParas += 1
  else residue.push({ index: para.index + 1, ...wordDiff(fixed, para.corrected) })
}

const bar = (ratio) => '█'.repeat(Math.round(ratio * 20)).padEnd(20, '·')

console.log()
console.log(`실문 성적표${useMorph ? ' (형태소 층 포함)' : ' (1층만)'}`)
console.log('='.repeat(64))
console.log(`표본  문단 ${corpus.paragraphs.length}개 · ${corpus.paragraphs.reduce((n, p) => n + p.source.length, 0)}자 · 정답 오류 ${total}건`)
console.log(`검출 ${hit}건 · 재현율 ${(hit / total).toFixed(4)} · 정답에 없는 지적 ${extra}건` + (warned ? ` · 원칙 안내(경고) ${warned}건` : ''))

const wantedWords = residue.reduce((n, r) => n + r.wanted, 0)
const matchedWords = residue.reduce((n, r) => n + r.matched, 0)
const perfect = corpus.paragraphs.length - residue.length
console.log(
  `모두 고치기 후 정답과 완전히 같은 문단 ${perfect}/${corpus.paragraphs.length}` +
    (residue.length > 0 ? ` · 나머지 문단의 어절 일치 ${(matchedWords / wantedWords).toFixed(4)}` : ''),
)
console.log('='.repeat(64))
console.log()
console.log('분류별')
for (const [category, stat] of [...byCategory].sort((a, b) => b[1].total - a[1].total)) {
  const ratio = stat.hit / stat.total
  console.log(`  ${category.padEnd(12)} ${bar(ratio)} ${String(Math.round(ratio * 100)).padStart(3)}%  (${stat.hit}/${stat.total})`)
}

const byRule = new Map()
for (const m of missed) {
  if (m.partial) continue
  byRule.set(m.rule, [...(byRule.get(m.rule) ?? []), m])
}

console.log()
console.log(`못 잡은 오류 ${missed.filter((m) => !m.partial).length}건 — 규칙 후보 (많은 순)`)
for (const [rule, items] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(items.length).padStart(2)}건  ${rule}`)
  for (const item of items.slice(0, 3)) console.log(`        ${item.wrongText} → ${item.rightText}`)
  if (items.length > 3) console.log(`        … 외 ${items.length - 3}건`)
}

const partials = missed.filter((m) => m.partial)
if (partials.length > 0) {
  console.log()
  console.log(`구간은 잡았으나 제안이 정답과 다른 것 ${partials.length}건`)
  for (const p of partials) console.log(`  ${p.wrongText} → 제안 "${p.partial}" / 정답 "${p.rightText}"`)
}

if (residue.length > 0) {
  console.log()
  console.log('모두 고쳐도 정답과 다른 문단 — 남은 어절')
  for (const r of residue) {
    console.log(`  문단 ${r.index}  일치 ${r.matched}/${r.wanted}`)
    for (const word of r.leftover.slice(0, 8)) console.log(`        빠짐: ${word}`)
    if (r.leftover.length > 8) console.log(`        … 외 ${r.leftover.length - 8}개`)
  }
}

if (extras.length > 0) {
  console.log()
  console.log(`정답에 없는 지적 ${extras.length}건 — 과교정인지 정답 누락인지 확인 필요`)
  for (const e of extras) console.log(`  [${e.ruleId}] ${e.text} → ${e.suggestion}  (문단 ${e.para})`)
}

analyzer?.destroy()
