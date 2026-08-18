/**
 * 검사에서 제외할 구간을 찾는다.
 *
 * 교정기가 URL이나 코드 안의 글자를 건드리면 그 순간 신뢰를 잃는다.
 * 오탐을 줄이는 가장 값싼 수단이라 규칙보다 먼저 돈다.
 */
export type Range = readonly [start: number, end: number];
/** 보호 구간 목록. 정렬·병합되어 있다. */
export declare function protectedRanges(text: string): Range[];
/** [start, end) 가 보호 구간과 조금이라도 겹치는가. 정렬된 목록을 이분 탐색한다. */
export declare function overlapsProtected(ranges: readonly Range[], start: number, end: number): boolean;
//# sourceMappingURL=protect.d.ts.map