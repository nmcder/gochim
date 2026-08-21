import type { Morpheme, MorphFinding, MorphRuleContext, Word } from '../types.js'
import { groupWords, morphemeOffset } from './words.js'

/**
 * 어절을 두 조각으로 가르는 규칙들이 함께 쓰는 도구.
 *
 * [eojeol.ts](./eojeol.ts)(체언·관형사형·부사)와 [bojo.ts](./bojo.ts)(보조용언)가
 * 같은 세 가지 문제를 만난다 — 어절 끝의 문장부호, 문장 안에서 안이 안 보이는 어절,
 * 불규칙 활용으로 어긋나는 위치 계산. 셋 다 여기서 한 번만 푼다.
 */

/** 어절 범위에는 뒤따르는 문장부호가 딸려 온다. 밑줄은 글자에만 긋는다. */
export function trimTail(text: string): string {
  return text.replace(/[\s.,!?…"')\]}]+$/, '')
}

/**
 * 어절을 다시 분석해 본다.
 *
 * 분석기는 **문장 안에서** 모르는 어절을 만나면 통째로 미등록 명사 하나로 처리한다.
 *
 *   문장 안: `물이끓으면` → 물이끓으면/NNG            (안이 안 보인다)
 *   따로:    `물이끓으면` → 물/NNG + 이/JKS + 끓/VV + 으면/EC
 *
 * 붙여 쓴 어절이 바로 그 "모르는 말"이라, 문장 분석만 믿으면 정작 고쳐야 할 자리를
 * 통째로 놓친다. 그래서 한 덩어리로 나온 긴 어절은 떼어 내 한 번 더 물어본다.
 */
export function reanalyze(ctx: MorphRuleContext, word: Word): readonly Morpheme[] {
  // 이미 여러 형태소로 갈렸으면 그 결과를 믿는다.
  if (word.morphemes.length > 1) return word.morphemes
  const trimmed = trimTail(word.text)
  // 짧은 말은 미등록이어도 가를 것이 없다.
  if (trimmed.length < 4) return word.morphemes
  const solo = groupWords(trimmed, ctx.analyze(trimmed))
  // 떼어 놓고도 한 덩어리면 진짜 한 낱말이다.
  if (solo.length !== 1) return word.morphemes
  return solo[0]!.morphemes
}

/**
 * 가를 자리를 찾는다.
 *
 * [morphemeOffset](./words.ts)은 앞에서부터 자모를 맞춰 나가다가 불규칙 활용을 만나면
 * 포기한다. `힘들 + ㄴ = 힘든`처럼 어간의 받침이 바뀌면 정렬이 어긋나기 때문이다.
 *
 * 그럴 때는 **뒤에서부터** 센다. 가를 자리 뒤의 형태소를 이어 붙인 것이 어절의 꼬리와
 * 정확히 같으면 그 길이만큼 물러난 자리가 답이다. 정확히 같을 때만 쓰므로
 * 앞쪽이 어떻게 바뀌었든 상관이 없다.
 */
export function splitPoint(word: Word, i: number, trimmed: string): number | null {
  const byJamo = morphemeOffset(word, i)
  if (byJamo != null) return byJamo
  const tail = word.morphemes.slice(i).map((m) => m.text).join('')
  if (tail.length === 0 || !trimmed.endsWith(tail)) return null
  return trimmed.length - tail.length
}

/** 어절을 두 조각으로 가르는 진단. 뒤따르는 문장부호는 밑줄에서 뺀다. */
export function splitAt(
  word: Word,
  at: number,
  finding: Omit<MorphFinding, 'start' | 'end' | 'suggestions'>,
): MorphFinding | null {
  const trimmed = trimTail(word.text)
  if (at <= 0 || at >= trimmed.length) return null
  return {
    ...finding,
    start: word.start,
    end: word.start + trimmed.length,
    suggestions: [`${trimmed.slice(0, at)} ${trimmed.slice(at)}`],
  }
}

/**
 * 이 어절을 형태소로 갈라 볼 만한가.
 *
 * 숫자·영문이 섞이면 분석기가 자주 흔들린다. 순한글 어절만 본다.
 */
export function isPlainHangulWord(text: string): boolean {
  return /^[가-힣]+[\s.,!?…"')\]}]*$/.test(text)
}
