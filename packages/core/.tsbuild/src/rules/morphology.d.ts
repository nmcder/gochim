import type { Rule } from '../types.js';
/**
 * 받침을 보고 판정하는 규칙들.
 *
 * 사전에 단어를 하나씩 넣는 대신 **규칙 자체를 코드로 적는다.**
 * `경쟁율/경쟁률`은 표제어를 다 모을 수 없지만, "앞말 받침이 ㄴ이거나 없으면 율,
 * 그 밖에는 률"이라는 규정 하나로 전부 처리된다.
 */
/** 두음법칙 — 모음이나 ㄴ 받침 뒤에서는 '열·율', 그 밖에는 '렬·률'. */
export declare const dueumYul: Rule;
/** 두음법칙 — 어두의 '년'은 '연'으로 적는다. 수 뒤에 오는 의존명사 '년'은 그대로. */
export declare const dueumYeon: Rule;
/** `-슴`은 없다. 명사형 어미는 `-(으)ㅁ`이라 `했음`이다. */
export declare const myeongsahyeongEum: Rule;
/** 까닭을 나타내는 어미는 `-(으)므로`다. `-(으)ㅁ + 으로`는 수단을 뜻하는 다른 말이다. */
export declare const eumeuroMeuro: Rule;
export declare const roseoQualification: Rule;
export declare const morphologyRules: Rule[];
//# sourceMappingURL=morphology.d.ts.map