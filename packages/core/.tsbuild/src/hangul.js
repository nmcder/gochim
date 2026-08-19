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
const S_BASE = 0xac00;
const V_COUNT = 21;
const T_COUNT = 28;
const N_COUNT = V_COUNT * T_COUNT; // 588
const S_COUNT = 19 * N_COUNT; // 11172
/** 초성 19자 (호환 자모). */
export const LEADS = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
/** 중성 21자. */
export const VOWELS = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
    'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
/** 종성 28자. 인덱스 0은 "받침 없음". */
export const TAILS = [
    '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
    'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
/** 완성형 한글 음절인가. (자모 낱글자 'ㄱ', 'ㅏ' 는 false) */
export function isSyllable(ch) {
    if (!ch)
        return false;
    const code = ch.codePointAt(0);
    return code >= S_BASE && code < S_BASE + S_COUNT;
}
/** 한글(음절 + 낱자모) 인가. */
export function isHangul(ch) {
    if (!ch)
        return false;
    const c = ch.codePointAt(0);
    return (c >= S_BASE && c < S_BASE + S_COUNT) || (c >= 0x3131 && c <= 0x318e);
}
/** 음절을 초·중·종성으로 분해한다. 완성형 음절이 아니면 null. */
export function decompose(ch) {
    if (!isSyllable(ch))
        return null;
    const index = ch.codePointAt(0) - S_BASE;
    return {
        lead: LEADS[Math.floor(index / N_COUNT)],
        vowel: VOWELS[Math.floor((index % N_COUNT) / T_COUNT)],
        tail: TAILS[index % T_COUNT],
    };
}
/** 초·중·종성을 음절로 합친다. 잘못된 자모가 오면 null. */
export function compose(lead, vowel, tail = '') {
    const l = LEADS.indexOf(lead);
    const v = VOWELS.indexOf(vowel);
    const t = TAILS.indexOf(tail);
    if (l < 0 || v < 0 || t < 0)
        return null;
    return String.fromCodePoint(S_BASE + l * N_COUNT + v * T_COUNT + t);
}
/** 종성(받침)을 돌려준다. 받침이 없거나 한글 음절이 아니면 빈 문자열. */
export function finalOf(ch) {
    return decompose(ch)?.tail ?? '';
}
/**
 * 받침이 있는가.
 * @param jamo 특정 받침으로 한정할 때 지정 (예: `hasFinal('할', 'ㄹ')`)
 */
export function hasFinal(ch, jamo) {
    const tail = finalOf(ch);
    if (!tail)
        return false;
    return jamo === undefined ? true : tail === jamo;
}
/** 받침을 바꾼 음절을 돌려준다. 빈 문자열을 주면 받침을 없앤다. */
export function withFinal(ch, tail) {
    const j = decompose(ch);
    if (!j)
        return null;
    return compose(j.lead, j.vowel, tail);
}
/** 받침만 떼어낸 음절. `할` → `하` */
export function stripFinal(ch) {
    return withFinal(ch, '');
}
/** 문자열의 마지막 음절 기준 받침 유무. 조사 선택(`은/는`, `이/가`) 판정용. */
export function endsWithFinal(word) {
    const last = [...word].at(-1);
    return last ? hasFinal(last) : false;
}
/**
 * 받침 유무에 따라 조사를 고른다.
 * `josa('학교', '은/는')` → `는`
 */
export function josa(word, pair) {
    const [withBatchim, withoutBatchim] = pair.split('/');
    return endsWithFinal(word) ? (withBatchim ?? '') : (withoutBatchim ?? '');
}
/**
 * 앞말에 따라 형태가 바뀌는 조사 쌍. 앞이 받침 있을 때 / 없을 때 순서다.
 *
 * `으로/로`만 예외가 하나 있다 — ㄹ받침 뒤에서는 받침이 있어도 `로`를 쓴다
 * ('서울로', '연필로'). 그래서 단순한 받침 유무 판정으로는 부족하다.
 */
const JOSA_PAIRS = [
    ['은', '는'],
    ['이', '가'],
    ['을', '를'],
    ['과', '와'],
    ['으로', '로'],
    ['이랑', '랑'],
    ['이나', '나'],
    ['이라', '라'],
    ['이야', '야'],
    ['이에요', '예요'],
];
/** 이 조사 쌍에서 `word` 뒤에 붙어야 하는 형태. */
export function josaOf(word, pair) {
    const [withBatchim, withoutBatchim] = pair;
    if (withBatchim === '으로') {
        // ㄹ받침은 받침이 없는 것처럼 '로'를 취한다.
        const last = [...word].at(-1);
        return endsWithFinal(word) && finalOf(last ?? '') !== 'ㄹ' ? withBatchim : withoutBatchim;
    }
    return endsWithFinal(word) ? withBatchim : withoutBatchim;
}
/**
 * 표기를 고치면서 받침이 바뀔 때, 뒤따르는 조사도 함께 고친다.
 *
 * `케잌을 → 케이크를`처럼 받침이 사라지거나 생기면 조사 형태도 달라진다.
 * 이걸 놓치면 `케이크을`이라는 새 오류를 만들어 낸다.
 *
 * @param rest 고칠 말 바로 뒤에 이어지는 원문
 * @returns 조사까지 함께 바꿔야 하면 그 정보를, 바꿀 필요가 없으면 null
 */
export function adaptJosa(from, to, rest) {
    for (const pair of JOSA_PAIRS) {
        const current = josaOf(from, pair);
        if (!rest.startsWith(current))
            continue;
        const adapted = josaOf(to, pair);
        if (adapted === current)
            return null;
        return { consumed: current.length, josa: adapted };
    }
    return null;
}
//# sourceMappingURL=hangul.js.map