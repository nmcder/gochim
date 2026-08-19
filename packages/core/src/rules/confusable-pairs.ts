import { defineRule } from './define.js'
import type { Example, Rule } from '../types.js'

/**
 * 혼동어 — 목적어가 바로 앞에 있을 때만 판정한다.
 *
 * 처음에는 "앞 12자 안에 이 말이 있으면" 식의 창(window) 가드를 썼다가 곧 깨졌다.
 *
 *   우산을 잊어버려서 새로 샀다              ← 틀림 (물건은 잃다)
 *   지갑을 어디에 뒀는지 까맣게 잊어버렸다   ← 맞음 (기억하지 못한 것)
 *
 * 두 문장 모두 창 안에 `우산`·`지갑`이 있다. 갈리는 것은 **목적어가 서술어에 붙어 있는가**다.
 * 뒤 문장에서 잊은 대상은 물건이 아니라 "어디에 뒀는지"라는 절이다.
 * 그래서 여기 규칙들은 전부 `목적어 + (부사) + 서술어` 인접을 요구한다.
 */

interface Pair {
  id: string
  pattern: RegExp
  /** 매치 안에 이 표현이 있으면 발화하지 않는다. */
  deny?: RegExp
  /** 바꿀 부분(매치의 끝에서부터 이 길이만큼). */
  wrong: string
  right: string
  message: string
  explain: string
  examples: Example[]
  counterExamples?: string[]
}

/** 목적어와 서술어 사이에 끼어들 수 있는 부사. 이 정도까지만 허용한다. */
const ADVERBS = '(?:(?:또|다시|혼자|다|깜빡|잠깐|모두|제일|가장)\\s+){0,2}'

