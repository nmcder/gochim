#!/usr/bin/env node
/**
 * 지켜야 할 선을 한 번에 확인한다.
 *
 * 규칙을 더할 때 가장 흔한 사고는 **재현율을 올리면서 정밀도를 깨뜨리는 것**이다.
 * 성적표를 따로따로 돌리면 그 순간을 놓치기 쉬워서, 넘으면 안 되는 선을 여기 못 박는다.
 *
 *   node scripts/guard.mjs
 *
 * **형태소 층까지 함께 잰다.** 확장은 형태소 분석기를 기본값으로 켜 두므로,
 * 1층만 재면 사용자가 실제로 보는 결과를 재지 않는 것이 된다.
 * 분석기 빌드가 없으면 그 부분만 건너뛰되 눈에 띄게 알린다.
 *
 * 하나라도 어기면 종료 코드 1로 끝난다.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allMorphRules, allRules, applyFixes, check, VERSION } from '../packages/core/dist/index.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'))

const golden = read('data/golden/golden.json')
const prose = read('data/golden/prose.json')
const corpus = read('data/golden/corpus.json')
const wild = read('data/golden/wild.json')

let analyzer = null
const morphDist = resolve(ROOT, 'packages/morph/dist/index.js')
if (existsSync(morphDist)) {
  const { createAnalyzer } = await import('../packages/morph/dist/index.js')
  analyzer = await createAnalyzer()
}

/** 경고는 "이게 틀렸다"가 아니라 "원칙은 이쪽이다"라는 안내라 오탐으로 세지 않는다. */
const errorsOf = (text, withMorph) =>
  check(text, withMorph && analyzer ? { analyzer } : {}).filter((d) => d.severity !== 'warning')

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

const falsePositives = { 1: [], 3: [] }
for (const sentence of clean) {
  for (const d of errorsOf(sentence, false)) {
    falsePositives[1].push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence.slice(0, 50)}`)
  }
  if (!analyzer) continue
  for (const d of errorsOf(sentence, true)) {
    falsePositives[3].push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence.slice(0, 50)}`)
  }
}
must(`정상 문장 ${clean.length}개에 오류 0건 (1층)`, falsePositives[1].length === 0, `오탐 ${falsePositives[1].length}건`)
if (analyzer) {
  must(
    `정상 문장 ${clean.length}개에 오류 0건 (형태소 층 포함)`,
    falsePositives[3].length === 0,
    `오탐 ${falsePositives[3].length}건`,
  )
}

/* ── 2. 규칙이 제 예시를 스스로 고치는가 ─────────────────────── */

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

