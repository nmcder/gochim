import { check, ignoreKey } from '@gochim/core';
import { describe, expect, it } from 'vitest';
import { openIgnoreStore } from '../src/index.js';
/**
 * Node에는 IndexedDB가 없다. 그래서 여기서 도는 것은 **메모리 대체 경로**다.
 * 그 경로가 조용히 동작하는지가 이 테스트의 핵심이다 —
 * 사생활 보호 모드처럼 저장이 막히는 브라우저에서도 교정기는 멀쩡해야 한다.
 * IndexedDB 경로 자체는 데모를 실제 크롬에 띄워 확인한다.
 */
describe('무시 사전', () => {
    it('IndexedDB가 없으면 메모리 모드로 내려간다', async () => {
        const store = await openIgnoreStore();
        expect(store.persistent).toBe(false);
        expect(store.keys().size).toBe(0);
    });
    it('무시한 항목이 검사 결과에서 빠진다', async () => {
        const store = await openIgnoreStore();
        const text = '진짜 어의없네.';
        const [diagnostic] = check(text);
        expect(diagnostic).toBeDefined();
        await store.add(diagnostic);
        expect(check(text, { ignore: store.keys() })).toEqual([]);
    });
    it('키는 코어의 ignoreKey와 정확히 같다', async () => {
        const store = await openIgnoreStore();
        const [diagnostic] = check('진짜 어의없네.');
        await store.add(diagnostic);
        expect([...store.keys()]).toEqual([ignoreKey(diagnostic)]);
    });
    it('규칙과 표기 단위로만 무시한다 — 다른 오류까지 꺼지지 않는다', async () => {
        const store = await openIgnoreStore();
        const text = '진짜 어의없네. 몇일 뒤에 보자.';
        const [first] = check(text);
        await store.add(first);
        const rest = check(text, { ignore: store.keys() });
        expect(rest.length).toBe(1);
        expect(rest[0].text).toBe('몇일');
    });
    it('되돌리기와 비우기가 동작한다', async () => {
        const store = await openIgnoreStore({ now: () => 1 });
        const [diagnostic] = check('진짜 어의없네.');
        await store.add(diagnostic);
        await store.remove(ignoreKey(diagnostic));
        expect(store.keys().size).toBe(0);
        await store.add(diagnostic);
        await store.clear();
        expect(store.keys().size).toBe(0);
    });
    it('목록은 최근에 무시한 것부터 보여 준다', async () => {
        let clock = 0;
        const store = await openIgnoreStore({ now: () => (clock += 100) });
        const diagnostics = check('진짜 어의없네. 몇일 뒤에 보자.');
        for (const d of diagnostics)
            await store.add(d);
        const list = store.list();
        expect(list.length).toBe(diagnostics.length);
        expect(list[0].at).toBeGreaterThan(list[1].at);
        expect(list[0].text).toBe('몇일');
    });
    it('같은 항목을 두 번 무시해도 하나로 남는다', async () => {
        const store = await openIgnoreStore();
        const [diagnostic] = check('진짜 어의없네.');
        await store.add(diagnostic);
        await store.add(diagnostic);
        expect(store.list().length).toBe(1);
    });
});
//# sourceMappingURL=ignore-store.test.js.map