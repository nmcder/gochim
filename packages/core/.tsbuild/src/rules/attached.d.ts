import type { Rule } from '../types.js';
export declare const josaSpaced: Rule;
/**
 * `밖에`는 따로 다룬다.
 *
 * 조사 `밖에`(오직 그것뿐)와 명사 `밖`+조사 `에`(바깥)가 문자열로 같다.
 *
 *   나밖에 없더라      ← 조사 (붙임)
 *   울타리 밖에 아무것도 ← 명사 (띄움)
 *
 * 조사 `밖에`는 **반드시 부정 표현과 호응**한다는 성질을 가드로 쓴다.
 * 바로 다음 어절이 부정어가 아니면 손대지 않는다.
 */
export declare const josaBakke: Rule;
/** `-ㄹ지`는 어미다. `할 지` → `할지` */
export declare const eomiLji: Rule;
/** `-ㄹ뿐더러`, `-ㄹ수록`도 어미다. */
export declare const eomiAttached: Rule;
export declare const attachedRules: Rule[];
//# sourceMappingURL=attached.d.ts.map