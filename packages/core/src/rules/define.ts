import { josa } from '../hangul.js'
import type { Category, Example, Finding, Rule, RuleContext, Severity } from '../types.js'

const DEFAULT_CONFIDENCE = 0.95

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface RuleSpec {
  id: string
  category: Category
  severity?: Severity
  confidence?: number
  pattern: RegExp
  resolve: (ctx: RuleContext) => Finding | null
  examples: Example[]
  counterExamples?: string[]
  /**
   * 묻지 않고 적용해도 되는가. **적지 않으면 안 된다는 뜻이다.**
   *
   * 기본값이 거짓인 것이 이 플래그의 전부다. 새 규칙은 자격을 증명하기 전까지
   * 밑줄만 긋는다. 자격 조건과 그것을 어떻게 확인하는지는 `CONTRIBUTING.md`에 있다.
   */
  autoFixSafe?: boolean
}

/** 정규식 한 개짜리 규칙. */
export function defineRule(spec: RuleSpec): Rule {
  const flags = spec.pattern.flags.includes('g') ? spec.pattern.flags : spec.pattern.flags + 'g'
  return {
    id: spec.id,
    category: spec.category,
    severity: spec.severity ?? 'error',
    confidence: spec.confidence ?? DEFAULT_CONFIDENCE,
    pattern: new RegExp(spec.pattern.source, flags),
    resolve: spec.resolve,
    examples: spec.examples,
    ...(spec.counterExamples ? { counterExamples: spec.counterExamples } : {}),
    ...(spec.autoFixSafe ? { autoFixSafe: true } : {}),
  }
}

export interface LexEntry {
  /** 잘못된 표기. 어간 조각이어도 된다 (예: `어의없`). */
  wrong: string
  /** 올바른 표기. */
  right: string
  /** 왜 틀렸는지. 사용자에게 그대로 보여준다. */
  explain?: string
  /**
   * 한 줄 요약을 갈아 끼운다.
   *
   * 기본 문구는 "X는 Y의 잘못된 표기입니다"인데, 경고 심각도에서는 이게 사실이 아니다.
   * 규정이 허용하는 표기에 "잘못"이라고 적으면 안 된다.
   */
  message?: string
  refs?: string[]
  confidence?: number
  severity?: Severity
  /** 앞에 한글 음절이 붙어 있으면 매치하지 않는다. 합성어 오탐 방지용 (`황금새` ≠ `금새`). */
  atWordStart?: boolean
  /** 뒤에 한글 음절이 붙어 있으면 매치하지 않는다. */
  atWordEnd?: boolean
  /** 추가 문맥 조건. false를 돌려주면 넘어간다. */
  when?: (ctx: RuleContext) => boolean
  /** 메시지에 쓸 표시용 표기 (어간 조각일 때 `어의없다`처럼 보여주기 위함). */
  display?: Example
  examples?: Example[]
  counterExamples?: string[]
}

export interface LexiconSpec {
  id: string
  category: Category
  severity?: Severity
  confidence?: number
  entries: LexEntry[]
  /**
   * 사전 **전체**가 건드리면 안 되는 정상 문장.
   *
   * 항목마다 거는 `LexEntry.counterExamples`와 함께 쓰인다. 어느 항목 하나가 아니라
   * 사전 전체의 성격에서 오는 오탐(사전에 오른 합성어를 가르는 것 같은)은 여기 적어야
   * 자리가 맞다.
   */
  counterExamples?: string[]
  /** [RuleSpec.autoFixSafe]와 같다. 사전 전체에 한 번 건다. */
  autoFixSafe?: boolean
}

/**
 * 사전형 규칙. 항목이 아무리 늘어도 정규식은 하나다.
 *
 * 항목마다 개별 정규식을 만들면 항목 수만큼 텍스트를 훑게 된다.
 * 교체 대상이 전부 리터럴이므로 하나의 교차(alternation)로 합쳐
 * 한 번의 스캔으로 끝낸다.
 */
export function defineLexicon(spec: LexiconSpec): Rule {
  const seen = new Set<string>()
  const entries = spec.entries.filter((e) => {
    if (seen.has(e.wrong)) return false
    seen.add(e.wrong)
    return true
  })

  // 긴 항목을 먼저 시도해야 `않되요`가 `않되`에 먹히지 않는다.
  const ordered = [...entries].sort((a, b) => b.wrong.length - a.wrong.length)
  const byWrong = new Map(entries.map((e) => [e.wrong, e]))

  const source = ordered
    .map(
      (e) =>
        (e.atWordStart ? '(?<![가-힣])' : '') + escapeRe(e.wrong) + (e.atWordEnd ? '(?![가-힣])' : ''),
    )
    .join('|')

  const examples: Example[] = []
  const counterExamples: string[] = [...(spec.counterExamples ?? [])]
  for (const e of entries) {
    examples.push(...(e.examples ?? [{ wrong: e.wrong, right: e.right }]))
    if (e.counterExamples) counterExamples.push(...e.counterExamples)
  }

  return {
    id: spec.id,
    category: spec.category,
    severity: spec.severity ?? 'error',
    confidence: spec.confidence ?? DEFAULT_CONFIDENCE,
    pattern: new RegExp(source, 'g'),
    resolve(ctx): Finding | null {
      const entry = byWrong.get(ctx.match[0])
      if (!entry) return null
      if (entry.when && !entry.when(ctx)) return null
      const shown = entry.display ?? { wrong: entry.wrong, right: entry.right }
      return {
        suggestions: [entry.right],
        subId: entry.wrong,
        message: entry.message ?? `'${shown.wrong}'${josa(shown.wrong, '은/는')} '${shown.right}'의 잘못된 표기입니다.`,
        ...(entry.explain ? { explain: entry.explain } : {}),
        ...(entry.refs ? { refs: entry.refs } : {}),
        ...(entry.confidence != null ? { confidence: entry.confidence } : {}),
        ...(entry.severity ? { severity: entry.severity } : {}),
        // **문맥 가드를 단 항목은 자동 적용하지 않는다.**
        //
        // `when`을 달았다는 것은 그 표기가 **다른 뜻으로도 읽힌다**는 뜻이다.
        // 그 가드가 뚫리면 맞는 글이 망가진다. 실제로 그랬다 —
        // `회비 일부로`(一部로)를 `일부러`로, `살이 찌게`를 `찌개`로,
        // `커튼 바램`(바래다의 명사형)을 `바람`으로, `물건 금새`(값)를 `금세`로 고쳤다.
        // 넷 다 사전에 반례가 적혀 있었지만, 반례가 가드와 **같은 손으로** 쓰여
        // 가드 안쪽만 확인하고 바깥은 건드리지 못했다.
        //
        // 그래서 사람이 표시하게 두지 않고 여기서 구조로 막는다. 잊을 수가 없다.
        // 사전 전체에 `autoFixSafe`를 걸어도 가드 달린 항목은 빠진다.
        ...(entry.when ? { autoFixSafe: false } : {}),
      }
    },
    examples,
    ...(counterExamples.length ? { counterExamples } : {}),
    ...(spec.autoFixSafe ? { autoFixSafe: true } : {}),
  }
}
