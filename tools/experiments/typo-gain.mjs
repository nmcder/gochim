#!/usr/bin/env node
/**
 * 실험 — 형태소 분석 점수로 오타를 잡을 수 있는가? (결론: 없다)
 *
 * [ADR 0006](../../docs/decisions/0006-rejected-score-based-typo-detection.md)의 근거 데이터를 만드는 스크립트다.
 * 주장 대신 재현 가능한 측정을 남기려고 지운 코드 대신 이걸 남겼다.
 *
 *   npm run build && node tools/experiments/typo-gain.mjs
 *
 * 가설: 오타는 사전에 없어 억지로 쪼개지므로 분석 비용이 높다.
 *       자모 하나를 바꾼 후보 중 비용이 크게 낮아지는 것이 있으면 그게 원래 쓰려던 말이다.
 *
 * 결과: 오타의 이득(gain)과 정상 단어의 이득이 **겹친다.** 임계값을 그을 수 없다.
 */

import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const { createAnalyzer } = await import(pathToFileURL(resolve(ROOT, 'packages/morph/dist/index.js')).href)

/** 한국인이 실제로 혼동하는 자모 쌍만 연다. 임의 편집 거리를 쓰면 후보가 폭발한다. */
const VOWEL_PAIRS = [['ㅐ', 'ㅔ'], ['ㅒ', 'ㅖ'], ['ㅚ', 'ㅙ'], ['ㅙ', 'ㅞ'], ['ㅚ', 'ㅞ'], ['ㅢ', 'ㅣ'], ['ㅢ', 'ㅡ'], ['ㅗ', 'ㅜ']]
const LEAD_PAIRS = [['ㄱ', 'ㄲ'], ['ㄷ', 'ㄸ'], ['ㅂ', 'ㅃ'], ['ㅅ', 'ㅆ'], ['ㅈ', 'ㅉ'], ['ㄱ', 'ㅋ'], ['ㄷ', 'ㅌ'], ['ㅂ', 'ㅍ'], ['ㅈ', 'ㅊ']]
const TAIL_PAIRS = [['', 'ㅅ'], ['ㅅ', 'ㅆ'], ['ㄷ', 'ㅅ'], ['ㅈ', 'ㅅ'], ['ㅊ', 'ㅅ'], ['ㄱ', 'ㄲ'], ['ㅎ', ''], ['ㄴ', 'ㄶ'], ['ㄹ', 'ㅀ']]

const LEADS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const TAILS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

const decompose = (ch) => {
  const code = ch.codePointAt(0) - 0xac00
  if (code < 0 || code > 11171) return null
  return { lead: LEADS[Math.floor(code / 588)], vowel: VOWELS[Math.floor((code % 588) / 28)], tail: TAILS[code % 28] }
}
const compose = (lead, vowel, tail) =>
  String.fromCodePoint(0xac00 + LEADS.indexOf(lead) * 588 + VOWELS.indexOf(vowel) * 28 + TAILS.indexOf(tail))

const swaps = (pairs, value) => pairs.filter(([a, b]) => value === a || value === b).map(([a, b]) => (value === a ? b : a))

function candidatesOf(word) {
  const found = new Set()
  for (let i = 0; i < word.length; i += 1) {
    const jamo = decompose(word[i])
    if (!jamo) continue
    const variants = [
      ...swaps(LEAD_PAIRS, jamo.lead).map((lead) => compose(lead, jamo.vowel, jamo.tail)),
      ...swaps(VOWEL_PAIRS, jamo.vowel).map((vowel) => compose(jamo.lead, vowel, jamo.tail)),
      ...swaps(TAIL_PAIRS, jamo.tail).map((tail) => compose(jamo.lead, jamo.vowel, tail)),
    ]
    for (const variant of variants) if (variant !== word[i]) found.add(word.slice(0, i) + variant + word.slice(i + 1))
  }
  return [...found]
}

const analyzer = await createAnalyzer()

const TYPOS = ['어의없다', '희안하다', '설겆이', '괸찮아', '어떻해', '뇌졸증', '폭팔', '찌게', '역활을', '오랫만에']
const CLEAN = [
  '물이', '도와주셔서', '메고', '말고', '쌀은', '안으면', '어의는', '포르르',
  '김민수가', '스타벅스에서', '넷플릭스를', '했습니다', '그렇습니다', '먹었다', '드릴게요', '괜찮아',
]

function bestCandidate(word) {
  const base = analyzer.score(word)
  const baseMorphemes = analyzer.analyze(word).length
  let best = null
  for (const candidate of candidatesOf(word)) {
    const gain = base - analyzer.score(candidate)
    if (!best || gain > best.gain) best = { candidate, gain, morphemes: analyzer.analyze(candidate).length }
  }
  return { base, baseMorphemes, best }
}

function report(label, words) {
  console.log(`\n=== ${label} ===`)
  const gains = []
  for (const word of words) {
    const { base, baseMorphemes, best } = bestCandidate(word)
    if (!best) {
      console.log(`  ${word.padEnd(12)} base=${base.toFixed(1)} (${baseMorphemes})  후보 없음`)
      continue
    }
    gains.push(best.gain)
    console.log(
      `  ${word.padEnd(12)} base=${base.toFixed(1).padStart(5)} (${baseMorphemes})` +
        `  →  ${best.candidate.padEnd(12)} gain=${best.gain.toFixed(1).padStart(6)} (${best.morphemes})`,
    )
  }
  return gains
}

const typoGains = report('오타 — 잡아야 하는 것', TYPOS)
const cleanGains = report('정상 — 건드리면 안 되는 것', CLEAN)

const max = (xs) => Math.max(...xs).toFixed(1)
const min = (xs) => Math.min(...xs).toFixed(1)

console.log('\n=== 결론 ===')
console.log(`오타 이득  ${min(typoGains)} ~ ${max(typoGains)}`)
console.log(`정상 이득  ${min(cleanGains)} ~ ${max(cleanGains)}`)
console.log(
  `\n두 분포가 겹친다. 정상 단어가 오타보다 큰 이득을 내는 경우가 있어(예: 안으면, 포르르)\n` +
    `임계값을 어디에 두어도 오탐 없이 오타만 걸러낼 수 없다. → 이 접근은 기각한다.`,
)

analyzer.destroy()
