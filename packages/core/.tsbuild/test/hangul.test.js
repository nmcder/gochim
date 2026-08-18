import { describe, expect, it } from 'vitest';
import { compose, decompose, endsWithFinal, finalOf, hasFinal, isSyllable, josa, stripFinal, withFinal } from '../src/hangul.js';
describe('hangul', () => {
    it('음절을 초·중·종성으로 분해한다', () => {
        expect(decompose('할')).toEqual({ lead: 'ㅎ', vowel: 'ㅏ', tail: 'ㄹ' });
        expect(decompose('하')).toEqual({ lead: 'ㅎ', vowel: 'ㅏ', tail: '' });
        expect(decompose('값')).toEqual({ lead: 'ㄱ', vowel: 'ㅏ', tail: 'ㅄ' });
    });
    it('분해와 조합은 서로의 역이다', () => {
        // 한글 음절 11,172자 전체를 왕복시킨다.
        for (let code = 0xac00; code <= 0xd7a3; code += 1) {
            const ch = String.fromCodePoint(code);
            const j = decompose(ch);
            expect(compose(j.lead, j.vowel, j.tail)).toBe(ch);
        }
    });
    it('한글 음절이 아닌 것은 분해하지 않는다', () => {
        expect(decompose('a')).toBeNull();
        expect(decompose('ㄱ')).toBeNull(); // 낱자모는 음절이 아니다
        expect(decompose('')).toBeNull();
        expect(isSyllable('가')).toBe(true);
        expect(isSyllable('ㅏ')).toBe(false);
    });
    it('받침을 읽고 바꾼다', () => {
        expect(finalOf('할')).toBe('ㄹ');
        expect(finalOf('하')).toBe('');
        expect(finalOf('A')).toBe('');
        expect(hasFinal('할', 'ㄹ')).toBe(true);
        expect(hasFinal('할', 'ㄴ')).toBe(false);
        expect(stripFinal('할')).toBe('하');
        expect(withFinal('하', 'ㄴ')).toBe('한');
    });
    it('마지막 음절의 받침으로 조사를 고른다', () => {
        expect(endsWithFinal('책')).toBe(true);
        expect(endsWithFinal('사과')).toBe(false);
        expect(josa('책', '은/는')).toBe('은');
        expect(josa('사과', '은/는')).toBe('는');
        expect(josa('책', '이/가')).toBe('이');
    });
});
//# sourceMappingURL=hangul.test.js.map