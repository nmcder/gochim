import type { Rule } from '../types.js'
import { anAnh, anhAlone, bojoJiAnh, jiAnh } from './an.js'
import { attachedRules } from './attached.js'
import { doeDwae, doeSentenceFinal, dwaeJiAnh } from './doe.js'
import { endingRules } from './endings.js'
import { confusable, lexicon } from './lexicon.js'
import { morphologyRules } from './morphology.js'
import { spacingRules } from './spacing.js'

export * from './an.js'
export * from './attached.js'
export * from './doe.js'
export * from './endings.js'
export * from './lexicon.js'
export * from './morphology.js'
export * from './spacing.js'
export { defineLexicon, defineRule } from './define.js'
export type { LexEntry, LexiconSpec, RuleSpec } from './define.js'

/**
 * 내장 규칙 전체.
 *
 * 순서는 결과에 영향을 주지 않는다 — 겹치는 진단은 엔진이 확신도로 정리한다.
 * 다만 사전형 규칙을 앞에 두면 짧은 텍스트에서 조기 종료가 잦아 조금 빠르다.
 */
export const allRules: Rule[] = [
  doeDwae,
  dwaeJiAnh,
  doeSentenceFinal,
  anAnh,
  anhAlone,
  jiAnh,
  bojoJiAnh,
  lexicon,
  confusable,
  ...spacingRules,
  ...attachedRules,
  ...morphologyRules,
  ...endingRules,
]
