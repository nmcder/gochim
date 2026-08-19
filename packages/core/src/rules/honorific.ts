import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 높임 표현.
 *
 * 여기 모인 오류는 대부분 **친절하려다 생긴 것**이다. 손님을 높이려고 물건까지 높인다.
 *
 *   주문하신 아메리카노 나오셨습니다   ← 커피가 높임의 대상이 되었다
 *   이 상품은 품절이십니다             ← 품절이 높임의 대상이 되었다
 *
 * 그래서 판정에 반드시 필요한 것이 **무엇이 주어인가**다. 문자열만으로는 알 수 없으므로
 * 감사에서 확정한 어휘 목록(음료·상품·재고 같은 무정물)이 앞에 있을 때만 발화한다.
 * 목록을 넓히면 곧바로 "할머니께서 나오셨습니다"를 고치는 도구가 된다.
 */

/** 사물 존대가 실제로 자주 붙는 무정물. 이 목록 밖에서는 발화하지 않는다. */
const INANIMATE = '아메리카노|라떼|커피|음료|차|주스|주문|상품|물건|메뉴|음식|택배|소포|제품'
/** 재고·수량처럼 '없으시다'가 붙는 말. */
const STOCK = '재고|재료|물량|자리|좌석|표|잔고|수량'

export const honorificObject = defineRule({
  id: 'honorific-object',
  category: 'ending',
  confidence: 0.93,
  pattern: new RegExp(`(${INANIMATE})(?:이|가|은|는)?\\s*(?:다\\s+|오늘\\s+|방금\\s+)?(나오셨|출발하셨|도착하셨|준비되셨)`, 'g'),
  resolve(ctx) {
    const honored = ctx.match[2] ?? ''
    const plain: Record<string, string> = {
      나오셨: '나왔',
      출발하셨: '출발했',
      도착하셨: '도착했',
      준비되셨: '준비됐',
    }
    const fixed = plain[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: '사물에는 높임을 쓰지 않습니다.',
      explain:
        "주체 높임 '-시-'는 사람을 높일 때만 씁니다. 손님을 높이려는 마음은 알지만, 높임의 대상이 커피나 상품이 되어 버립니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '주문하신 아메리카노 나오셨습니다.', right: '주문하신 아메리카노 나왔습니다.' },
    { wrong: '고객님, 주문하신 상품이 오늘 출발하셨습니다.', right: '고객님, 주문하신 상품이 오늘 출발했습니다.' },
  ],
  counterExamples: ['할머니께서 방에서 나오셨습니다.', '사장님께서 방금 출발하셨습니다.'],
})

export const honorificCopula = defineRule({
  id: 'honorific-copula',
  category: 'ending',
  confidence: 0.94,
  // 상태를 나타내는 말과 금액에 '-시-'가 붙은 자리.
  pattern: /(품절|매진|완판|마감|불가|무료|할인|품절)이십니다|((?:\d+|[일이삼사오육칠팔구십백천만]+)\s*원)이십니다/g,
  resolve(ctx) {
    const head = ctx.match[1] ?? ctx.match[2]
    if (!head) return null
    return {
      suggestions: [`${head}입니다`],
      message: '사물이나 금액에는 높임을 쓰지 않습니다.',
      explain: "'-시-'는 사람을 높이는 어미입니다. '품절이십니다'는 품절을 높이는 말이 되므로 '품절입니다'가 맞습니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '죄송하지만 이 상품은 지금 품절이십니다.', right: '죄송하지만 이 상품은 지금 품절입니다.' },
    { wrong: '고객님, 결제하실 금액은 삼만 원이십니다.', right: '고객님, 결제하실 금액은 삼만 원입니다.' },
  ],
  counterExamples: ['그분이 이 학교 교장 선생님이십니다.'],
})

export const honorificStock = defineRule({
  id: 'honorific-stock',
  category: 'ending',
  confidence: 0.93,
  pattern: new RegExp(`(${STOCK})(?:이|가)\\s+(?:다\\s+)?(없으십니다|없으세요|떨어지셨습니다|떨어지셨어요)`, 'g'),
  resolve(ctx) {
    const honored = ctx.match[2] ?? ''
    const plain: Record<string, string> = {
      없으십니다: '없습니다',
      없으세요: '없어요',
      떨어지셨습니다: '떨어졌습니다',
      떨어지셨어요: '떨어졌어요',
    }
    const fixed = plain[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: '재고나 재료에는 높임을 쓰지 않습니다.',
      explain: "높임의 대상은 사람입니다. '재고가 없으십니다'는 재고를 높이는 말이 됩니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '찾으시는 사이즈는 재고가 없으십니다.', right: '찾으시는 사이즈는 재고가 없습니다.' },
    { wrong: '이 메뉴는 오늘 재료가 다 떨어지셨어요.', right: '이 메뉴는 오늘 재료가 다 떨어졌어요.' },
  ],
})

export const honorificGyesida = defineRule({
  id: 'honorific-gyesida',
  category: 'ending',
  confidence: 0.93,
  // '계시다'는 사람에게만 쓴다. 말씀·질문 같은 것에는 '있으시다'를 쓴다(간접 높임).
  pattern: /(말씀|인사말|축사|훈화|질문|문의|사항|의견|불편)(?:이|가)\s+(계시겠습니다|계시겠어요|계십니다|계신)/g,
  resolve(ctx) {
    const honored = ctx.match[2] ?? ''
    const plain: Record<string, string> = {
      계시겠습니다: '있으시겠습니다',
      계시겠어요: '있으시겠어요',
      계십니다: '있으십니다',
      계신: '있으신',
    }
    const fixed = plain[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: "'계시다'는 사람에게만 씁니다.",
      explain:
        "말씀이나 질문은 사람이 아니므로 직접 높이지 않고, 그 주인을 높이는 간접 높임 '있으시다'를 씁니다. ('말씀이 있으시겠습니다')",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '다음은 교장 선생님의 말씀이 계시겠습니다.', right: '다음은 교장 선생님의 말씀이 있으시겠습니다.' },
    { wrong: '문의 사항이 계신 분은 손을 들어 주세요.', right: '문의 사항이 있으신 분은 손을 들어 주세요.' },
  ],
  counterExamples: ['아버지는 지금 댁에 계십니다.'],
})

export const honorificJeohuiNara = defineRule({
  id: 'honorific-jeohui-nara',
  category: 'ending',
  confidence: 0.95,
  // 나라는 낮출 대상이 아니다. 회사·학교를 낮추는 '저희'는 정상이다.
  pattern: /저희\s*나라(?=[는은이가의를도만에]|\s|[.,!?)\]]|$)/g,
  resolve() {
    return {
      suggestions: ['우리나라'],
      message: "나라를 낮추어 말하지 않습니다. '우리나라'가 맞습니다.",
      explain:
        "'저희'는 말하는 이가 자기 쪽을 낮출 때 씁니다. 나라는 듣는 이도 함께 속한 대상이라 낮출 수 없습니다. ('저희 회사·저희 학교'는 정상입니다)",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '저희 나라는 사계절이 뚜렷한 편입니다.', right: '우리나라는 사계절이 뚜렷한 편입니다.' },
    { wrong: '저희 나라의 전통 음식을 알리는 캠페인을 기획했습니다.', right: '우리나라의 전통 음식을 알리는 캠페인을 기획했습니다.' },
  ],
  counterExamples: [
    '저희 회사는 올해 창립 10주년입니다.',
    '저희 학교 급식은 맛있습니다.',
    '저희 나라장터 등록 담당자에게 문의해 주세요.',
    '저희 나라사랑 동아리는 해마다 봉사 활동을 합니다.',
  ],
})

export const honorificSilgeyo = defineRule({
  id: 'honorific-silgeyo',
  category: 'ending',
  confidence: 0.92,
  // '-ㄹ게요'는 말하는 이의 의지를 나타내는 어미다. 듣는 이에게 시킬 때는 쓸 수 없다.
  pattern: /(?<=[가-힣])실게요(?![가-힣])/g,
  resolve() {
    return {
      suggestions: ['세요'],
      message: "'-실게요'는 없는 말입니다. '-세요'로 씁니다.",
      explain:
        "'-ㄹ게요'는 말하는 이가 자기 의지를 밝히는 어미라서 '제가 할게요'처럼만 씁니다. 듣는 이에게 부탁·지시할 때는 '-세요'를 씁니다.",
    }
  },
  examples: [{ wrong: '환자분, 여기 침대에 잠깐 누우실게요.', right: '환자분, 여기 침대에 잠깐 누우세요.' }],
  counterExamples: ['제가 먼저 해 볼게요.', '이번엔 제가 살게요.'],
})

export const honorificSelf = defineRule({
  id: 'honorific-self',
  category: 'ending',
  confidence: 0.9,
  // 자기 자신을 높이는 자리. 주어가 '제가·저희가'인데 서술어에 '-시-'가 붙었다.
  pattern: /(제가|저희가)([^.!?]{0,20}?)([가-힣])시겠습니다/g,
  resolve(ctx) {
    const middle = ctx.match[2] ?? ''
    // 사이에 다른 주어나 절 경계가 있으면 '-시-'의 주인이 바뀐다.
    if (/께서|님이|님께서|니까|테니|으면|아서|어서/.test(middle)) return null
    return {
      suggestions: ['겠습니다'],
      offset: ctx.match[0].length - 5,
      length: 5,
      message: '자기 자신을 높이지 않습니다.',
      explain: "주체 높임 '-시-'는 남을 높일 때만 씁니다. 주어가 '제가'이면 '확인해 보겠습니다'가 맞습니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [{ wrong: '고객님, 제가 바로 확인해 보시겠습니다.', right: '고객님, 제가 바로 확인해 보겠습니다.' }],
  counterExamples: ['제가 여쭤보니 사장님께서 직접 오시겠습니다.'],
})

export const honorificTimeGreeting = defineRule({
  id: 'honorific-time-greeting',
  category: 'ending',
  severity: 'warning',
  confidence: 0.88,
  pattern: /(즐거운|좋은|행복한|편안한|멋진|뜻깊은)\s+(시간|하루|저녁|주말|연휴|명절)\s*되세요/g,
  resolve(ctx) {
    const [, modifier = '', noun = ''] = ctx.match
    return {
      suggestions: [`${modifier} ${noun} 보내세요`],
      message: "듣는 사람이 '시간'이 될 수는 없습니다.",
      explain:
        "'되세요'는 듣는 이가 그것이 되라는 뜻입니다. 시간을 보내는 것은 '보내세요'이고, 하루가 좋기를 바랄 때는 '좋은 하루 보내세요'로 씁니다.",
    }
  },
  examples: [{ wrong: '오늘 하루도 즐거운 시간 되세요.', right: '오늘 하루도 즐거운 시간 보내세요.' }],
})

export const honorificRules: Rule[] = [
  honorificObject,
  honorificCopula,
  honorificStock,
  honorificGyesida,
  honorificJeohuiNara,
  honorificSilgeyo,
  honorificSelf,
  honorificTimeGreeting,
]