function recall(texts, key, withMorph) {
  let total = 0
  let hit = 0
  for (const t of texts) {
    const found = errorsOf(t[key.source], withMorph)
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

const KEY = { source: 'source', errors: 'errors', wrong: 'wrongText' }

// 아래 값들은 지금까지 도달한 최고치다. 규칙을 더하면서 이 밑으로 내려가면 무언가 망가진 것이다.
//
// 여러 갈래 하한선이 0.9에서 0.6으로 **내려간 적이 있다.** 규칙이 나빠져서가 아니라
// 표본을 7편에서 13편으로 늘렸기 때문이다. 0.901은 그 7편에 맞춰 규칙을 다듬어 얻은
// 값이었고, 처음 보는 6편에서는 0.14~0.29였다. 하한선은 지금 표본에 대한 값이므로
// 표본이 바뀌면 다시 재야 한다. 낮은 값이 부끄러워서 표본을 되돌리면 그 순간
// 성적표가 거짓말을 하기 시작한다.
const FLOOR_PROSE = 0.98
const FLOOR_CORPUS = 0.78
/** 형태소 층까지 켠 값. 확장의 기본값이라 이쪽이 사용자가 실제로 보는 성적이다. */
const FLOOR_CORPUS_MORPH = 0.95

const proseR = recall(prose.paragraphs, KEY, false)
const corpusR = recall(corpus.texts, KEY, false)

must(`일기 표본 재현율 ${proseR.ratio.toFixed(3)} ≥ ${FLOOR_PROSE}`, proseR.ratio >= FLOOR_PROSE, `${proseR.hit}/${proseR.total}`)
must(
  `여러 갈래 표본 재현율 ${corpusR.ratio.toFixed(3)} ≥ ${FLOOR_CORPUS} (1층)`,
  corpusR.ratio >= FLOOR_CORPUS,
  `${corpusR.hit}/${corpusR.total}`,
)
if (analyzer) {
  const corpusM = recall(corpus.texts, KEY, true)
  must(
    `여러 갈래 표본 재현율 ${corpusM.ratio.toFixed(3)} ≥ ${FLOOR_CORPUS_MORPH} (형태소 층 포함)`,
    corpusM.ratio >= FLOOR_CORPUS_MORPH,
    `${corpusM.hit}/${corpusM.total}`,
  )

  /* ── 이모지가 섞여도 같은 성적이 나오는가 ────────────────────
   *
   * garu-ko는 자리를 **코드포인트**로 주는데 자바스크립트 문자열은 **UTF-16**이다.
   * 이모지 하나가 서러게이트 쌍으로 두 자리를 차지하므로, 옮겨 주지 않으면
   * 그 뒤의 모든 자리가 1씩 밀린다. 밀린 자리로 어절을 자르면 아무 규칙도
   * 맞아떨어지지 않아 **형태소 층이 통째로 죽는다.** 실측 0.955 → 0.790이었다.
   *
   * 무서운 것은 이것이 **틀린 자리에 밑줄을 긋는 게 아니라 아무 데도 안 긋는**
   * 고장이라는 점이다. 조용해서 아무도 눈치채지 못했다. 카톡·SNS가 주 사용처인데
   * 거기서 3층이 안 돌고 있었다.
   *
   * 그래서 개수가 아니라 **같은가**를 잰다. 앞에 이모지를 붙였을 때의 재현율이
   * 붙이지 않았을 때와 다르면 자리 셈법이 또 어긋난 것이다.
   */
  const 이모지 = '🙂🎉👍 '
  const shifted = corpus.texts.map((t) => ({ ...t, source: 이모지 + t.source }))
  const emojiR = recall(shifted, KEY, true)
  must(
    `이모지가 섞여도 재현율이 같다 (형태소 층) — ${emojiR.ratio.toFixed(3)}`,
    emojiR.hit === corpusM.hit && emojiR.total === corpusM.total,
    `이모지 없이 ${corpusM.hit}/${corpusM.total} · 이모지 ${emojiR.hit}/${emojiR.total}`,
  )
}

/* ── 5. 밖에서 온 정상 한국어 ────────────────────────────────
 *
 * 위 1번의 '정상 문장 829개'는 전부 골든셋 자신이다 — 규칙을 그 문장들에 맞춰
 * 다듬었으니 오탐이 0으로 나올 수밖에 없다. **자가 거짓말을 한다.**
 *
 * 2026-08-25 실측: 규칙을 보지 않고 지은 평범한 문장 25개를 넣어 보니 9개가 망가졌다.
 * 골든셋 정밀도는 1.000인데 실제로는 0.64였다.
 *
 * 그래서 밖에서 온 한국어를 따로 잰다. 두 뭉치다.
 *   (가) data/golden/wild.json — 규칙과 무관하게 지은 정상 문장. 여기 지적은 전부 오탐이다
 *   (나) 저장소 자기 산문 — 문서와 소스 주석. 테스트 자료로 쓰려고 쓴 글이 아니라 독립적이다
 *
 * 지금은 0으로 만들 수 없다. 그래서 **이미 알고 있는 오탐만 눈감아 주고, 처음 보는
 * 갈래가 하나라도 나오면 실패**시킨다. 개수 상한이 아니라 **집합**인 이유는,
 * 산문은 계속 늘어나기 때문이다 — 개수로 재면 문서를 한 줄 쓸 때마다 선이 흔들린다.
 *
 * 알려진 오탐 목록은 **줄어들기만 해야 한다.** 여기에 한 줄을 더하는 것은
 * "이 오탐을 앞으로도 두겠다"는 뜻이라 그만한 이유가 있어야 한다.
 */

/** 진단 하나를 가리키는 열쇠. 같은 규칙이 같은 표기에 발화한 것은 같은 갈래로 본다. */
const signature = (d) => `${d.ruleId}|${d.text}`

/**
 * 이미 알고 있는 오탐. 전부 **맞는 글을 망가뜨리는 것**이라 언젠가 없어져야 한다.
 * 갈래마다 왜 나는지와 어떻게 고칠지가 그 파일에 적혀 있다.
 * 테스트(packages/morph/test)도 같은 파일을 읽는다 — 두 곳에 적으면 곧 어긋난다.
 */
const KNOWN_FALSE_POSITIVES = new Set(read('data/golden/known-false-positives.json').entries.flatMap((e) => e.signatures))

/**
 * 서명이 들어맞는가.
 *
 * `*`로 끝나면 앞부분만 맞으면 된다. 규칙이 조사까지 물고 발화하는 자리가 있어서다 —
 * `군데가·군데를·군데에`는 조사만 다른 **한 갈래**인데 서명을 따로 적으면
 * 목록이 뜻 없이 길어지고, 새 조사가 나올 때마다 관문이 헛되이 운다.
 */
const isKnown = (key) => {
  if (KNOWN_FALSE_POSITIVES.has(key)) return true
  for (const known of KNOWN_FALSE_POSITIVES) {
    if (known.endsWith('*') && key.startsWith(known.slice(0, -1))) return true
  }
  return false
}

/** 알려진 갈래가 아닌 것만 모은다. 이것이 하나라도 있으면 선을 넘은 것이다. */
function unknownOnly(hits) {
  return hits.filter((h) => !isKnown(h.key))
}

/* (가) 지어 둔 정상 문장 */

const wildHits = { 1: [], 3: [] }
for (const sentence of wild.sentences) {
  for (const d of errorsOf(sentence, false)) {
    wildHits[1].push({ key: signature(d), line: `${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence}` })
  }
  if (!analyzer) continue
  for (const d of errorsOf(sentence, true)) {
    wildHits[3].push({ key: signature(d), line: `${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence}` })
  }
}
const wildNew = { 1: unknownOnly(wildHits[1]), 3: unknownOnly(wildHits[3]) }
must(
  `밖에서 온 정상 문장 ${wild.sentences.length}개에 처음 보는 오탐 0건 (1층)`,
  wildNew[1].length === 0,
  `처음 보는 것 ${wildNew[1].length}건 · 알려진 것 ${wildHits[1].length - wildNew[1].length}건`,
)
if (analyzer) {
  must(
    `밖에서 온 정상 문장 ${wild.sentences.length}개에 처음 보는 오탐 0건 (형태소 층 포함)`,
    wildNew[3].length === 0,
    `처음 보는 것 ${wildNew[3].length}건 · 알려진 것 ${wildHits[3].length - wildNew[3].length}건`,
  )
}

/* (가-2) 한 글자씩 쳐 나가는 동안에도 자동 고침이 손대지 않는가
 *
 * 위의 (가)는 **완성문**을 한 번 먹인다. 그런데 사용자는 글을 한 글자씩 치고,
 * 확장은 그 사이사이에 고친다. **다 못 친 낱말은 거의 언제나 틀린 말처럼 보인다** —
 * `밥을 먹지 않`은 `안`으로, `안간`은 `안 간`으로 고치고 싶어진다.
 * 완성문만 재면 이 자리가 통째로 안 보인다.
 *
 * 그래서 확장의 판정을 그대로 옮겨 재다. 중복이지만, 이것이 없으면
 * 관문이 **별로 안 일어나는 상황**만 재게 된다.
 */

const BOUNDARY_CHAR = /[\s.,!?…;:)\]}"']/
const justEndedWord = (t, at) => BOUNDARY_CHAR.test(t[at - 1] ?? '')
function settledBefore(t, caret) {
  let at = Math.min(caret, t.length)
  while (at > 0 && !/\s/.test(t[at - 1] ?? '')) at -= 1
  return at
}

