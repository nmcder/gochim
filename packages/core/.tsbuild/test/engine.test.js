import { describe, expect, it } from 'vitest';
import { applyFixes, check, fix, ignoreKey } from '../src/index.js';
import { allRules } from '../src/rules/index.js';
describe('check', () => {
    it('오류 구간을 정확한 인덱스로 돌려준다', () => {
        const text = '그러면 안 되요.';
        const [d] = check(text);
        expect(d).toBeDefined();
        expect(text.slice(d.start, d.end)).toBe(d.text);
        expect(d.text).toBe('되요');
        expect(d.suggestions[0]).toBe('돼요');
    });
    it('빈 입력과 오류 없는 문장에는 아무것도 돌려주지 않는다', () => {
        expect(check('')).toEqual([]);
        expect(check('오늘은 날씨가 참 좋다.')).toEqual([]);
    });
    it('URL·이메일·코드 안은 건드리지 않는다', () => {
        expect(check('https://example.com/되요')).toEqual([]);
        expect(check('`할수있다` 라고 적혀 있다')).toEqual([]);
        expect(check('@되요 님이 남긴 글')).toEqual([]); // 멘션
        expect(check('C:\\Users\\되요\\문서')).toEqual([]); // 파일 경로
        expect(check('메일은 gochim@example.com 으로 주세요.')).toEqual([]);
    });
    it('결과는 시작 위치 순으로 정렬된다', () => {
        const diagnostics = check('그건 안 되요. 그리고 몇일 뒤에 할수있어.');
        const starts = diagnostics.map((d) => d.start);
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
        expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    });
    it('겹치는 진단은 하나만 남는다', () => {
        const diagnostics = check('지금은 않되요.');
        const overlapping = diagnostics.filter((a, i) => diagnostics.some((b, j) => i !== j && a.start < b.end && b.start < a.end));
        expect(overlapping).toEqual([]);
    });
    it('무시 사전에 담긴 항목은 건너뛴다', () => {
        const text = '진짜 어의없네.';
        const [d] = check(text);
        expect(d).toBeDefined();
        expect(check(text, { ignore: [ignoreKey(d)] })).toEqual([]);
    });
    it('분류와 확신도로 걸러낸다', () => {
        const text = '누구나 할수있는 일이야.';
        expect(check(text, { categories: ['spelling'] })).toEqual([]);
        expect(check(text, { categories: ['spacing'] }).length).toBe(1);
        expect(check(text, { minConfidence: 0.99 })).toEqual([]);
    });
    it('limit으로 결과 수를 제한한다', () => {
        const text = '몇일 뒤에 할수있어. 진짜 어의없네.';
        expect(check(text, { limit: 1 }).length).toBe(1);
    });
    it('규칙 하나가 예외를 던져도 검사는 계속된다', () => {
        const broken = {
            ...allRules[0],
            id: 'broken',
            pattern: /어의없/g,
            resolve() {
                throw new Error('boom');
            },
        };
        expect(() => check('진짜 어의없네.', { rules: [broken, ...allRules] })).not.toThrow();
        expect(check('진짜 어의없네.', { rules: [broken, ...allRules] }).length).toBe(1);
    });
});
describe('applyFixes / fix', () => {
    it('여러 오류를 한 번에 고친다', () => {
        expect(fix('몇일 뒤에 할수있어.')).toBe('며칠 뒤에 할 수 있어.');
    });
    it('한 번 고친 결과는 더 고칠 것이 없다', () => {
        const samples = [
            '그러면 안 되요.',
            '몇일 뒤에 만날거야?',
            '저는 맡은 일을 했을뿐입니다.',
            '지금 회의중이라 전화를 받기 어렵습니다.',
        ];
        for (const s of samples) {
            const once = fix(s);
            expect(fix(once)).toBe(once);
            expect(check(once)).toEqual([]);
        }
    });
    it('선택 함수로 특정 진단만 적용할 수 있다', () => {
        const text = '몇일 뒤에 할수있어.';
        const diagnostics = check(text);
        const onlySpacing = applyFixes(text, diagnostics, (d) => (d.category === 'spacing' ? d.suggestions[0] : null));
        expect(onlySpacing).toBe('몇일 뒤에 할 수 있어.');
    });
});
describe('진단 데이터의 무결성', () => {
    const corpus = [
        '그러면 안 되요. 몇일 뒤에 다시 연락할께요.',
        '누구나 할수있는 일이라 어의없었다.',
        '지금 회의중이라 못 받아. 끝나는대로 전화할게.',
    ];
    it('start/end/text가 항상 서로 맞는다', () => {
        for (const text of corpus) {
            for (const d of check(text)) {
                expect(text.slice(d.start, d.end)).toBe(d.text);
                expect(d.end).toBeGreaterThan(d.start);
                expect(d.suggestions.length).toBeGreaterThan(0);
                expect(d.suggestions).not.toContain(d.text);
                expect(d.message.length).toBeGreaterThan(0);
                expect(d.confidence).toBeGreaterThan(0);
                expect(d.confidence).toBeLessThanOrEqual(1);
            }
        }
    });
});
describe('규칙 목록', () => {
    it('규칙 id는 중복되지 않는다', () => {
        const ids = allRules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
    it('모든 규칙은 전역 정규식을 쓴다', () => {
        for (const rule of allRules)
            expect(rule.pattern.flags).toContain('g');
    });
    it('정규식이 상태를 남기지 않는다', () => {
        // lastIndex가 남아 있으면 두 번째 호출이 앞부분을 놓친다.
        const text = '진짜 어의없네.';
        expect(check(text)).toEqual(check(text));
    });
});
//# sourceMappingURL=engine.test.js.map