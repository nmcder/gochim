import type { Category, Example, Finding, Rule, RuleContext, Severity } from '../types.js';
export interface RuleSpec {
    id: string;
    category: Category;
    severity?: Severity;
    confidence?: number;
    pattern: RegExp;
    resolve: (ctx: RuleContext) => Finding | null;
    examples: Example[];
    counterExamples?: string[];
}
/** 정규식 한 개짜리 규칙. */
export declare function defineRule(spec: RuleSpec): Rule;
export interface LexEntry {
    /** 잘못된 표기. 어간 조각이어도 된다 (예: `어의없`). */
    wrong: string;
    /** 올바른 표기. */
    right: string;
    /** 왜 틀렸는지. 사용자에게 그대로 보여준다. */
    explain?: string;
    refs?: string[];
    confidence?: number;
    severity?: Severity;
    /** 앞에 한글 음절이 붙어 있으면 매치하지 않는다. 합성어 오탐 방지용 (`황금새` ≠ `금새`). */
    atWordStart?: boolean;
    /** 뒤에 한글 음절이 붙어 있으면 매치하지 않는다. */
    atWordEnd?: boolean;
    /** 추가 문맥 조건. false를 돌려주면 넘어간다. */
    when?: (ctx: RuleContext) => boolean;
    /** 메시지에 쓸 표시용 표기 (어간 조각일 때 `어의없다`처럼 보여주기 위함). */
    display?: Example;
    examples?: Example[];
    counterExamples?: string[];
}
export interface LexiconSpec {
    id: string;
    category: Category;
    severity?: Severity;
    confidence?: number;
    entries: LexEntry[];
}
/**
 * 사전형 규칙. 항목이 아무리 늘어도 정규식은 하나다.
 *
 * 항목마다 개별 정규식을 만들면 항목 수만큼 텍스트를 훑게 된다.
 * 교체 대상이 전부 리터럴이므로 하나의 교차(alternation)로 합쳐
 * 한 번의 스캔으로 끝낸다.
 */
export declare function defineLexicon(spec: LexiconSpec): Rule;
//# sourceMappingURL=define.d.ts.map