const PAIRS: Pair[] = [
  {
    id: 'ilta-vs-itta',
    pattern: new RegExp(`(?:우산|지갑|가방|열쇠|휴대폰|물건|돈|카드|신발|모자|장갑|이어폰|우비)을\\s*${ADVERBS}잊어버(?=[려렸리])`, 'g'),
    wrong: '잊어버',
    right: '잃어버',
    message: "물건을 없애는 것은 '잃다'입니다.",
    explain: "'잃다'는 가진 것을 없애는 것, '잊다'는 기억하지 못하는 것입니다. 우산은 잃어버리는 것입니다.",
    examples: [{ wrong: '버스에서 우산을 잊어버려서 새로 하나 샀다.', right: '버스에서 우산을 잃어버려서 새로 하나 샀다.' }],
    counterExamples: ['지갑을 어디에 뒀는지 까맣게 잊어버렸다.', '약속을 깜빡 잊어버렸다.'],
  },
  {
    id: 'garikida',
    // 주어와 서술어 사이에 목적어가 두어 어절 끼어들 수 있다 ('화살표가 출구 반대쪽을 가르치고').
    pattern: new RegExp(`(?:화살표|표지판|손가락|시계|바늘|나침반|이정표)(?:가|는|이)\\s*(?:[가-힣]+을?\\s+){0,3}가르치(?=[고는며켜])`, 'g'),
    // 사이에 사람 주어가 들어오면 '가르치다'가 맞는 문장이다.
    deny: /님|선생|강사|교수|학생/,
    wrong: '가르치',
    right: '가리키',
    message: "방향을 향하는 것은 '가리키다'입니다.",
    explain: "'가리키다'는 방향이나 대상을 향해 보이는 것, '가르치다'는 지식을 알려 주는 것입니다.",
    examples: [{ wrong: '표지판 화살표가 출구 반대쪽을 가르치고 있었다.', right: '표지판 화살표가 출구 반대쪽을 가리키고 있었다.' }],
    counterExamples: [
      '선생님이 수학을 가르치신다.',
      '동생에게 자전거 타는 법을 가르쳤다.',
      '시계가 걸린 교실에서 선생님이 한국사를 가르치고 계신다.',
    ],
  },
  {
    id: 'machida',
    pattern: new RegExp(`(?:정답|답|퀴즈|문제|과녁)(?:을|를)\\s*${ADVERBS}맞췄`, 'g'),
    wrong: '맞췄',
    right: '맞혔',
    message: "정답을 알아내는 것은 '맞히다'입니다.",
    explain: "'맞히다'는 표적이나 정답을 바르게 짚는 것, '맞추다'는 둘을 서로 대어 보는 것입니다(친구와 답을 맞춰 보다).",
    examples: [{ wrong: '어려운 퀴즈였는데 정답을 혼자 다 맞췄다.', right: '어려운 퀴즈였는데 정답을 혼자 다 맞혔다.' }],
    counterExamples: ['시험이 끝나고 친구와 답을 맞춰 보았다.', '가구 색을 벽지에 맞췄다.'],
  },
  {
    id: 'chae-vs-che',
    // 상태가 이어지는 것은 '채', 그런 척하는 것은 '체'다.
    pattern: /(?:신|입|쓰|끼|들|켜|앉|누|묶|열|닫|걸치)(?:은|ㄴ)\s+체(?=[로도는,])/g,
    deny: /모르는|아는|잘난|못난/,
    wrong: '체',
    right: '채',
    message: "상태가 이어지는 것은 '채'입니다.",
    explain: "'채'는 이미 있는 상태 그대로, '체'는 그런 척함입니다. 신발을 신은 상태이므로 '신은 채로'입니다.",
    examples: [{ wrong: '그는 신발을 신은 체로 방에 들어왔다.', right: '그는 신발을 신은 채로 방에 들어왔다.' }],
    counterExamples: ['모르는 체 딴 데를 보았다.', '아는 체하지 마라.'],
  },
  {
    id: 'deunji-selection',
    // 부정칭 뒤의 '-던지'는 선택을 뜻하는 '-든지'라야 한다.
    pattern: /(?:뭐|뭘|무엇을?|어디를?|어디서|누구를?|누가|언제|어떻게|어느)\s+(?:[가-힣]+\s+){0,2}[가-힣]+던지/g,
    deny: /기억|모르|궁금|생각|몰라/,
    wrong: '던지',
    right: '든지',
    message: '선택을 나타낼 때는 "-든지"입니다.',
    explain: "'-든지'는 여러 중 어느 것이어도 상관없다는 뜻, '-던지'는 과거를 회상하는 어미입니다.",
    examples: [{ wrong: '네가 뭘 하던지 나는 응원할게.', right: '네가 뭘 하든지 나는 응원할게.' }],
    counterExamples: ['그때 뭘 먹었던지 기억이 안 난다.', '어디서 봤던지 생각이 나지 않는다.'],
  },
  {
    id: 'munan-vs-muran',
    pattern: new RegExp(`(?:복장|정장|디자인|색|색상|스타일|무늬|옷차림|디자인)(?:은|이|는|가)?\\s*${ADVERBS}문안(?=[하한해했])`, 'g'),
    wrong: '문안',
    right: '무난',
    message: "흠이 없다는 뜻은 '무난하다'입니다.",
    explain: "'무난(無難)하다'는 어려움이나 흠이 없다는 뜻이고, '문안(問安)하다'는 어른께 안부를 묻는 것입니다.",
    examples: [{ wrong: '면접 복장은 무채색 정장이 제일 문안해요.', right: '면접 복장은 무채색 정장이 제일 무난해요.' }],
    counterExamples: ['할머니께 문안하러 다녀왔다.'],
  },
]

export const confusablePairRules: Rule[] = PAIRS.map((pair) =>
  defineRule({
    id: `pair-${pair.id}`,
    category: 'confusable',
    confidence: 0.9,
    pattern: pair.pattern,
    resolve(ctx) {
      // 판정을 뒤집는 말은 매치 뒤에 오기도 한다 — '뭘 먹었던지 기억이 안 난다'의 '기억'.
      const window = ctx.match[0] + ctx.text.slice(ctx.index + ctx.match[0].length, ctx.index + ctx.match[0].length + 20)
      if (pair.deny?.test(window)) return null
      // 바꿀 부분은 언제나 매치의 끝쪽이다.
      const at = ctx.match[0].lastIndexOf(pair.wrong)
      if (at === -1) return null
      return {
        suggestions: [pair.right],
        offset: at,
        length: pair.wrong.length,
        message: pair.message,
        explain: pair.explain,
      }
    },
    examples: pair.examples,
    ...(pair.counterExamples ? { counterExamples: pair.counterExamples } : {}),
  }),
)
