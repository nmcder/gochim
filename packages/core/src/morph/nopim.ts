import { hasFinal } from '../hangul.js'
import { insideQuotes } from '../protect.js'
import type { MorphFinding, MorphRule, MorphRuleContext, Word } from '../types.js'
import { trimTail } from './split.js'
import { morphemeOffset } from './words.js'

/**
 * 주체 높임 호응 (3층).
 *
 * 주격 조사 `께서`는 그 자체로 주어를 높이는 형태다. 그런데 서술어에 `-시-`를 넣지 않아
 * 높임이 반쪽만 되는 일이 아주 잦다.
 *
 *   어머니께서 만드는 법을 알려 줬는데   →  알려 주셨는데
 *   손님들께서 한참을 기다렸습니다        →  기다리셨습니다
 *   이장님께서도 자리를 함께했다          →  함께하셨다
 *
 * ## 왜 1층으로는 부족했나
 *
 * [kkeseo-agreement-past](../rules/honorific-hanja.ts)는 같은 자리를 문자열로 잡는다.
 * 높이지 않은 과거형과 높인 과거형을 **짝으로 적은 표**를 들고 있어서
 * (`갔→가셨`, `물어봤→물어보셨`) 표에 없는 용언은 손도 못 댄다.
 * 어간이 몇 글자인지 모르니 표 없이는 `기다렸` 앞에 `-시-`를 끼워 넣을 수가 없다.
 *
 * 품사를 알면 표가 필요 없다. 분석기가 어간을 그대로 준다.
 *
 *   기다렸습니다 → 기다리/VV + 었/EP + 습니다/EF
 *   함께했다     → 함께/MAG + 하/VV + 았/EP + 다/EF
 *
 * 과거 선어말어미 자리에 `-시-`를 끼우면 그만이다 — `기다리 + 셨 + 습니다`.
 * 받침이 있으면 매개모음이 붙어 `받 + 으셨 + 다`가 된다.
 *
 * ## 어디까지가 그 주어의 서술어인가
 *
 * 이게 이 규칙의 전부다. `께서`가 앞에 있다고 뒤의 아무 용언이나 고치면 안 된다.
 *
 *   할머니께서 계신 병원에 갔는데     ← `갔다`의 주어는 나다
 *   사장님께서 오라고 해서 내가 봤는데 ← 주어가 바뀌었다
 *
 * 그래서 **절이 끝날 때까지만** 본다. 문장부호나 줄바꿈이 나오면 거기서 끊고,
 * 그 안의 마지막 용언 어절만 손댄다. 그리고 셋 중 하나라도 걸리면 물러난다.
 *
 *  - 사이에 다른 주격 조사가 나온다 (`내가`)
 *  - 사이에 이미 높임이 있다 (`계신`, `시키신`, `부르셔서`) — 그 절의 서술어는 따로 있다
 *  - 절이 너무 길다 (여덟 어절 넘음) — 안에서 주어가 바뀌었을 공산이 크다
 */

