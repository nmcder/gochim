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

/**
 * 받침 없는 체언 뒤에서는 `-예요`가 맞다. 오탐을 막으려 확인된 말에만 적용한다.
 *
 * 목록을 두는 이유는 하나다. **장소 명사 + 조사 `에` + `요`**가 글자로 똑같다.
 *
 *   차이가 뭐에요?    → 뭐예요   (서술격 조사)
 *   어디 가? 학교에요  → 그대로   (장소 + 조사)
 *
 * 분석기도 둘을 갈라 주지 못한다 — `학교에요`를 `학교/NNG + 이/VCP + 에요/EF`로 읽는다.
 * 그래서 **장소로 쓰일 수 없는 말**만 목록에 올린다.
 */
const YEYO_HEADS = [
  '뭐', '누구', '얼마', '언제', '이거', '그거', '저거', '거', '저', '나', '우리',
  '레시피', '이유', '차이', '소리', '하나', '며칠', '이야기', '메뉴', '취미', '사이즈',
  '커피', '우유', '아기', '강아지', '고양이', '노래', '무료', '가짜', '진짜',
]

export const seosulYeyo = defineRule({
  id: 'seosul-yeyo',
  category: 'ending',
  confidence: 0.9,
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

/**
 * `-ㄹ런지` → `-ㄹ는지`.
 *
 * 막연한 의문을 나타내는 어미는 `-ㄹ는지`다. `-려나·-런가`에 이끌려 `런`으로 적는 일이 잦다.
 * 앞 음절에 ㄹ받침이 있어야 하므로 운동 이름 `런지`(lunge)와는 겹치지 않는다 —
 * 그쪽은 앞이 띄어져 있다.
 */
export const eomiLreunji = defineRule({
  id: 'eomi-lreunji',
  category: 'ending',
  confidence: 0.92,
  pattern: /([가-힣])런지/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (finalOf(prev) !== 'ㄹ') return null
    return {
      suggestions: ['는지'],
      offset: 1,
      length: 2,
      message: "막연한 의문을 나타내는 어미는 '-ㄹ는지'입니다.",
      explain: "표준어는 '-ㄹ는지'입니다(올는지·갈는지). 소리가 비슷한 '-려나·-ㄹ런가'에 이끌린 표기입니다.",
      refs: ['표준어 규정 제17항'],
    }
  },
  examples: [
    { wrong: '제 글씨가 엉망이라 알아보실런지 모르겠습니다.', right: '제 글씨가 엉망이라 알아보실는지 모르겠습니다.' },
    { wrong: '내일 비가 올런지 모르겠다.', right: '내일 비가 올는지 모르겠다.' },
  ],
  counterExamples: ['스쿼트랑 런지를 번갈아 했다.', '이걸 어떻게 설명해야 할지 막막하다.'],
})

/**
 * `-구요` → `-고요`.
 *
 * 표준형은 연결어미 `-고`에 높임의 보조사 `요`가 붙은 `-고요`다.
 *
 * 그런데 `구요`로 끝나는 어절은 `친구요·대구요·도구요·가구요`처럼 **명사 + 서술격 조사**인
 * 자리가 훨씬 많다. 그래서 앞 음절이 **ㅆ받침**일 때만 잡는다 — `났구요·했구요·갔구요`.
 * ㅆ받침은 선어말어미 `-았/-었/-겠`의 흔적이라 그 앞이 용언임이 확실하다.
 */
export const eomiGuyo = defineRule({
  id: 'eomi-guyo',
  category: 'ending',
  confidence: 0.9,
  pattern: /([가-힣])구요(?![가-힣])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (finalOf(prev) !== 'ㅆ') return null
    return {
      suggestions: ['고요'],
      offset: 1,
      length: 2,
      message: "표준형은 '-고요'입니다.",
      explain: "연결어미 '-고'에 높임의 보조사 '요'가 붙은 말이라 '-고요'로 적습니다. '-구요'는 구어에서 흐려진 소리입니다.",
      refs: ['표준어 규정 제26항'],
    }
  },
  examples: [
    { wrong: '책상은 나갔구요, 의자만 남았어요.', right: '책상은 나갔고요, 의자만 남았어요.' },
    { wrong: '밥은 먹었구요?', right: '밥은 먹었고요?' },
  ],
  counterExamples: ['저건 제 친구요.', '이건 청소 도구요.', '거실에 둘 가구요.'],
})

/**
 * `무릅` → `무릎`.
 *
 * 신체 부위의 표제어는 `무릎`이다. `무릅`은 `무릅쓰다`(어려움을 견디다)에만 남아 있어
 * 홀로 쓰이지 않는다. 그래서 **뒤에 조사가 붙은 자리**만 잡으면 갈린다.
 */
const MUREUP_JOSA = /^(?:이|을|은|에|도|과|만|까지|부터|으로|처럼|보다|이나|이랑|하고)/

export const pyogiMureup = defineRule({
  id: 'pyogi-mureup',
  category: 'spelling',
  confidence: 0.93,
  pattern: /(?<![가-힣])무릅(?=[가-힣])/g,
  resolve(ctx) {
    if (!MUREUP_JOSA.test(ctx.text.slice(ctx.index + 2))) return null
    return {
      suggestions: ['무릎'],
      message: "신체 부위는 '무릎'으로 적습니다.",
      explain: "표준국어대사전의 표제어는 '무릎'입니다. '무릅'은 '무릅쓰다'에만 남아 있는 형태라 홀로 쓰이지 않습니다.",
    }
  },
  examples: [
    { wrong: '계단 내려올 때 무릅이 시큰거려요.', right: '계단 내려올 때 무릎이 시큰거려요.' },
    { wrong: '무릅을 굽히지 말라고 하셨다.', right: '무릎을 굽히지 말라고 하셨다.' },
  ],
  counterExamples: ['부끄러움을 무릅쓰고 문을 두드렸다.', '위험을 무릅쓴 선택이었다.', '무릎 부담이 줄어듭니다.'],
})

export const endingRules: Rule[] = [eomiGe, eomiGeol, seosulYeyo, seosulIeyo, eomiLreunji, eomiGuyo, pyogiMureup]
