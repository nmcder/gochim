import { endsWithFinal, finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 어미·서술격 조사 표기.
 *
 * 여기서는 사전이 아니라 **받침 계산**이 판정 근거다.
 * `-이에요/-예요`가 앞말 받침으로 갈리는 것이 대표적이고,
 * `-ㄹ게`는 앞 음절 종성이 ㄹ인지로 걸러낸다.
 */

/** ㄹ받침으로 끝나면서 높임 조사 '께'를 취하는 말. '아들께 드렸다'를 지켜야 한다. */
const HONORIFIC_L = new Set(['들', '딸', '아들'])
/** '-께'가 '무렵'을 뜻하는 접미사로 붙는 시간 명사. "다음 달 말께", "10일께" */
const TIME_L = new Set(['말', '일', '달', '초'])

export const eomiGe = defineRule({
  id: 'eomi-ge',
  category: 'ending',
  confidence: 0.94,
  // 어미 '-ㄹ게'를 된소리로 적은 형태. 소리는 [께]지만 표기는 '게'다.
  pattern: /([가-힣])께(?=[요.,!?~…\s]|$)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (finalOf(prev) !== 'ㄹ') return null
    if (HONORIFIC_L.has(prev) || TIME_L.has(prev)) return null
    return {
      suggestions: ['게'],
      offset: 1,
      length: 1,
      message: "어미 '-ㄹ게'는 소리와 달리 '게'로 적습니다.",
      explain:
        "'-ㄹ게'는 [께]로 소리 나지만 된소리로 적지 않는 어미입니다. '-ㄹ까/-ㄹ꼬'처럼 의문을 나타내는 어미만 된소리로 적습니다.",
      refs: ['한글 맞춤법 제53항'],
    }
  },
  examples: [
    { wrong: '내가 이따가 전화할께.', right: '내가 이따가 전화할게.' },
    { wrong: '내일 갈께요.', right: '내일 갈게요.' },
  ],
  counterExamples: ['이건 할머니께 드리는 선물이야.', '부모님께 말씀드렸어.', '합격자 발표는 다음 달 말께 나온다고 한다.', '결과는 다음 달 10일께 나온다고 합니다.'],
})

export const eomiGeol = defineRule({
  id: 'eomi-geol',
  category: 'ending',
  confidence: 0.9,
  pattern: /([가-힣])껄(?=[요.,!?~…\s]|$)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (finalOf(prev) !== 'ㄹ' || prev === '껄') return null
    return {
      suggestions: ['걸'],
      offset: 1,
      length: 1,
      message: "어미 '-ㄹ걸'은 소리와 달리 '걸'로 적습니다.",
      explain: "후회·추측을 나타내는 '-ㄹ걸'은 [껄]로 소리 나도 '걸'로 적습니다.",
      refs: ['한글 맞춤법 제53항'],
    }
  },
  examples: [{ wrong: '그때 조금만 더 참을껄.', right: '그때 조금만 더 참을걸.' }],
  counterExamples: ['그는 껄껄 웃었다.'],
})

/** 받침 없는 체언 뒤에서는 '-예요'가 맞다. 오탐을 막으려 확인된 말에만 적용한다. */
const YEYO_HEADS = ['뭐', '누구', '얼마', '언제', '이거', '그거', '저거', '거', '저', '나', '우리']

export const seosulYeyo = defineRule({
  id: 'seosul-yeyo',
  category: 'ending',
  severity: 'warning',
  confidence: 0.88,
  pattern: new RegExp(`(?<![가-힣])(${YEYO_HEADS.join('|')})에요(?=[.!?~…\\s]|$)`, 'g'),
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    return {
      suggestions: [`${head}예요`],
      message: "받침 없는 말 뒤에서는 '-예요'로 적습니다.",
      explain: "'-이에요'가 기본형이고, 앞말에 받침이 없으면 '-예요'로 줄어듭니다. (책이에요 / 뭐예요)",
      refs: ['한글 맞춤법 제36항'],
    }
  },
  examples: [{ wrong: '이게 대체 뭐에요?', right: '이게 대체 뭐예요?' }],
  counterExamples: ['그건 제가 한 게 아니에요.', '이 책은 제 것이에요.'],
})

export const seosulIeyo = defineRule({
  id: 'seosul-ieyo',
  category: 'ending',
  confidence: 0.9,
  pattern: /([가-힣])예요(?=[.!?~…\s]|$)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    // 받침이 있으면 '-이에요'로 이어져야 한다. 받침이 없으면 '-예요'가 맞다.
    if (!endsWithFinal(prev)) return null
    return {
      suggestions: [`${prev}이에요`],
      message: "받침 있는 말 뒤에서는 '-이에요'로 적습니다.",
      explain: "'-이에요'는 받침 없는 말 뒤에서만 '-예요'로 줄어듭니다. '책이에요'는 줄일 수 없습니다.",
      refs: ['한글 맞춤법 제36항'],
    }
  },
  examples: [{ wrong: '이건 제 책예요.', right: '이건 제 책이에요.' }],
  counterExamples: ['이게 대체 뭐예요?', '제가 찾던 거예요.'],
})

export const endingRules: Rule[] = [eomiGe, eomiGeol, seosulYeyo, seosulIeyo]
