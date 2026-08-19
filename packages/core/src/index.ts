/**
 * `@gochim/core` — 한국어 맞춤법·띄어쓰기 교정 엔진.
 *
 * 네트워크를 쓰지 않는다. API 키도, 서버도, 텍스트 전송도 없다.
 * 입력이 브라우저(또는 Node) 밖으로 나가지 않는 것이 이 라이브러리의 전제다.
 *
 * ```ts
 * import { check, fix } from '@gochim/core'
 *
 * check('그러면 안 되요.')
 * // → [{ start: 7, end: 9, text: '되요', suggestions: ['돼요'], ... }]
 *
 * fix('그러면 안 되요.')
 * // → '그러면 안 돼요.'
 * ```
 */

import { applyFixes, check as runCheck } from './engine.js'
import { allMorphRules } from './morph/rules.js'
import { allRules } from './rules/index.js'
import type { CheckOptions, Diagnostic } from './types.js'

export { applyFixes, ignoreKey, mergeDiagnostics } from './engine.js'
export { protectedRanges } from './protect.js'
export * from './hangul.js'
export { allRules } from './rules/index.js'
export { allMorphRules, morphJosaAttach, morphNnbSpacing } from './morph/rules.js'
export { groupWords, morphemeOffset } from './morph/words.js'
export { defineLexicon, defineRule } from './rules/define.js'
export type {
  Analyzer,
  Category,
  CheckOptions,
  Diagnostic,
  Example,
  Finding,
  MorphFinding,
  MorphRule,
  MorphRuleContext,
  Morpheme,
  Rule,
  RuleContext,
  Severity,
  Word,
} from './types.js'

/** 라이브러리 버전. 확장·데모에서 진단 결과와 함께 기록한다. */
export const VERSION = '0.1.0'

/**
 * 텍스트에서 맞춤법·띄어쓰기 오류를 찾는다.
 *
 * 부작용도, 비동기도 없다. 같은 입력에는 언제나 같은 결과가 나온다.
 */
export function check(text: string, options: CheckOptions = {}): Diagnostic[] {
  return runCheck(text, options, allRules, allMorphRules)
}

/** 찾은 오류를 모두 첫 번째 제안으로 고친 문자열을 돌려준다. */
export function fix(text: string, options: CheckOptions = {}): string {
  return applyFixes(text, check(text, options))
}
