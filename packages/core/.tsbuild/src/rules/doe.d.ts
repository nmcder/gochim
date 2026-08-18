/**
 * 되/돼 — 한국어에서 가장 많이 틀리는 표기.
 *
 * 규칙은 하나뿐이다. **`돼`는 `되어`의 준말이다.**
 * 그래서 `되` 자리에는 어미가 더 붙을 수 있지만, `돼`는 이미 어미(`-어`)를
 * 머금고 있어서 뒤에 어미가 또 붙지 못한다.
 *
 * 사용자에게는 `하/해` 대입법으로 설명한다 — `되`는 `하`, `돼`는 `해`에 대응한다.
 * `하요(X)/해요(O)` 이므로 `되요(X)/돼요(O)`.
 */
export declare const doeDwae: import("../types.js").Rule;
/**
 * `돼지 않다` — 명사 `돼지`와 문자열이 같아 사전으로는 못 잡는다.
 * 다만 뒤에 `않-`이 오면 부정 보조용언 구문이므로 동물일 수 없다.
 */
export declare const dwaeJiAnh: import("../types.js").Rule;
/**
 * 문장을 `되`로 끝맺은 경우. 종결형은 `되어 → 돼`라야 한다.
 * 단위 명사 `되`(곡식을 되는 그릇)와 겹치므로 수관형사 뒤는 건드리지 않는다.
 */
export declare const doeSentenceFinal: import("../types.js").Rule;
//# sourceMappingURL=doe.d.ts.map