const typedHits = []
for (const sentence of wild.sentences) {
  for (let n = 1; n <= sentence.length; n++) {
    const piece = sentence.slice(0, n)
    const found = check(piece)
    for (const boundary of [
      justEndedWord(piece, piece.length) ? piece.length + 1 : settledBefore(piece, piece.length),
      settledBefore(piece, piece.length),
    ]) {
      for (const d of found) {
        if (!d.autoFixSafe || d.end >= boundary) continue
        typedHits.push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  친 데까지 "${piece}"  |  온 문장 "${sentence}"`)
      }
    }
  }
}
must(
  `정상 문장 ${wild.sentences.length}개를 한 글자씩 쳐 나가는 동안 자동 적용 0건`,
  typedHits.length === 0,
  `${typedHits.length}건`,
)
if (typedHits.length > 0) {
  lines.push('')
  lines.push('치는 도중에 자동으로 바뀌는 자리')
  for (const h of [...new Set(typedHits)].slice(0, 12)) lines.push(`  ${h}`)
}

/* (나) 저장소 자기 산문 */

// 이 저장소는 예시를 본문에 백틱으로 적는다 — 일부러 틀리게 적은 것이라 오탐이 아니다.
// 그래서 코드 조각과 화살표가 든 줄을 걷어내고 남은 **진짜 산문**만 검사한다.
const ARROW = /[→⇒←↔⇢]/
const ENUM_SLASH = /[가-힣]\/[가-힣]/
// 코드나 괄호가 한글에 붙어 있으면(`며칠`이라는) 지웠을 때 조사가 홀로 남아 없던 오류가 생긴다.
const GLUED = /(`[^`]*`|\)|\])[가-힣]/
const skipLine = (raw) => ARROW.test(raw) || ENUM_SLASH.test(raw) || GLUED.test(raw)
/**
 * 홀로 선 조사. 한국어 산문에서는 이런 어절이 나오지 않는다.
 *
 * 코드 조각을 지우면 그 자리에 붙어 있던 조사가 홀로 남는다 —
 * `` `sendResponse` 로만 `` 이 `답은 로만` 이 되는 식이다. 그러면 규칙이
 * 있지도 않은 오류를 잡아 관문이 헛돈다. **뽑아내기 쪽 문제라 여기서 치운다.**
 * (규칙을 고칠 일이 아니다 — 사용자 글에는 이런 어절이 애초에 없다)
 */
const LONE_JOSA =
  /(?<=^|\s)(?:으로만|으로|로만|로서|로써|로|은|는|이|가|을|를|에게|에서|에|와|과|처럼|만큼|만|도|의|께|부터|까지|보다|라도|이나|나)(?=\s|$)/g

const scrub = (line) =>
  line
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|~~/g, '')
    .replace(/\s+/g, ' ')
    .replace(LONE_JOSA, ' ')
    .replace(/\s+/g, ' ')
const longEnough = (line) => line.replace(/[^가-힣]/g, '').length >= 10

/**
 * 줄바꿈을 한 가지로 맞춘다.
 *
 * 이것이 없어서 **관문이 기계마다 다른 것을 쟀다.** 윈도 작업본은 CRLF, CI는 LF라
 * 같은 저장소에서 산문이 822줄과 919줄로 갈렸고, 로컬에서 초록인 것을 밀어 넣었더니
 * CI가 빨개졌다. 관문이 어디서 도느냐에 따라 다른 답을 내면 관문이 아니다.
 */
const eachLine = (text) => text.replace(/\r\n?/g, '\n').split('\n')

function proseLines(markdown) {
  const out = []
  let inFence = false
  for (const raw of eachLine(markdown)) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence
      continue
    }
    if (inFence || /^\s{4,}\S/.test(raw) || skipLine(raw)) continue
    const line = scrub(raw)
      .replace(/^\s*[|>#*\-\d.]+\s*/, '')
      .replace(/\|/g, ' ')
      .trim()
    if (longEnough(line)) out.push(line)
  }
  return out
}

function commentLines(source) {
  const out = []
  let inFence = false
  for (const raw of eachLine(source)) {
    const m = raw.match(/^\s*(?:\/\/|\*|\/\*\*?)\s?(.*)$/)
    if (!m) continue
    // 주석 안의 코드 예시도 산문이 아니다. `proseLines` 가 마크다운에서 하는 것과 같다 —
    // 이 저장소는 문서에도 주석에도 **일부러 틀리게 적은 예시**를 둘다.
    if (/^\s*```/.test(m[1] ?? '')) {
      inFence = !inFence
      continue
    }
    if (inFence || skipLine(m[1] ?? '')) continue
    const line = scrub(m[1] ?? '').trim()
    if (longEnough(line)) out.push(line)
  }
  return out
}

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sourceFiles(join(dir, entry.name)))
    else if (/\.(ts|mjs)$/.test(entry.name)) out.push(join(dir, entry.name))
  }
  return out
}

const proseTexts = []
const docs = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md']
for (const file of readdirSync(resolve(ROOT, 'docs/decisions'))) docs.push(join('docs/decisions', file))
for (const file of docs) {
  for (const line of proseLines(readFileSync(resolve(ROOT, file), 'utf8'))) proseTexts.push({ file, line })
}
for (const dir of ['packages/core/src', 'packages/morph/src', 'packages/store/src', 'apps/extension/src', 'apps/demo/src', 'scripts']) {
  for (const file of sourceFiles(dir)) {
    // 규칙 파일의 주석은 잡아야 할 오류를 그대로 적어 둔 자리라 뺀다.
    if (/[\\/](rules|morph)[\\/]/.test(file)) continue
    for (const line of commentLines(readFileSync(resolve(ROOT, file), 'utf8'))) proseTexts.push({ file, line })
  }
}

const proseHits = []
for (const { file, line } of proseTexts) {
  for (const d of errorsOf(line, true)) {
    proseHits.push({
      key: signature(d),
      line: `${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${file}  |  ${line.slice(0, 46)}`,
    })
  }
}
const proseNew = unknownOnly(proseHits)
const proseChars = proseTexts.reduce((n, t) => n + t.line.length, 0)
must(
  `저장소 자기 산문 ${proseChars.toLocaleString()}자에 처음 보는 지적 0건`,
  proseNew.length === 0,
  `처음 보는 것 ${proseNew.length}건 · 알려진 것 ${proseHits.length - proseNew.length}건 · ${proseTexts.length}줄`,
)

/* ── 6. 묻지 않고 고쳐도 되는 규칙인가 ───────────────────────
 *
 * `severity`는 "이것이 틀렸는가"라는 **국어적 판정**이고, `autoFixSafe`는 "사람이 보지
 * 않아도 이 규칙을 믿을 수 있는가"라는 **공학적 판정**이다. 예전에는 둘을 겹쳐 써서,
 * 국어적으로는 분명히 옳지만 가드가 뚫리는 규칙까지 묻지 않고 적용됐다.
 *
 * 규칙이 자격을 얻는 조건은 셋이고 전부 여기서 잰다. 자세한 것은 CONTRIBUTING.md.
 *   (가) 밖에서 온 정상 글에서 발화 0건
 *   (나) 표본에서 실제 오류를 한 번이라도 잡은 적이 있다 — '조용해서 안 걸린 것'과 가른다
 *   (다) 반례가 하나 이상 적혀 있다 — 지은 사람이 오탐을 생각해 봤다는 증거다
 *
 * **한 방향으로만 강제한다.** 선언된 true 는 전부 조건을 만족해야 하지만, 조건을
 * 만족한다고 켜야 하는 것은 아니다. 숫자가 통과해도 위험한 줄 아는 규칙은 꺼 둘 수 있어야 한다.
 */

const 자동적용규칙 = [...allRules, ...allMorphRules].filter((r) => r.autoFixSafe === true)

// (가) 정상 글에서 **자동 적용될 뻔한** 자리. 규칙 개수가 아니라 실제 사고 건수를 센다.
const wouldAutoFix = []
for (const sentence of wild.sentences) {
  for (const d of check(sentence, analyzer ? { analyzer } : {})) {
    if (d.autoFixSafe) wouldAutoFix.push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${sentence.slice(0, 40)}`)
  }
}
for (const { file, line } of proseTexts) {
  for (const d of check(line, analyzer ? { analyzer } : {})) {
    if (d.autoFixSafe) wouldAutoFix.push(`${d.ruleId}: ${d.text} → ${d.suggestions[0]}  |  ${file}  |  ${line.slice(0, 34)}`)
  }
}
must(
  `밖에서 온 정상 글에 묻지 않고 손댈 자리 0건 — 규칙 ${자동적용규칙.length}개가 자격을 가짐`,
  wouldAutoFix.length === 0,
  `자동 적용될 뻔한 곳 ${wouldAutoFix.length}건`,
)

// (나)·(다) 선언이 근거를 갖췄는가. 정탐은 재현율 표본에서 규칙별로 센다.
const 정탐수 = new Map()
for (const texts of [corpus.texts, prose.paragraphs]) {
  for (const t of texts) {
    const found = errorsOf(t.source, true)
    let cursor = 0
    for (const e of t.errors) {
      const at = t.source.indexOf(e.wrongText, cursor)
      if (at === -1) continue
      cursor = at
      const end = at + e.wrongText.length
      const hit = found.find((d) => Math.min(d.end, end) - Math.max(d.start, at) > 0)
      if (!hit) continue
      const id = hit.ruleId.split('/')[0]
      정탐수.set(id, (정탐수.get(id) ?? 0) + 1)
    }
  }
}
const 근거없는선언 = []
for (const r of 자동적용규칙) {
  const 반례 = r.counterExamples?.length ?? 0
  const 정탐 = 정탐수.get(r.id) ?? 0
  if (반례 === 0) 근거없는선언.push(`${r.id} — 반례가 없다. 이 규칙이 건드리면 안 되는 문장을 적을 것`)
  else if (정탐 === 0) 근거없는선언.push(`${r.id} — 표본에서 한 번도 정탐한 적이 없다. 그 오류가 든 표본을 넣을 것`)
}
must(
  '자동 적용 선언이 전부 근거를 갖췄다',
  근거없는선언.length === 0,
  `근거 없는 선언 ${근거없는선언.length}건`,
)

/* ── 7. 내보낼 수 있는 상태인가 ──────────────────────────────
 *
 * `prepublishOnly`가 `check-publish.mjs`로 같은 것을 더 깊이 본다. 그런데 그건
 * **내보내는 순간에만** 돈다 — 그때 막히면 이미 태그를 밀고 릴리스가 도는 중이다.
 * 손으로 고칠 수 있는 것 몇 가지는 여기서 미리 잡아, 밀기 전에 알게 한다.
 */

const 패키지 = ['core', 'morph', 'store'].map((name) => read(`packages/${name}/package.json`))
const 코어 = 패키지.find((p) => p.name === '@gochim/core')

// store 는 코어의 `ignoreKey` 를 실행 시점에 가져다 쓰고 morph 는 코어의 타입에 기댄다.
// 둘 다 peer 로 `^코어판` 을 거는데 0.x 에서 캐럿은 `<0.2.0` 이라, 코어만 올리면 곧바로 ERESOLVE 다.
// 범위를 느슨하게 푸는 것은 답이 아니다 — 안 맞는 짝이 조용히 설치된다. 셋을 함께 올린다.
const 판어긋남 = 패키지.filter((p) => p.version !== 코어.version).map((p) => `${p.name}@${p.version}`)
must(
  `세 패키지가 같은 판이다 — ${코어.version}`,
  판어긋남.length === 0,
  판어긋남.length ? `어긋난 것 ${판어긋남.join(', ')} — 셋은 늘 함께 올린다` : '',
)

const peer어긋남 = 패키지
  .filter((p) => p.peerDependencies?.['@gochim/core'] && p.peerDependencies['@gochim/core'] !== `^${코어.version}`)
  .map((p) => `${p.name} → ${p.peerDependencies['@gochim/core']}`)
must(
  'peer 범위가 코어 판을 가리킨다',
  peer어긋남.length === 0,
  peer어긋남.length ? `어긋난 것 ${peer어긋남.join(', ')} — '^${코어.version}' 이어야 한다` : '',
)

must(
  `코드에 적힌 VERSION 이 package.json 과 같다 — ${VERSION}`,
  VERSION === 코어.version,
  VERSION === 코어.version ? '' : `VERSION 은 '${VERSION}' 인데 package.json 은 ${코어.version} 이다`,
)

// `require()` 가 닿을 조건이 없으면 CommonJS 쪽에서 부르는 순간
// "No exports main defined" 로 끝난다. ESM이라는 말은 한마디도 안 나온다.
const 조건없음 = 패키지
  .filter((p) => {
    const c = p.exports?.['.']
    return c && typeof c === 'object' && !c.require && !c.default
  })
  .map((p) => p.name)
must(
  'exports 가 CommonJS 쪽에서도 닿는다',
  조건없음.length === 0,
  조건없음.length ? `require/default 가 없는 것 ${조건없음.join(', ')}` : '',
)

/**
 * 목록에 있는데 이제 안 나오는 갈래는 **고쳐졌다는 뜻**이다. 알려 주고 지우게 한다.
 * 남겨 두면 목록이 낡아 다음 사람이 무엇이 살아 있는 오탐인지 알 수 없게 된다.
 */
const stillFiring = new Set([...wildHits[1], ...wildHits[3], ...proseHits].map((h) => h.key))
const fixedSince = [...KNOWN_FALSE_POSITIVES].filter((known) =>
  known.endsWith('*')
    ? ![...stillFiring].some((k) => k.startsWith(known.slice(0, -1)))
    : !stillFiring.has(known),
)

/* ── 결과 ────────────────────────────────────────────────────── */

console.log()
console.log('고침 — 지켜야 할 선')
console.log('='.repeat(60))
for (const line of lines) console.log(line)
if (!analyzer) console.log('  ! 형태소 분석기 빌드가 없어 3층은 재지 않았다 (npm run build -w @gochim/morph)')
console.log('='.repeat(60))

for (const [layer, list] of [['1층', falsePositives[1]], ['형태소 층 포함', falsePositives[3]]]) {
  if (list.length === 0) continue
  console.log()
  console.log(`오탐 (${layer}) — 정밀도를 깨는 것이라 가장 먼저 고쳐야 한다`)
  for (const f of list.slice(0, 20)) console.log(`  ${f}`)
  if (list.length > 20) console.log(`  … 외 ${list.length - 20}건`)
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

// 처음 보는 오탐은 **왜 실패했는지**라서 먼저, 크게 찍는다.
for (const [title, list] of [
  ['처음 보는 오탐 — 밖에서 온 정상 문장', analyzer ? wildNew[3] : wildNew[1]],
  ['처음 보는 지적 — 저장소 자기 산문', proseNew],
]) {
  if (list.length === 0) continue
  console.log()
  console.log(`${title} (${list.length}건)`)
  console.log('  알고 있던 갈래가 아니다. 규칙이 새로 망가졌거나, 목록에 없던 오탐을 이제 만난 것이다.')
  for (const x of list) console.log(`  ${x.line}`)
}

// 알려진 오탐도 **선을 안 넘었어도 매번 찍는다.** 눈에 보여야 줄어든다.
for (const [title, list] of [
  ['알려진 오탐 — 밖에서 온 정상 문장 (형태소 층 포함)', analyzer ? wildHits[3] : wildHits[1]],
  ['알려진 오탐 — 저장소 자기 산문', proseHits],
]) {
  const known = list.filter((h) => isKnown(h.key))
  if (known.length === 0) continue
  console.log()
  console.log(`${title} — ${known.length}건, 전부 고쳐야 할 것들이다`)
  for (const x of known) console.log(`  ${x.line}`)
}

if (fixedSince.length > 0) {
  console.log()
  console.log(`고쳐진 오탐 ${fixedSince.length}가지 — guard.mjs의 KNOWN_FALSE_POSITIVES에서 지워도 된다`)
  for (const k of fixedSince) console.log(`  ${k}`)
}

if (wouldAutoFix.length > 0) {
  console.log()
  console.log(`자동 적용될 뻔한 정상 문장 (${wouldAutoFix.length}건)`)
  console.log('  자격을 선언한 규칙이 맞는 글을 건드렸다. 규칙을 고치거나 autoFixSafe 를 내릴 것.')
  for (const x of wouldAutoFix.slice(0, 20)) console.log(`  ${x}`)
}

if (근거없는선언.length > 0) {
  console.log()
  console.log(`근거 없는 자동 적용 선언 (${근거없는선언.length}건)`)
  for (const x of 근거없는선언) console.log(`  ${x}`)
}

analyzer?.destroy()

console.log()
if (failed > 0) {
  console.log(`${failed}가지가 선을 넘었다.`)
  process.exit(1)
}
console.log('전부 통과.')
