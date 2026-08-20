import type { Rule } from '../types.js'
import { anAnh, anhAlone, bojoJiAnh, jiAnh } from './an.js'
import { attachedRules } from './attached.js'
import { bojoRules } from './bojo.js'
import { busaRules } from './busa.js'
import { bojoBodaRules } from './bojo-boda.js'
import { nnbGeoRules } from './nnb-geo.js'
import { seosulHadaRules } from './seosul-hada.js'
import { principleRules } from './principle.js'
import { pyogiRules } from './pyogi.js'
import { nnbMoreRules } from './nnb-more.js'
import { seosulExtRules } from './seosul-ext.js'
import { eomiHwaryongRules } from './eomi-hwaryong.js'
import { unitMoreRules } from './unit-more.js'
import { anMotRules } from './an-mot.js'
import { honorificHanjaRules } from './honorific-hanja.js'
import { doeDwae, doeSentenceFinal, dwaeJiAnh } from './doe.js'
import { endingRules } from './endings.js'
import { confusable, lexicon } from './lexicon.js'
import { confusablePairRules } from './confusable-pairs.js'
import { proseSpacingRules } from './spacing-prose.js'
import { formalRules } from './formal.js'
import { hanjaRules } from './hanja.js'
import { honorificRules } from './honorific.js'
import { loanwordRules } from './loanword.js'
import { redundancyRules } from './redundancy.js'
import { morphologyRules } from './morphology.js'
import { spacingRules } from './spacing.js'

export * from './an.js'
export * from './attached.js'
export * from './bojo.js'
export * from './busa.js'
export * from './bojo-boda.js'
export * from './nnb-geo.js'
export * from './seosul-hada.js'
export * from './principle.js'
export * from './pyogi.js'
export * from './nnb-more.js'
export * from './seosul-ext.js'
export * from './eomi-hwaryong.js'
export * from './unit-more.js'
export * from './an-mot.js'
export * from './honorific-hanja.js'
export * from './doe.js'
export * from './endings.js'
export * from './lexicon.js'
export * from './confusable-pairs.js'
export * from './spacing-prose.js'
export * from './formal.js'
export * from './hanja.js'
export * from './honorific.js'
export * from './loanword.js'
export * from './redundancy.js'
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
  ...loanwordRules,
  ...redundancyRules,
  ...honorificRules,
  ...formalRules,
  ...hanjaRules,
  ...confusablePairRules,
  ...proseSpacingRules,
  ...bojoRules,
  ...busaRules,
  ...bojoBodaRules,
  ...nnbGeoRules,
  ...seosulHadaRules,
  ...principleRules,
  ...pyogiRules,
  ...nnbMoreRules,
  ...seosulExtRules,
  ...eomiHwaryongRules,
  ...unitMoreRules,
  ...anMotRules,
  ...honorificHanjaRules,
  ...endingRules,
]
