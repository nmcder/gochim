import { groupWords } from './morph/words.js'
import { overlapsProtected, protectedRanges } from './protect.js'
import type {
  CheckOptions,
  Diagnostic,
  Finding,
  MorphRule,
  Rule,
  RuleContext,
  Severity,
  Word,
} from './types.js'

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

interface BuildInput {
  text: string
  ruleId: string
  category: Diagnostic['category']
  severity: Severity
  confidence: number
  start: number
  end: number
  finding: Finding
}

/** Finding을 Diagnostic으로 굳힌다. 규칙 종류와 무관하게 같은 검증을 거친다. */
function buildDiagnostic(input: BuildInput): Diagnostic | null {
  const { text, start, end, finding } = input
  if (start < 0 || end > text.length || start >= end) return null

  const slice = text.slice(start, end)
  // 제안이 원문과 같으면 보여줄 이유가 없다.
  const suggestions = finding.suggestions.filter((s) => s !== slice)
  if (suggestions.length === 0) return null

  return {
    ruleId: finding.subId ? `${input.ruleId}/${finding.subId}` : input.ruleId,
    category: input.category,
    severity: finding.severity ?? input.severity,
    start,
    end,
    text: slice,
    suggestions,
    message: finding.message,
    confidence: finding.confidence ?? input.confidence,
    ...(finding.explain ? { explain: finding.explain } : {}),
    ...(finding.refs ? { refs: finding.refs } : {}),
  }
}

/**
 * 텍스트를 검사한다.
 *
 * 순수 함수다 — 네트워크도, 전역 상태도, 부작용도 없다.
 * 같은 입력에는 항상 같은 출력이 나온다.
 *
 * `options.analyzer`를 넘기면 품사 기반 규칙(3층)이 함께 돌아 재현율이 올라간다.
 * 넘기지 않으면 문자열 규칙(1층)만으로 동작한다 — 이쪽도 그 자체로 완결이다.
 */
export function check(
  text: string,
  options: CheckOptions = {},
  defaultRules: readonly Rule[] = [],
  defaultMorphRules: readonly MorphRule[] = [],
): Diagnostic[] {
  if (!text) return []

  const rules = options.rules ?? defaultRules
  const categories = options.categories ? new Set(options.categories) : null
  const ignore = options.ignore ? new Set(options.ignore) : null
  const minConfidence = options.minConfidence ?? 0
  const protectedRs = protectedRanges(text)

  const found: Diagnostic[] = []

  const accept = (d: Diagnostic | null): void => {
    if (!d) return
    if (d.confidence < minConfidence) return
    if (overlapsProtected(protectedRs, d.start, d.end)) return
    if (ignore?.has(ignoreKey(d))) return
    found.push(d)
  }

  // ── 1층: 문자열 규칙 ────────────────────────────────────────
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
      accept(
        buildDiagnostic({
          text,
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          confidence: rule.confidence,
          start,
          end,
          finding,
        }),
      )
    }
  }

  // ── 3층: 품사 기반 규칙 (분석기를 넘겼을 때만) ──────────────
  const morphRules = options.morphRules ?? defaultMorphRules
  if (options.analyzer && morphRules.length > 0) {
    let words: Word[] = []
    try {
      words = groupWords(text, options.analyzer.analyze(text))
    } catch {
      words = []
    }

    if (words.length > 0) {
      for (const rule of morphRules) {
        if (categories && !categories.has(rule.category)) continue
        let findings
        try {
          findings = rule.run({ text, words })
        } catch {
          continue
        }
        for (const finding of findings) {
          accept(
            buildDiagnostic({
              text,
              ruleId: rule.id,
              category: rule.category,
              severity: rule.severity,
              confidence: rule.confidence,
              start: finding.start,
              end: finding.end,
              finding,
            }),
          )
        }
      }
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
