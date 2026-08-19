/** 규칙 분류. 데모/확장 UI에서 켜고 끄는 단위이기도 하다. */
export type Category =
  /** 표기 자체가 틀린 것. 어의없다 → 어이없다 */
  | 'spelling'
  /** 띄어쓰기. 할수있다 → 할 수 있다 */
  | 'spacing'
  /** 둘 다 실재하지만 뜻이 다른 말의 혼동. 결재 ↔ 결제 */
  | 'confusable'
  /** 어미·조사 표기. 할께요 → 할게요 */
  | 'ending'

export type Severity = 'error' | 'warning'

/** 규칙이 스스로 증명하는 예시. 문서 생성과 회귀 테스트에 함께 쓰인다. */
export interface Example {
  wrong: string
  right: string
}

/** 검사 결과 한 건. */
export interface Diagnostic {
  /** 규칙 식별자. 하위 규칙이 있으면 `lexicon/어의없다` 처럼 슬래시로 붙는다. */
  ruleId: string
  category: Category
  severity: Severity
  /** 오류 구간 시작 (입력 문자열의 UTF-16 인덱스). */
  start: number
  /** 오류 구간 끝 (exclusive). */
  end: number
  /** 오류 구간 원문. `text.slice(start, end)` 와 항상 같다. */
  text: string
  /** 제안. 첫 번째가 기본값. 비어 있을 수 없다. */
  suggestions: string[]
  /** 한 줄 요약. "'되요'는 '돼요'가 맞습니다" */
  message: string
  /** 왜 그런지. 사용자가 다음번엔 안 틀리게 만드는 게 목적이다. */
  explain?: string
  /** 근거 (한글 맞춤법 조항 등). */
  refs?: string[]
  /** 0~1. 1층 규칙은 문맥을 모르므로 확신도를 함께 싣는다. */
  confidence: number
}

/** 규칙 판정 함수에 넘어가는 문맥. */
export interface RuleContext {
  /** 검사 대상 전체 문자열. */
  text: string
  /** 정규식 매치 결과. */
  match: RegExpExecArray
  /** 매치 시작 위치. */
  index: number
  /** 매치 바로 앞 한 글자. 문서 시작이면 빈 문자열. */
  before: string
  /** 매치 바로 뒤 한 글자. 문서 끝이면 빈 문자열. */
  after: string
}

/** 규칙이 "여기 오류가 있다"고 판정했을 때 돌려주는 값. */
export interface Finding {
  /** 제안 목록. 첫 번째가 기본값. */
  suggestions: string[]
  message: string
  explain?: string
  refs?: string[]
  /** 규칙 기본값을 덮어쓴다. */
  confidence?: number
  severity?: Severity
  /** 사전형 규칙에서 개별 항목을 구분하기 위한 접미 식별자. */
  subId?: string
  /** 매치 전체가 아니라 일부만 오류 구간일 때 지정 (매치 시작 기준 상대 오프셋). */
  offset?: number
  /** 오류 구간 길이. `offset`과 함께 쓴다. */
  length?: number
}

export interface Rule {
  id: string
  category: Category
  severity: Severity
  /** 문맥을 모르는 상태에서의 기본 확신도. */
  confidence: number
  /** 전역(`g`) 플래그가 붙은 정규식. */
  pattern: RegExp
  /** 오류로 판정하면 Finding을, 아니면 null을 돌려준다. */
  resolve(ctx: RuleContext): Finding | null
  /** 이 규칙이 잡아야 하는 예시. 전부 테스트로 검증된다. */
  examples: Example[]
  /** 이 규칙이 절대 건드리면 안 되는 정상 문장. 오탐 회귀 테스트로 쓴다. */
  counterExamples?: string[]
}

/** 형태소 분석기가 돌려주는 형태소 하나. */
export interface Morpheme {
  /** 형태소의 표면형. 활용으로 어절 표기와 다를 수 있다 (`할` → `하` + `ㄹ`). */
  text: string
  /** 품사 태그. `NNB`(의존명사), `JKB`(부사격 조사) 등 세종 계열 태그를 쓴다. */
  pos: string
  /** 이 형태소가 속한 **어절**의 시작 위치. 형태소 자체의 위치가 아니다. */
  start: number
  /** 어절의 끝 위치 (exclusive). */
  end: number
}

/** 어절 하나와 그 안의 형태소들. */
export interface Word {
  start: number
  end: number
  text: string
  morphemes: Morpheme[]
}

/**
 * 형태소 분석기.
 *
 * 코어는 이 인터페이스만 알고, 구현은 밖에서 주입받는다.
 * 덕분에 `@gochim/core`는 WASM도 모델 파일도 의존하지 않는다.
 */
export interface Analyzer {
  analyze(text: string): readonly Morpheme[]
  /**
   * 분석 비용. **낮을수록 그럴듯한 말**이다.
   *
   * 절대값은 쓸 수 없다 — 사람 이름(44.6)과 오타(44.8)의 범위가 겹친다.
   * 대신 후보 표기와의 **차이**는 강한 신호다. 2층 오타 탐지가 이걸 쓴다.
   * 구현하지 않아도 되며, 없으면 2층 규칙이 그냥 돌지 않는다.
   */
  score?(text: string): number
}

/** 형태소 정보를 보고 판정하는 규칙. 정규식 규칙과 달리 문장 전체의 분석 결과를 본다. */
export interface MorphRule {
  id: string
  category: Category
  severity: Severity
  confidence: number
  run(ctx: MorphRuleContext): MorphFinding[]
  examples: Example[]
  counterExamples?: string[]
}

export interface MorphRuleContext {
  text: string
  words: readonly Word[]
  /** 후보 표기를 즉석에서 분석해 본다. 오타 탐지처럼 "이렇게 고치면 더 그럴듯한가"를 묻는 규칙이 쓴다. */
  analyze(text: string): readonly Morpheme[]
  /** 분석 비용. 분석기가 제공하지 않으면 undefined. */
  score?: (text: string) => number
}

export interface MorphFinding extends Finding {
  start: number
  end: number
}

export interface CheckOptions {
  /**
   * 무시할 항목. `ignoreKey(diagnostic)` 로 만든 키를 담는다.
   * (Phase 1에서 IndexedDB 무시 사전과 이어진다)
   */
  ignore?: Iterable<string>
  /** 이 값 미만의 확신도는 버린다. 기본 0. */
  minConfidence?: number
  /** 활성화할 분류. 지정하지 않으면 전부. */
  categories?: readonly Category[]
  /** 결과 개수 상한. 긴 문서에서 UI를 지키기 위한 안전장치. */
  limit?: number
  /** 사용할 규칙 목록. 지정하지 않으면 내장 규칙 전체. */
  rules?: readonly Rule[]
  /**
   * 형태소 분석기. 넘기면 품사 기반 규칙(2·3층)이 함께 돈다.
   * `@gochim/morph`의 `createAnalyzer()`가 이 인터페이스를 구현한다.
   */
  analyzer?: Analyzer
  /** 사용할 형태소 규칙. 지정하지 않으면 내장 형태소 규칙 전체. */
  morphRules?: readonly MorphRule[]
}
