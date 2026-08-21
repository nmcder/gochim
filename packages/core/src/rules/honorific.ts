import { insideQuotes } from '../protect.js'
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
    // 인용부호 안은 남이 실제로 한 말이다. 고치면 그 사람이 하지 않은 말이 된다.
    // 사물 존대는 예절 문제라 더욱 그렇다 — '음료 나오셨습니다'를 옮긴 글에서
    // 그걸 고쳐 버리면 왜 그 말을 옮겼는지가 사라진다.
    if (insideQuotes(ctx.text, ctx.index)) return null
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

/**
 * 사물이 주어인데 서술어에 `-시-`가 붙은 자리.
 *
 * [honorific-object](#honorificObject)는 `나오셨·출발하셨`처럼 **굳은 짝**만 잡는다.
 * 실제 글에서는 서술성 명사 아무거나에 `-하시-·-되시-·-이시-`가 붙는다 —
 * `부족하시다·가능하십니다·품절이시라고·안 되신다고`. 어간이 무엇이든 붙으므로 짝으로는 못 닫는다.
 *
 * 대신 **주어 쪽을 목록으로 닫는다.** 사람이 될 수 없는 말 뒤에서만 발화한다.
 * 목록을 넓히면 곧바로 `할머니께서 편찮으십니다`를 고치는 도구가 되므로 넓히지 않는다.
 *
 * 사이에 끼어들 수 있는 것도 부사 몇 개로 못 박았다. 두 어절쯤 열어 두면
 * `환불이 안 된다고 사장님이 말하십니다`의 `말하십니다`까지 손이 닿는다.
 */
const INANIMATE_SUBJECT =
  '예산|환불|취소|교환|반품|결제|결재|배송|배달|출고|입고|재고|품절|매진|가격|요금|금액|비용|할인|쿠폰|적립|포인트|주문|예약|사이즈|색상|좌석|번호|일정|기간|날짜|공사|수리|점검|접수|신청|등록|가입|탈퇴|문의|답변|처리|확인|반영|안내'

/**
 * `-시-`가 든 활용형과 뺀 꼴.
 *
 * 그냥 `시`를 지울 수 없다. `하십니다`의 어미는 자모로만 남은 `-ㅂ니다`라
 * 앞 음절과 합쳐져야 `합니다`가 된다. 그래서 표로 못 박는다.
 * 청자를 높이는 `-세요`는 뺐다 — `결제 가능하세요?`는 듣는 사람에게 묻는 말이라
 * 사물 존대가 아니다.
 */
const SI_PLAIN: Record<string, string> = {
  하시다: '하다', 하시고: '하고', 하시면: '하면', 하시니: '하니', 하시는: '하는',
  하신다: '한다', 하신: '한', 하실: '할', 하십니다: '합니다', 하십니까: '합니까',
  하셨다: '했다', 하셨습니다: '했습니다', 하셨어요: '했어요',
  되시다: '되다', 되신다: '된다', 되신: '된', 되실: '될', 되시는: '되는',
  되십니다: '됩니다', 되십니까: '됩니까', 되셨다: '됐다', 되셨습니다: '됐습니다',
}

/** 서술격 조사에 `-시-`가 붙은 꼴. 앞말에 조사 없이 바로 붙는다. */
const ISI_PLAIN: Record<string, string> = {
  이시다: '이다', 이시라: '이라', 이신: '인', 이시고: '이고', 이시면: '이면',
  이십니다: '입니다', 이십니까: '입니까', 이셨다: '이었다', 이셨습니다: '이었습니다',
}

/** 긴 것을 먼저 시도해야 `하십니다`가 `하시`에 먹히지 않는다. */
const longestFirst = (table: Record<string, string>) =>
  Object.keys(table).sort((a, b) => b.length - a.length).join('|')

/**
 * 조사가 반드시 있어야 한다.
 *
 * 이것 하나가 이 규칙의 전부다. `주문하신 아메리카노`의 `주문`은 주어가 아니라
 * **서술어의 일부**다 — 주문한 주체는 손님이므로 `-시-`가 정당하다.
 * `주문이 접수되셨습니다`는 다르다. 조사 `이`가 붙는 순간 주문이 주어가 되고,
 * 사물이 높임의 대상이 되어 버린다.
 *
 * 처음에는 조사를 선택으로 두었다가 `주문하신·결제하실·신청하셨다`를 전부 고치려 들었다.
 */
