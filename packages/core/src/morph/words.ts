import { decompose, isSyllable } from '../hangul.js'
import type { Morpheme, Word } from '../types.js'

/**
 * 형태소 목록을 어절 단위로 묶는다.
 *
 * 분석기는 형태소마다 **그 형태소가 속한 어절의 범위**를 준다(형태소 자체의 범위가 아니다).
 * `할수있다`를 넣으면 다섯 형태소가 전부 `@0-4`를 갖는 식이다.
 * 이 성질 덕분에 "의존명사가 앞말에 붙어 있는가"를 바로 알 수 있다 —
 * 어절 안에 형태소가 둘 이상이면 붙어 있는 것이다.
 */
export function groupWords(text: string, morphemes: readonly Morpheme[]): Word[] {
  const words: Word[] = []
  for (const m of morphemes) {
    const last = words[words.length - 1]
    if (last && last.start === m.start && last.end === m.end) {
      last.morphemes.push(m)
      continue
    }
    words.push({ start: m.start, end: m.end, text: text.slice(m.start, m.end), morphemes: [m] })
  }
  return words
}

/** 음절 문자열을 자모 배열로 펼치고, 각 자모가 몇 번째 음절에서 왔는지 함께 돌려준다. */
function toJamo(text: string): { jamo: string[]; syllableOf: number[] } {
  const jamo: string[] = []
  const syllableOf: number[] = []
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!
    if (isSyllable(ch)) {
      const { lead, vowel, tail } = decompose(ch)!
      jamo.push(lead, vowel)
      syllableOf.push(i, i)
      if (tail) {
        jamo.push(tail)
        syllableOf.push(i)
      }
    } else {
      jamo.push(ch)
      syllableOf.push(i)
    }
  }
  return { jamo, syllableOf }
}

/**
 * 어절 안에서 n번째 형태소가 시작하는 **글자 위치**를 찾는다.
 *
 * 형태소는 표면형과 다를 수 있어서(`할` = `하` + `ㄹ`) 문자열 검색으로는 못 찾는다.
 * 그래서 어절과 형태소를 모두 자모로 펼쳐 앞에서부터 맞춰 나간다.
 * 불규칙 활용으로 한 글자라도 어긋나면 **위치를 포기한다** — 틀린 자리에 밑줄을 긋느니 안 긋는 게 낫다.
 *
 * @returns 어절 시작을 0으로 하는 상대 위치. 정렬에 실패하면 null.
 */
export function morphemeOffset(word: Word, index: number): number | null {
  if (index <= 0) return 0

  const { jamo, syllableOf } = toJamo(word.text)
  let cursor = 0

  for (let i = 0; i < index; i += 1) {
    const surface = word.morphemes[i]!.text
    const piece = toJamo(surface).jamo
    for (const j of piece) {
      if (jamo[cursor] !== j) return null
      cursor += 1
    }
  }

  if (cursor >= jamo.length) return null
  const syllable = syllableOf[cursor]
  if (syllable === undefined) return null
  // 음절 중간(중성·종성)에서 형태소가 시작하면 그 자리에는 공백을 넣을 수 없다.
  if (syllableOf[cursor - 1] === syllable) return null
  return syllable
}
