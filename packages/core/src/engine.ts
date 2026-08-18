import { overlapsProtected, protectedRanges } from './protect.js'
import type { CheckOptions, Diagnostic, Rule, RuleContext } from './types.js'

/**
 * 무시 사전 키. 같은 오류를 다시 만나도 조용히 넘기기 위한 식별자다.
 * 규칙 단위가 아니라 (규칙, 표기) 단위인 이유: '삼가하다'를 무시했다고
 * 다른 사전 항목까지 꺼지면 안 되기 때문.
 */
export function ignoreKey(d: Pick<Diagnostic, 'ruleId' | 'text'>): string {
  return `${d.ruleId}\u0000${d.text}`
}

/** 겹치는 진단 중 하나만 남긴다. 확신도 → 길이 → 앞선 위치 순. */
function resolveOverlaps(found: Diagnostic[]): Diagnostic[] {
  const sorted = [...found].sort(
    (a, b) =>
      a.start - b.start ||
      b.confidence - a.confidence ||
      b.end - b.start - (a.end - a.start) ||
      a.ruleId.localeCompare(b.ruleId),
  )
  const kept: Diagnostic[] = []
  for (const d of sorted) {
    const clash = kept.findIndex((k) => k.start < d.end && d.start < k.end)
    if (clash === -1) {
      kept.push(d)
      continue
    }
    const other = kept[clash]!
    const better =
      d.confidence > other.confidence ||
      (d.confidence === other.confidence && d.end - d.start > other.end - other.start)
    if (better) kept[clash] = d
  }
  return kept.sort((a, b) => a.start - b.start)
}

/**
 * 텍스트를 검사한다.
 *
 * 순수 함수다 — 네트워크도, 전역 상태도, 부작용도 없다.
 * 같은 입력에는 항상 같은 출력이 나온다.
 */
export function check(text: string, options: CheckOptions = {}, defaultRules: readonly Rule[] = []): Diagnostic[] {
  if (!text) return []

  const rules = options.rules ?? defaultRules
  const categories = options.categories ? new Set(options.categories) : null
  const ignore = options.ignore ? new Set(options.ignore) : null
  const minConfidence = options.minConfidence ?? 0
  const protectedRs = protectedRanges(text)

  const found: Diagnostic[] = []

  for (const rule of rules) {
    if (categories && !categories.has(rule.category)) continue

    const re = rule.pattern
    re.lastIndex = 0
    let m: RegExpExecArray | null

    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1
        continue
      }

      const ctx: RuleContext = {
        text,
        match: m,
        index: m.index,
        before: m.index > 0 ? text[m.index - 1]! : '',
        after: text[m.index + m[0].length] ?? '',
      }

      let finding
      try {
        finding = rule.resolve(ctx)
      } catch {
        // 규칙 하나가 터져도 전체 검사는 계속돼야 한다.
        continue
      }
      if (!finding || finding.suggestions.length === 0) continue

      const start = m.index + (finding.offset ?? 0)
      const end = start + (finding.length ?? m[0].length - (finding.offset ?? 0))
      if (start < 0 || end > text.length || start >= end) continue
      if (overlapsProtected(protectedRs, start, end)) continue

      const slice = text.slice(start, end)
      // 제안이 원문과 같으면 보여줄 이유가 없다.
      const suggestions = finding.suggestions.filter((s) => s !== slice)
      if (suggestions.length === 0) continue

      const confidence = finding.confidence ?? rule.confidence
      if (confidence < minConfidence) continue

      const d: Diagnostic = {
        ruleId: finding.subId ? `${rule.id}/${finding.subId}` : rule.id,
        category: rule.category,
        severity: finding.severity ?? rule.severity,
        start,
        end,
        text: slice,
        suggestions,
        message: finding.message,
        confidence,
        ...(finding.explain ? { explain: finding.explain } : {}),
        ...(finding.refs ? { refs: finding.refs } : {}),
      }

      if (ignore?.has(ignoreKey(d))) continue
      found.push(d)
    }
  }

  const result = resolveOverlaps(found)
  return options.limit != null ? result.slice(0, options.limit) : result
}

/**
 * 진단을 원문에 적용한다.
 *
 * @param pick 어떤 제안을 쓸지 고른다. 기본은 첫 번째(가장 유력한) 제안.
 *             null을 돌려주면 그 진단은 건너뛴다.
 */
export function applyFixes(
  text: string,
  diagnostics: readonly Diagnostic[],
  pick: (d: Diagnostic) => string | null = (d) => d.suggestions[0] ?? null,
): string {
  // 뒤에서부터 치환해야 앞쪽 인덱스가 밀리지 않는다.
  const ordered = [...diagnostics].sort((a, b) => b.start - a.start)
  let out = text
  let lastStart = Number.POSITIVE_INFINITY
  for (const d of ordered) {
    if (d.end > lastStart) continue // 겹치는 진단은 건너뛴다
    const replacement = pick(d)
    if (replacement == null) continue
    out = out.slice(0, d.start) + replacement + out.slice(d.end)
    lastStart = d.start
  }
  return out
}
