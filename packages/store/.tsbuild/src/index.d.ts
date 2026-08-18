import { type Diagnostic } from '@gochim/core';
/** 무시 항목 하나. 나중에 "무시 목록" 화면을 만들 수 있도록 문맥을 함께 남긴다. */
export interface IgnoredEntry {
    /** `ignoreKey(diagnostic)` 로 만든 키. */
    key: string;
    /** 무시한 표기. 목록 화면에 보여 준다. */
    text: string;
    /** 어떤 규칙이었는지. */
    ruleId: string;
    /** 무시한 시각 (epoch ms). */
    at: number;
}
export interface IgnoreStore {
    /** `check(text, { ignore })`에 그대로 넘길 수 있는 동기 Set. */
    keys(): ReadonlySet<string>;
    /** 무시 목록 전체. 최근에 무시한 것이 앞에 온다. */
    list(): IgnoredEntry[];
    add(diagnostic: Pick<Diagnostic, 'ruleId' | 'text'>): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
    /** IndexedDB에 실제로 저장되고 있는가. false면 이 탭에서만 유지된다. */
    readonly persistent: boolean;
}
export interface OpenOptions {
    /** 데이터베이스 이름. 확장과 데모가 같은 브라우저에서 섞이지 않게 나눌 때 쓴다. */
    name?: string;
    /** 현재 시각을 돌려주는 함수. 테스트에서 고정할 수 있게 열어 둔다. */
    now?: () => number;
}
/**
 * 무시 사전을 연다.
 *
 * 저장된 항목을 전부 메모리로 읽어 온다 — 무시 목록은 수십~수백 개 규모라
 * 통째로 들고 있는 편이 매 검사마다 비동기로 묻는 것보다 훨씬 낫다.
 * 검사는 타이핑 중에 돌아야 하므로 동기여야 한다.
 */
export declare function openIgnoreStore(options?: OpenOptions): Promise<IgnoreStore>;
//# sourceMappingURL=index.d.ts.map