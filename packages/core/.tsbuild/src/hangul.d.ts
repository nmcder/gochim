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
/** 초성 19자 (호환 자모). */
export declare const LEADS: readonly ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
/** 중성 21자. */
export declare const VOWELS: readonly ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
/** 종성 28자. 인덱스 0은 "받침 없음". */
export declare const TAILS: readonly ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
export interface Jamo {
    /** 초성 (호환 자모 1글자). */
    lead: string;
    /** 중성. */
    vowel: string;
    /** 종성. 받침이 없으면 빈 문자열. */
    tail: string;
}
/** 완성형 한글 음절인가. (자모 낱글자 'ㄱ', 'ㅏ' 는 false) */
export declare function isSyllable(ch: string): boolean;
/** 한글(음절 + 낱자모) 인가. */
export declare function isHangul(ch: string): boolean;
/** 음절을 초·중·종성으로 분해한다. 완성형 음절이 아니면 null. */
export declare function decompose(ch: string): Jamo | null;
/** 초·중·종성을 음절로 합친다. 잘못된 자모가 오면 null. */
export declare function compose(lead: string, vowel: string, tail?: string): string | null;
/** 종성(받침)을 돌려준다. 받침이 없거나 한글 음절이 아니면 빈 문자열. */
export declare function finalOf(ch: string): string;
/**
 * 받침이 있는가.
 * @param jamo 특정 받침으로 한정할 때 지정 (예: `hasFinal('할', 'ㄹ')`)
 */
export declare function hasFinal(ch: string, jamo?: string): boolean;
/** 받침을 바꾼 음절을 돌려준다. 빈 문자열을 주면 받침을 없앤다. */
export declare function withFinal(ch: string, tail: string): string | null;
/** 받침만 떼어낸 음절. `할` → `하` */
export declare function stripFinal(ch: string): string | null;
/** 문자열의 마지막 음절 기준 받침 유무. 조사 선택(`은/는`, `이/가`) 판정용. */
export declare function endsWithFinal(word: string): boolean;
/**
 * 받침 유무에 따라 조사를 고른다.
 * `josa('학교', '은/는')` → `는`
 */
export declare function josa(word: string, pair: string): string;
/** 이 조사 쌍에서 `word` 뒤에 붙어야 하는 형태. */
export declare function josaOf(word: string, pair: readonly [string, string]): string;
/**
 * 표기를 고치면서 받침이 바뀔 때, 뒤따르는 조사도 함께 고친다.
 *
 * `케잌을 → 케이크를`처럼 받침이 사라지거나 생기면 조사 형태도 달라진다.
 * 이걸 놓치면 `케이크을`이라는 새 오류를 만들어 낸다.
 *
 * @param rest 고칠 말 바로 뒤에 이어지는 원문
 * @returns 조사까지 함께 바꿔야 하면 그 정보를, 바꿀 필요가 없으면 null
 */
export declare function adaptJosa(from: string, to: string, rest: string): {
    consumed: number;
    josa: string;
} | null;
//# sourceMappingURL=hangul.d.ts.map