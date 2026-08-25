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
export { insideQuotes, protectedRanges } from './protect.js'
export * from './hangul.js'
export { allRules } from './rules/index.js'
export { allMorphRules, morphJosaAttach } from './morph/rules.js'
export { morphEojeolSplit } from './morph/eojeol.js'
export { morphIyeot, morphJiElapsed, morphLyeogo } from './morph/eomi.js'
export { morphKkeseoAgreement } from './morph/nopim.js'
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

/**
 * 한 번 훑어서 못 고치는 자리가 있어 몇 번까지 되풀이하는가.
 *
 * 실측한 표본 3,786개는 전부 두 번 안에 멈춘다. 넉넉히 잡되 상한은 반드시 둔다 —
 * 규칙 둘이 서로를 되돌리면 이 값이 없는 한 영원히 돌기 때문이다.
 */
const MAX_PASSES = 4

/**
 * 찾은 오류를 모두 첫 번째 제안으로 고친 문자열을 돌려준다.
 *
 * **더 고칠 것이 없을 때까지 되풀이한다.** 한 번만 훑으면 고친 자리가 드러낸 다음 오류를
 * 놓친다 — `않되요`는 `않돼요`를 거쳐야 `안 돼요`가 되고, 한 번에서 멈추면 `않돼요`라는
 * 여전히 틀린 글을 돌려준다.
 *
 * 그래서 `fix(fix(x)) === fix(x)`가 성립해야 한다(멱등). 성립하지 않는다는 것은 규칙 둘이
 * 서로를 되돌린다는 뜻이고, 그런 자리는 사용자의 화면에서 글자가 깜빡이는 것으로 나타난다.
 * `packages/core/test/idempotence.test.ts`가 표본 전체로 이것을 지킨다.
 *
 * 지나온 결과를 기억해 같은 것이 다시 나오면 멈춘다. 진동을 **숨기지는 않는다** —
 * 멈추기만 할 뿐이라 위 테스트가 그대로 잡아낸다.
 */
export function fix(text: string, options: CheckOptions = {}): string {
  const seen = new Set([text])
  let out = text
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = applyFixes(out, check(out, options))
    if (next === out || seen.has(next)) break
    seen.add(next)
    out = next
  }
  return out
}
