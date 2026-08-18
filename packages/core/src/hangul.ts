/**
 * 한글 음절 ↔ 자모 변환 유틸.
 *
 * 고침의 규칙 상당수는 "받침이 있는가", "종성이 ㄹ인가" 같은 조건에 걸린다.
 * 예) `-이에요/-예요`는 앞말 받침 유무로 갈리고, `할수있다`의 띄어쓰기는
 * 앞 음절 종성이 ㄹ(관형사형 어미)이라는 사실에서 나온다.
 * 이런 판정을 문자열 목록이 아니라 유니코드 연산으로 처리하기 위한 계층이다.
 *
 * 참고: 한글 음절은 U+AC00 ~ U+D7A3에 초성 19 × 중성 21 × 종성 28 순서로 배열된다.
 */

const S_BASE = 0xac00
const V_COUNT = 21
const T_COUNT = 28
const N_COUNT = V_COUNT * T_COUNT // 588
const S_COUNT = 19 * N_COUNT // 11172

/** 초성 19자 (호환 자모). */
export const LEADS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/** 중성 21자. */
export const VOWELS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const

/** 종성 28자. 인덱스 0은 "받침 없음". */
export const TAILS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

export interface Jamo {
  /** 초성 (호환 자모 1글자). */
  lead: string
  /** 중성. */
  vowel: string
  /** 종성. 받침이 없으면 빈 문자열. */
  tail: string
}

/** 완성형 한글 음절인가. (자모 낱글자 'ㄱ', 'ㅏ' 는 false) */
export function isSyllable(ch: string): boolean {
  if (!ch) return false
  const code = ch.codePointAt(0)!
  return code >= S_BASE && code < S_BASE + S_COUNT
}

/** 한글(음절 + 낱자모) 인가. */
export function isHangul(ch: string): boolean {
  if (!ch) return false
  const c = ch.codePointAt(0)!
  return (c >= S_BASE && c < S_BASE + S_COUNT) || (c >= 0x3131 && c <= 0x318e)
}

/** 음절을 초·중·종성으로 분해한다. 완성형 음절이 아니면 null. */
export function decompose(ch: string): Jamo | null {
  if (!isSyllable(ch)) return null
  const index = ch.codePointAt(0)! - S_BASE
  return {
    lead: LEADS[Math.floor(index / N_COUNT)]!,
    vowel: VOWELS[Math.floor((index % N_COUNT) / T_COUNT)]!,
    tail: TAILS[index % T_COUNT]!,
  }
}

/** 초·중·종성을 음절로 합친다. 잘못된 자모가 오면 null. */
export function compose(lead: string, vowel: string, tail = ''): string | null {
  const l = LEADS.indexOf(lead as (typeof LEADS)[number])
  const v = VOWELS.indexOf(vowel as (typeof VOWELS)[number])
  const t = TAILS.indexOf(tail as (typeof TAILS)[number])
  if (l < 0 || v < 0 || t < 0) return null
  return String.fromCodePoint(S_BASE + l * N_COUNT + v * T_COUNT + t)
}

/** 종성(받침)을 돌려준다. 받침이 없거나 한글 음절이 아니면 빈 문자열. */
export function finalOf(ch: string): string {
  return decompose(ch)?.tail ?? ''
}

/**
 * 받침이 있는가.
 * @param jamo 특정 받침으로 한정할 때 지정 (예: `hasFinal('할', 'ㄹ')`)
 */
export function hasFinal(ch: string, jamo?: string): boolean {
  const tail = finalOf(ch)
  if (!tail) return false
  return jamo === undefined ? true : tail === jamo
}

/** 받침을 바꾼 음절을 돌려준다. 빈 문자열을 주면 받침을 없앤다. */
export function withFinal(ch: string, tail: string): string | null {
  const j = decompose(ch)
  if (!j) return null
  return compose(j.lead, j.vowel, tail)
}

/** 받침만 떼어낸 음절. `할` → `하` */
export function stripFinal(ch: string): string | null {
  return withFinal(ch, '')
}

/** 문자열의 마지막 음절 기준 받침 유무. 조사 선택(`은/는`, `이/가`) 판정용. */
export function endsWithFinal(word: string): boolean {
  const last = [...word].at(-1)
  return last ? hasFinal(last) : false
}

/**
 * 받침 유무에 따라 조사를 고른다.
 * `josa('학교', '은/는')` → `는`
 */
export function josa(word: string, pair: string): string {
  const [withBatchim, withoutBatchim] = pair.split('/')
  return endsWithFinal(word) ? (withBatchim ?? '') : (withoutBatchim ?? '')
}