/** 용언 어간으로 볼 수 있는 태그. */
const VERB_STEM = new Set(['VV', 'VA', 'VX', 'XSV', 'XSA'])
/** 과거 선어말어미. 이 자리에 `-시-`를 끼운다. */
const PAST = new Set(['았', '었', '였'])
/** 절을 끊는 글자. */
const CLAUSE_BREAK = /[.,!?…;:\n\r"'”’」』)\]]/
/** 이미 높임이 든 어절인지 겉모양으로 본다. 분석기가 `-시-`를 어간에 붙여 내놓기도 한다. */
const HAS_HONORIFIC = /[시셔셨신실십세셈]/

/**
 * `있다`는 높임말이 따로 있다 — `계시다`.
 *
 * `-시-`를 끼우는 것으로는 안 되고 낱말을 통째로 바꿔야 해서 표로 적는다.
 */
const ITDA_HONORED: Record<string, string> = {
  있다: '계시다',
  있습니다: '계십니다',
  있어요: '계세요',
  있습니까: '계십니까',
  있었다: '계셨다',
  있었습니다: '계셨습니다',
  있는데: '계신데',
  있고: '계시고',
}

/** 이 어절에 용언이 들어 있는가. */
function hasVerb(word: Word): boolean {
  return word.morphemes.some((m) => VERB_STEM.has(m.pos))
}

/** 주격 조사가 들어 있는가. 절 안에서 주어가 바뀐 신호다. */
function hasSubject(word: Word): boolean {
  return word.morphemes.some((m) => m.pos === 'JKS')
}

/**
 * 과거형에 `-시-`를 끼운 꼴을 만든다.
 *
 * 어절을 [앞부분][어간][과거][나머지]로 보고 과거 자리를 `셨`/`으셨`으로 갈아 끼운다.
 * 나머지가 겉으로 그대로 드러나야만 손댄다 — 자모로만 남은 어미(`ㅂ니다`)는 붙일 수 없다.
 */
function honorPast(word: Word, trimmed: string): string | null {
  const at = word.morphemes.findIndex((m) => m.pos === 'EP' && PAST.has(m.text))
  if (at < 1) return null
  const stem = word.morphemes[at - 1]!
  if (!VERB_STEM.has(stem.pos)) return null

  // 문장부호(S로 시작하는 태그)는 어절 범위 안에 들어와 있다. 어미만 남긴다.
  const tail = word.morphemes
    .slice(at + 1)
    .filter((m) => !m.pos.startsWith('S'))
    .map((m) => m.text)
    .join('')
  if (tail.length === 0 || !trimmed.endsWith(tail)) return null

  const head = at === 1 ? '' : trimmed.slice(0, morphemeOffset(word, at - 1) ?? -1)
  if (head === trimmed) return null
  if (at > 1 && morphemeOffset(word, at - 1) == null) return null

  const last = stem.text[stem.text.length - 1] ?? ''
  const si = hasFinal(last) ? '으셨' : '셨'
  return `${head}${stem.text}${si}${tail}`
}

export const morphKkeseoAgreement: MorphRule = {
  id: 'morph-kkeseo-agreement',
  autoFixSafe: true,
  // 높임 갈래를 따로 두지 않았다. 1층의 높임 규칙들도 'ending'에 들어 있다.
  category: 'ending',
  severity: 'error',
  confidence: 0.88,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (let i = 0; i < ctx.words.length; i += 1) {
      const subject = ctx.words[i]!
      if (!subject.morphemes.some((m) => m.pos === 'JKS' && m.text === '께서')) continue
      if (insideQuotes(ctx.text, subject.start)) continue

      // 절이 끝날 때까지 모은다.
      const run: Word[] = []
      let broken = false
      for (let j = i + 1; j < ctx.words.length && run.length <= 8; j += 1) {
        const between = ctx.text.slice(ctx.words[j - 1]!.end, ctx.words[j]!.start)
        if (CLAUSE_BREAK.test(between)) break
        const word = ctx.words[j]!
        if (hasSubject(word) || HAS_HONORIFIC.test(word.text)) {
          broken = true
          break
        }
        run.push(word)
        // 어절 끝에 문장부호가 붙어 있으면 여기가 절의 끝이다.
        if (CLAUSE_BREAK.test(ctx.text.slice(word.end - 1, word.end + 1))) break
      }
      if (broken || run.length === 0 || run.length > 8) continue

      const target = run[run.length - 1]!
      if (!hasVerb(target)) continue

      const trimmed = trimTail(target.text)
      // 절이 정말 끝났는지 확인한다. 문장이 이어지면 이 어절은 서술어가 아니다.
      // 어절 범위에는 뒤따르는 문장부호가 딸려 오므로 글자 길이로 다시 센다.
      const after = ctx.text.slice(target.start + trimmed.length)
      if (after.length > 0 && !CLAUSE_BREAK.test(after[0]!) && !/^\s*$/.test(after)) continue
      const suggestion = ITDA_HONORED[trimmed] ?? honorPast(target, trimmed)
      if (!suggestion || suggestion === trimmed) continue

      found.push({
        start: target.start,
        end: target.start + trimmed.length,
        suggestions: [suggestion],
        message: "'께서'가 주어면 서술어에도 높임을 씁니다.",
        explain:
          "주격 조사 '께서'는 주어를 높이는 형태입니다. 서술어에 '-시-'를 넣지 않으면 높임이 반쪽만 됩니다. ('있다'의 높임말은 '계시다'입니다)",
        refs: ['표준 언어 예절'],
      })
    }

    return found
  },
  examples: [
    { wrong: '어머니께서 만드는 법을 알려 줬는데.', right: '어머니께서 만드는 법을 알려 주셨는데.' },
    { wrong: '손님들께서 계산대 앞에서 한참을 기다렸습니다.', right: '손님들께서 계산대 앞에서 한참을 기다리셨습니다.' },
    { wrong: '이장님께서도 자리를 함께했다.', right: '이장님께서도 자리를 함께하셨다.' },
    { wrong: '어머니께서도 무릎 때문에 치료를 받고 있습니다.', right: '어머니께서도 무릎 때문에 치료를 받고 계십니다.' },
  ],
  counterExamples: [
    '할머니께서 계신 병원에 갔는데 사람이 많았다.',
    '사장님께서 시키신 일을 했는데 칭찬을 들었다.',
    '아버지께서 주신 용돈으로 책을 샀는데 벌써 다 읽었다.',
    '교수님께서 부르셔서 연구실에 갔는데 아무도 없었다.',
    '사장님께서 오라고 해서 내가 자료를 봤는데 문제가 없었다.',
    '선생님께서 화를 내셨는데 이유를 몰랐다.',
    '아버지께서 저녁을 차려 주셨다.',
    '할머니께서 방에 계신다.',
  ],
}
