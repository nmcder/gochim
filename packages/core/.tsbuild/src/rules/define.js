import { josa } from '../hangul.js';
const DEFAULT_CONFIDENCE = 0.95;
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** 정규식 한 개짜리 규칙. */
export function defineRule(spec) {
    const flags = spec.pattern.flags.includes('g') ? spec.pattern.flags : spec.pattern.flags + 'g';
    return {
        id: spec.id,
        category: spec.category,
        severity: spec.severity ?? 'error',
        confidence: spec.confidence ?? DEFAULT_CONFIDENCE,
        pattern: new RegExp(spec.pattern.source, flags),
        resolve: spec.resolve,
        examples: spec.examples,
        ...(spec.counterExamples ? { counterExamples: spec.counterExamples } : {}),
    };
}
/**
 * 사전형 규칙. 항목이 아무리 늘어도 정규식은 하나다.
 *
 * 항목마다 개별 정규식을 만들면 항목 수만큼 텍스트를 훑게 된다.
 * 교체 대상이 전부 리터럴이므로 하나의 교차(alternation)로 합쳐
 * 한 번의 스캔으로 끝낸다.
 */
export function defineLexicon(spec) {
    const seen = new Set();
    const entries = spec.entries.filter((e) => {
        if (seen.has(e.wrong))
            return false;
        seen.add(e.wrong);
        return true;
    });
    // 긴 항목을 먼저 시도해야 `않되요`가 `않되`에 먹히지 않는다.
    const ordered = [...entries].sort((a, b) => b.wrong.length - a.wrong.length);
    const byWrong = new Map(entries.map((e) => [e.wrong, e]));
    const source = ordered
        .map((e) => (e.atWordStart ? '(?<![가-힣])' : '') + escapeRe(e.wrong) + (e.atWordEnd ? '(?![가-힣])' : ''))
        .join('|');
    const examples = [];
    const counterExamples = [];
    for (const e of entries) {
        examples.push(...(e.examples ?? [{ wrong: e.wrong, right: e.right }]));
        if (e.counterExamples)
            counterExamples.push(...e.counterExamples);
    }
    return {
        id: spec.id,
        category: spec.category,
        severity: spec.severity ?? 'error',
        confidence: spec.confidence ?? DEFAULT_CONFIDENCE,
        pattern: new RegExp(source, 'g'),
        resolve(ctx) {
            const entry = byWrong.get(ctx.match[0]);
            if (!entry)
                return null;
            if (entry.when && !entry.when(ctx))
                return null;
            const shown = entry.display ?? { wrong: entry.wrong, right: entry.right };
            return {
                suggestions: [entry.right],
                subId: entry.wrong,
                message: `'${shown.wrong}'${josa(shown.wrong, '은/는')} '${shown.right}'의 잘못된 표기입니다.`,
                ...(entry.explain ? { explain: entry.explain } : {}),
                ...(entry.refs ? { refs: entry.refs } : {}),
                ...(entry.confidence != null ? { confidence: entry.confidence } : {}),
                ...(entry.severity ? { severity: entry.severity } : {}),
            };
        },
        examples,
        ...(counterExamples.length ? { counterExamples } : {}),
    };
}
//# sourceMappingURL=define.js.map