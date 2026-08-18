import type { CheckOptions, Diagnostic, MorphRule, Rule } from './types.js';
/**
 * 무시 사전 키. 같은 오류를 다시 만나도 조용히 넘기기 위한 식별자다.
 * 규칙 단위가 아니라 (규칙, 표기) 단위인 이유: '삼가하다'를 무시했다고
 * 다른 사전 항목까지 꺼지면 안 되기 때문.
 */
export declare function ignoreKey(d: Pick<Diagnostic, 'ruleId' | 'text'>): string;
/**
 * 텍스트를 검사한다.
 *
 * 순수 함수다 — 네트워크도, 전역 상태도, 부작용도 없다.
 * 같은 입력에는 항상 같은 출력이 나온다.
 *
 * `options.analyzer`를 넘기면 품사 기반 규칙(3층)이 함께 돌아 재현율이 올라간다.
 * 넘기지 않으면 문자열 규칙(1층)만으로 동작한다 — 이쪽도 그 자체로 완결이다.
 */
export declare function check(text: string, options?: CheckOptions, defaultRules?: readonly Rule[], defaultMorphRules?: readonly MorphRule[]): Diagnostic[];
/**
 * 진단을 원문에 적용한다.
 *
 * @param pick 어떤 제안을 쓸지 고른다. 기본은 첫 번째(가장 유력한) 제안.
 *             null을 돌려주면 그 진단은 건너뛴다.
 */
export declare function applyFixes(text: string, diagnostics: readonly Diagnostic[], pick?: (d: Diagnostic) => string | null): string;
//# sourceMappingURL=engine.d.ts.map