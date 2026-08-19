/**
 * 검사에서 제외할 구간을 찾는다.
 *
 * 교정기가 URL이나 코드 안의 글자를 건드리면 그 순간 신뢰를 잃는다.
 * 오탐을 줄이는 가장 값싼 수단이라 규칙보다 먼저 돈다.
 */
export type Range = readonly [start: number, end: number];
/** 보호 구간 목록. 정렬·병합되어 있다. */
export declare function protectedRanges(text: string): Range[];
/**
 * 이 위치가 인용부호 안인가.
 *
 * 짧은 인용은 [protectedRanges]가 이미 막지만, 긴 인용문은 검사 대상으로 남긴다 —
 * 인용문 안의 맞춤법 오류도 오류이기 때문이다.
 * 다만 **문체 제안**(겹말 같은 것)은 남의 말을 고치는 셈이라 인용문 안에서 내지 않는다.
 */
export declare function insideQuotes(text: string, index: number): boolean;
/** [start, end) 가 보호 구간과 조금이라도 겹치는가. 정렬된 목록을 이분 탐색한다. */
export declare function overlapsProtected(ranges: readonly Range[], start: number, end: number): boolean;
//# sourceMappingURL=protect.d.ts.map