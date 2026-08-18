/**
 * 표기 자체가 틀린 말들.
 *
 * 형태소 분석으로는 못 잡는 층이다. 예컨대 `됬어`는 분석기가 알아서
 * `되+었+어`로 정규화해버려서 "틀렸다"는 신호가 사라진다.
 * 그래서 이 사전이 1층이자 최후의 보루다.
 *
 * 넣는 기준: **어떤 문맥에서도 틀린 표기만.** 문맥에 따라 맞을 수 있으면
 * 여기 넣지 않고 형태소 층(Phase 1)으로 넘긴다.
 */
export declare const lexicon: import("../types.js").Rule;
/**
 * 두 표기가 모두 실재하지만 뜻이 달라 헷갈리는 말.
 * 오탐 비용이 커서 확신도를 낮추고 `warning`으로 둔다.
 */
export declare const confusable: import("../types.js").Rule;
//# sourceMappingURL=lexicon.d.ts.map