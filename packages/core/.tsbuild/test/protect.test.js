import { describe, expect, it } from 'vitest';
import { check } from '../src/index.js';
import { overlapsProtected, protectedRanges } from '../src/protect.js';
/**
 * 보호 구간은 오탐을 줄이는 가장 값싼 수단이다.
 * URL이나 코드 안의 글자를 건드리는 교정기는 그 자리에서 신뢰를 잃는다.
 */
describe('보호 구간', () => {
    const cases = [
        ['URL', 'https://example.com/되요'],
        ['www 주소', 'www.example.com/할수있다'],
        ['이메일', 'gochim@example.com'],
        ['인라인 코드', '`할수있다`'],
        ['코드 펜스', '```\n할수있다\n```'],
        ['HTML 태그', '<a title="되요">링크</a>'],
        ['멘션', '@되요'],
        ['해시태그', '#할수있다'],
        ['윈도 경로', 'C:\\Users\\되요\\문서'],
        ['짧은 인용', "'되요'"],
    ];
    it.each(cases)('%s 안은 검사하지 않는다', (_label, text) => {
        expect(check(text)).toEqual([]);
    });
    it('보호 구간 밖은 그대로 검사한다', () => {
        const diagnostics = check('https://example.com 에서 봤는데 이건 안 되요.');
        expect(diagnostics.map((d) => d.text)).toEqual(['되요']);
    });
    it('맞춤법을 설명하는 문장의 인용은 건드리지 않는다', () => {
        // 표기 자체를 언급하는 글에서 밑줄을 그으면 글쓴이 입장에서는 도구가 문맥을 못 읽는 것으로 보인다.
        expect(check("맞춤법 강의에서 '되요'와 '됬'은 틀린 표기라고 배웠다.")).toEqual([]);
    });
    it('긴 인용문까지 통째로 빠지지는 않는다', () => {
        // 12자 제한이 없으면 대화체 인용문 전체가 검사에서 빠져 버린다.
        const diagnostics = check("그는 '이렇게 하면 절대로 안 되요'라고 말했다.");
        expect(diagnostics.map((d) => d.text)).toContain('되요');
    });
    it('구간은 정렬·병합되어 돌아온다', () => {
        const ranges = protectedRanges('`코드` 그리고 https://example.com 그리고 `또 코드`');
        expect(ranges.length).toBe(3);
        for (let i = 1; i < ranges.length; i += 1) {
            expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][1]);
        }
    });
    it('겹침 판정은 경계를 정확히 다룬다', () => {
        const ranges = [
            [10, 20],
            [30, 40],
        ];
        expect(overlapsProtected(ranges, 0, 10)).toBe(false); // 바로 앞
        expect(overlapsProtected(ranges, 20, 30)).toBe(false); // 사이
        expect(overlapsProtected(ranges, 9, 11)).toBe(true); // 걸침
        expect(overlapsProtected(ranges, 19, 25)).toBe(true); // 걸침
        expect(overlapsProtected(ranges, 35, 36)).toBe(true); // 안쪽
        expect(overlapsProtected(ranges, 40, 50)).toBe(false); // 바로 뒤
        expect(overlapsProtected([], 0, 5)).toBe(false);
    });
});
//# sourceMappingURL=protect.test.js.map