export const honorificObjectSi = defineRule({
  id: 'honorific-object-si',
  category: 'ending',
  confidence: 0.9,
  pattern: new RegExp(
    `(?<![가-힣])(?:${INANIMATE_SUBJECT})(?:이|가|은|는)\\s*(?:(?:안|못|다시|아직|이미|바로|모두)\\s+)?([가-힣]*?)(${longestFirst(SI_PLAIN)})`,
    'g',
  ),
  resolve(ctx) {
    // 인용부호 안은 남이 실제로 한 말이다. 고치면 그 사람이 하지 않은 말이 된다.
    if (insideQuotes(ctx.text, ctx.index)) return null
    const honored = ctx.match[2] ?? ''
    const fixed = SI_PLAIN[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: '사물에는 높임을 쓰지 않습니다.',
      explain:
        "주체 높임 '-시-'는 사람을 높일 때만 씁니다. 손님을 높이려는 마음은 알지만 높임의 대상이 예산·환불 같은 사물이 되어 버립니다. 듣는 이에 대한 예의는 종결어미 '-습니다'로 이미 실현됩니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '담당자께서는 예산이 부족하시다고 말씀하셨다.', right: '담당자께서는 예산이 부족하다고 말씀하셨다.' },
    { wrong: '환불이 가능하십니다.', right: '환불이 가능합니다.' },
    { wrong: '직원분은 환불이 안 되신다고 하셨다.', right: '직원분은 환불이 안 된다고 하셨다.' },
  ],
  counterExamples: [
    '할머니께서 편찮으십니다.',
    '사장님이 결제를 확인하신다.',
    '고객님이 예약하신 시간입니다.',
    '주문하신 아메리카노 나왔습니다.',
    '고객님, 결제하실 금액은 삼만 원입니다.',
    '회식비는 팀장님이 법인카드로 결제하셨다.',
    '어르신들이 강좌를 신청하셨다.',
    '환불이 안 된다고 사장님이 말하십니다.',
    '예산이 부족하다고 말씀하셨다.',
  ],
})

/** `품절이시라고` — 서술격 조사에 높임이 붙은 자리. 앞말에 조사가 끼지 않는다. */
export const honorificObjectIsi = defineRule({
  id: 'honorific-object-isi',
  category: 'ending',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])(?:${INANIMATE_SUBJECT})(${longestFirst(ISI_PLAIN)})`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    const honored = ctx.match[1] ?? ''
    const fixed = ISI_PLAIN[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: '사물에는 높임을 쓰지 않습니다.',
      explain:
        "서술격 조사 '이다'에 붙은 '-시-'도 주체를 높이는 말입니다. 품절인 것은 빵이지 손님이 아니므로 높임의 대상이 사물이 되어 버립니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '카스텔라가 품절이시라고 안내한 것도 잘못이었습니다.', right: '카스텔라가 품절이라고 안내한 것도 잘못이었습니다.' },
    { wrong: '이 상품은 재고가 품절이십니다.', right: '이 상품은 재고가 품절입니다.' },
  ],
  counterExamples: ['그분이 이번 행사 회장이십니다.', '이 자리에 계신 분이 원장이십니다.'],
})

/**
 * 어휘로 높이는 말.
 *
 * `-시-`를 넣는 것만으로는 안 되고 낱말 자체를 바꿔야 하는 자리가 있다.
 * 말하는 사람을 낮춰 상대를 높이는 **겸양어**(여쭈다·드리다)와, 아예 다른 낱말을 쓰는
 * 높임말(생일→생신)이다.
 *
 * 판정의 근거는 언제나 **누구를 향한 말인가**다. `께`가 붙은 높임의 대상이
 * 두 어절 안에 있을 때만 발화한다. `께서`는 주어를 높이는 조사라 대상이 다르므로 뺀다.
 */
const HONORED_PERSON =
  '선생님|교수님|부모님|어머님|아버님|할머님|할아버님|할머니|할아버지|어르신|사장님|과장님|팀장님|원장님|고객님|손님|어머니|아버지|이모님|삼촌|여러분|이분|그분|저분|분'

const YEOJJU: Record<string, string> = {
  물어봤: '여쭤봤', 물어보: '여쭤보', 물어볼: '여쭤볼', 물어본: '여쭤본', 물어봐: '여쭤봐',
  물었: '여쭀', 물어: '여쭤',
}

export const honorificYeojjuda = defineRule({
  id: 'honorific-yeojjuda',
  category: 'ending',
  confidence: 0.9,
  pattern: new RegExp(
    `(?<![가-힣])(?:${HONORED_PERSON})께(?!서)\\s*(?:[가-힣]+\\s+){0,2}(${Object.keys(YEOJJU).sort((a, b) => b.length - a.length).join('|')})`,
    'g',
  ),
  resolve(ctx) {
    const plain = ctx.match[1] ?? ''
    const fixed = YEOJJU[plain]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - plain.length,
      length: plain.length,
      message: "웃어른께 묻는 것은 '여쭈다'입니다.",
      explain:
        "'여쭈다·여쭤보다'는 웃어른에게 묻는 일을 나타내는 겸양어입니다. 말하는 사람을 낮춰 듣는 이를 높입니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '어려운 문제를 들고 선생님께 물어봤을 때도 끝까지 가르쳐 주셨습니다.', right: '어려운 문제를 들고 선생님께 여쭤봤을 때도 끝까지 가르쳐 주셨습니다.' },
    { wrong: '궁금한 게 있어서 교수님께 물어보려고 합니다.', right: '궁금한 게 있어서 교수님께 여쭤보려고 합니다.' },
  ],
  counterExamples: [
    '친구에게 길을 물어봤다.',
    '할머니께서 손자에게 물어보셨다.',
    '동생한테 물어봐도 모른다고 했다.',
  ],
})

const DEURIDA: Record<string, string> = {
  주었: '드렸', 줬: '드렸', 주고: '드리고', 주는: '드리는', 줄: '드릴',
  줍니다: '드립니다', 주었다: '드렸다', 주기: '드리기',
}

export const honorificDeurida = defineRule({
  id: 'honorific-deurida',
  category: 'ending',
  confidence: 0.88,
  pattern: new RegExp(
    `(?<![가-힣])(?:${HONORED_PERSON})께(?!서)\\s*(?:[가-힣]+\\s+){0,2}(${Object.keys(DEURIDA).sort((a, b) => b.length - a.length).join('|')})(?![가-힣])`,
    'g',
  ),
  resolve(ctx) {
    const plain = ctx.match[1] ?? ''
    const fixed = DEURIDA[plain]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - plain.length,
      length: plain.length,
      message: "웃어른께 무엇을 주는 것은 '드리다'입니다.",
      explain: "'드리다'는 '주다'의 높임말입니다. 받는 이가 높임의 대상이면 '드리다'를 씁니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '된장을 담가 어르신 예순 분께 나누어 주었다.', right: '된장을 담가 어르신 예순 분께 나누어 드렸다.' },
    { wrong: '자료는 팀장님께 미리 주고 왔습니다.', right: '자료는 팀장님께 미리 드리고 왔습니다.' },
  ],
  counterExamples: [
    '동생에게 용돈을 주었다.',
    '할머니께서 세뱃돈을 주셨다.',
    '친구께 부탁한다는 말은 쓰지 않는다.',
  ],
})

export const honorificSaengsin = defineRule({
  id: 'honorific-saengsin',
  category: 'ending',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])(?:${HONORED_PERSON})\\s+생일`, 'g'),
  resolve(ctx) {
    return {
      suggestions: ['생신'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "웃어른의 생일은 '생신'입니다.",
      explain: "'생신(生辰)'은 '생일'의 높임말입니다. 높임의 대상이 되는 분의 생일에는 '생신'을 씁니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '다음 달 선생님 생일에는 꼭 찾아뵙겠습니다.', right: '다음 달 선생님 생신에는 꼭 찾아뵙겠습니다.' },
    { wrong: '이번 주말이 할머니 생일이라 다 모이기로 했다.', right: '이번 주말이 할머니 생신이라 다 모이기로 했다.' },
  ],
  counterExamples: ['동생 생일에 케이크를 샀다.', '친구 생일 선물을 골랐다.', '내 생일은 다음 달이다.'],
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


export const honorificMalsseum = defineRule({
  id: 'honorific-malsseum',
  category: 'ending',
  confidence: 0.9,
  // 내가 한 말에는 '말씀하시다'가 아니라 '말씀드리다'를 쓴다.
  pattern: /(제가|저희가)([^.!?]{0,14}?)말씀하신/g,
  resolve(ctx) {
    if (/께서|님이/.test(ctx.match[2] ?? '')) return null
    return {
      suggestions: ['말씀드린'],
      offset: ctx.match[0].length - 4,
      length: 4,
      message: '자기가 한 말은 높이지 않습니다.',
      explain: "'말씀하시다'는 남의 말을 높이는 표현입니다. 내가 한 말은 '말씀드리다'로 낮춥니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: '제가 앞에서 말씀하신 것처럼 예산은 확정되었습니다.', right: '제가 앞에서 말씀드린 것처럼 예산은 확정되었습니다.' },
  ],
  counterExamples: ['교수님께서 말씀하신 내용을 정리했습니다.'],
})

export const honorificDowajuda = defineRule({
  id: 'honorific-dowajuda',
  category: 'ending',
  confidence: 0.9,
  // 윗사람을 도울 때는 '도와드리다'를 쓴다.
  pattern: /(부장님|과장님|사장님|팀장님|선생님|교수님|어머님|아버님|선배님)([^.!?]{0,20}?)도와주(겠습니다|겠어요|시겠습니다)/g,
  resolve(ctx) {
    const tail = ctx.match[3] ?? ''
    // 도움을 받는 사람이 따로 있으면 그 사람이 기준이다. '후배를 도와주겠습니다'는 맞는 말이다.
    if (/(?:후배|동생|친구|아이|학생|신입|팀원|부하)(?:를|을)/.test(ctx.match[2] ?? '')) return null
    return {
      suggestions: [`도와드리${tail}`],
      offset: ctx.match[0].length - (3 + tail.length),
      length: 3 + tail.length,
      message: '윗사람을 도울 때는 "도와드리다"를 씁니다.',
      explain: "'주다'의 높임말은 '드리다'입니다. 듣는 이가 윗사람이면 '도와드리겠습니다'로 씁니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [{ wrong: '부장님, 그 일은 제가 도와주겠습니다.', right: '부장님, 그 일은 제가 도와드리겠습니다.' }],
  counterExamples: [
    '친구가 이사하는 걸 도와주겠다고 했다.',
    '부장님, 그 자료 정리는 제가 후배를 도와주겠습니다.',
  ],
})

export const honorificShopClosed = defineRule({
  id: 'honorific-shop-closed',
  category: 'ending',
  confidence: 0.92,
  // 가게가 쉬는 것을 높이면 사물 존대가 된다.
  pattern: /(매장|가게|식당|병원|은행|영업점|카페|약국|지점)([^.!?]{0,20}?)(쉬십니다|쉬세요|쉬십니다만)/g,
  resolve(ctx) {
    const honored = ctx.match[3] ?? ''
    const plain: Record<string, string> = { 쉬십니다: '쉽니다', 쉬세요: '쉽니다', 쉬십니다만: '쉽니다만' }
    const fixed = plain[honored]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - honored.length,
      length: honored.length,
      message: '가게나 매장에는 높임을 쓰지 않습니다.',
      explain: "높임의 대상은 사람입니다. '매장이 쉬십니다'는 매장을 높이는 말이 됩니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [{ wrong: '저희 매장은 매주 월요일에 쉬십니다.', right: '저희 매장은 매주 월요일에 쉽니다.' }],
  counterExamples: ['할아버지는 요즘 집에서 쉬십니다.'],
})

export const honorificRules: Rule[] = [
  honorificObject,
  honorificObjectSi,
  honorificObjectIsi,
  honorificYeojjuda,
  honorificDeurida,
  honorificSaengsin,
  honorificCopula,
  honorificStock,
  honorificGyesida,
  honorificJeohuiNara,
  honorificSilgeyo,
  honorificSelf,
  honorificTimeGreeting,
  honorificMalsseum,
  honorificDowajuda,
  honorificShopClosed,
]
