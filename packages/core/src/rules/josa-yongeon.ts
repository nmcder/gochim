import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 조사 뒤에 용언이 붙어 버린 자리 — `화가나서` → `화가 나서`.
 *
 * 사용자가 실제로 쓴 글에서 잡아 온 미검출이다. `화가 나다`는 주어와 서술어,
 * `집에 가다`는 부사어와 서술어라 어느 쪽도 한 단어가 아니다. 조사가 붙은 말과
 * 그 뒤의 용언은 언제나 다른 단어이므로 띄어 쓴다(제2항).
 *
 * ## 왜 화이트리스트인가
 *
 * "조사 뒤에 용언 어간이 붙으면 띄운다"는 규칙 자체는 옳지만, **문자열로 조사를
 * 판정하는 순간 무너진다.** `화가`의 `가`는 주격 조사지만 `전문가·평론가·건축가`의
 * `가`는 낱말의 일부다. `목이`의 `이`는 주격 조사지만 `길이·높이·먹이`의 `이`는
 * 접미사다. 형태소 분석기 없이 이걸 가르는 방법은 없다.
 *
 * 그래서 **실제 글에 자주 나오는 짝만** 표로 잡는다. 표에 오른 것은 모두
 *
 *   1. `조사가 붙은 앞말 + 용언`이 확실하고,
 *   2. 그 둘을 붙인 말이 표준국어대사전에 한 낱말로 **없다**.
 *
 * 이 계열의 함정은 **한 단어로 굳은 짝이 따로 있다**는 것이다.
 * `화나다·배고프다·목마르다·눈부시다·힘들다·맛있다·맛없다·정신없다`는 모두 한 단어라
 * 붙여 쓴다. 하지만 그건 조사가 **없을 때** 이야기다. 조사 `이/가`가 끼어들면
 * 주어와 서술어가 되어 반드시 갈라진다 — `힘들다`(○) / `힘이 들다`(○) / `힘이들다`(✗).
 * 표의 `oneWord`가 바로 그 짝이고, 설명에 함께 실어 준다.
 *
 * ## 어미까지 확인하고 나서야 자른다
 *
 * 앞말을 잡았다고 끝이 아니다. 뒤따르는 것이 정말 그 용언의 활용인지 봐야 한다.
 * 활용형마다 **뒤에 올 수 있는 어미의 첫 음절**을 함께 적어 두고 그것만 받는다.
 * 이 관문이 없으면 `화가나무를 그렸다`의 `화가나`까지 물어 버린다.
 *
 * 어미 목록이 막아 주는 자리 가운데 특히 무서운 것은 **조사와 어미가 겹치는 자리**다.
 *
 *   화가나 조각가나 모두 예술가다  → `나`는 선택의 조사 `-(이)나`. 건드리면 안 된다.
 *   힘이든 돈이든 다 필요하다      → `든`은 조사 `-(이)든`. 역시 건드리면 안 된다.
 *
 * 그래서 `나`는 어미가 이어질 때만(`화가나서·화가나면`) 받고 어절 끝에서는 버린다.
 * `든`은 `-ㄴ다`의 `다`가 이어질 때만(`힘이든다`) 받는다.
 */

interface JosaVerb {
  /** 조사까지 붙은 앞말. 여기서 잘라 띄운다. */
  head: string
  /** 용언의 사전형. 설명에 쓴다. */
  verb: string
  /** 조사 없이 붙여 쓰는 한 단어 짝. 있으면 설명에 함께 싣는다. */
  oneWord?: string
  /**
   * 어간의 활용 표면형과, 그 뒤에 올 수 있는 **어미의 첫 음절**.
   * 세 번째 값이 참이면 어절 끝(`배가 고파.`)도 받는다.
   */
  forms: Array<[stem: string, after: string, endOk?: boolean]>
}

/** 과거 어미 `-았/었-` 뒤에 이어질 수 있는 첫 음절. `났다·갔어·걸렸는데`. */
const AFTER_PAST = '다어지는을고네거으더나'
/** `-아/어` 활용형 뒤. `고파서·말라도·걸려요`. */
const AFTER_INFL = '서도요'
/** 모음 어간(`가-·나-·나가-`) 뒤에 바로 붙는 어미의 첫 음절. */
const AFTER_VOWEL_STEM = '서면니고는도지자야려겠기네더던요죠잖거며'
/** 관형사형 `-ㄹ` 뒤. `갈까·갈 만도`. */
const AFTER_L = '까게래지텐만걸'

const TABLE: JosaVerb[] = [
  // 화가 나다 — '화나다'가 한 단어지만 조사 '가'가 붙으면 주어 + 서술어다.
  {
    head: '화가',
    verb: '나다',
    oneWord: '화나다',
    forms: [
      // '화가나'는 어절 끝을 받지 않는다 — '화가나 조각가나'의 조사 '-(이)나'와 겹친다.
      ['나', AFTER_VOWEL_STEM],
      ['난', '다', true],
      ['날', AFTER_L, true],
      ['났', AFTER_PAST],
    ],
  },
  // 화가 치밀다 — '치밀하다'(綿密)와 겹치므로 '어·었·지·고'만 받는다.
  {
    head: '화가',
    verb: '치밀다',
    forms: [
      ['치밀', '어었지고'],
      ['치미', '는'],
      ['치민', '다', true],
    ],
  },
  // 배가 고프다 — '배고프다'가 한 단어다.
  {
    head: '배가',
    verb: '고프다',
    oneWord: '배고프다',
    forms: [
      ['고프', '다면지고네'],
      ['고파', AFTER_INFL + '라', true],
      ['고팠', AFTER_PAST],
      ['고픈', '데', true],
    ],
  },
  // 배가 아프다 — 배탈에도 시샘에도 쓰지만 어느 쪽이든 주어 + 서술어다.
  {
    head: '배가',
    verb: '아프다',
    forms: [
      ['아프', '다면지고네'],
      ['아파', AFTER_INFL + '라', true],
      ['아팠', AFTER_PAST],
      ['아픈', '데', true],
    ],
  },
  // 목이 마르다 — '목마르다'가 한 단어다.
  {
    head: '목이',
    verb: '마르다',
    oneWord: '목마르다',
    forms: [
      ['마르', '다면지고네'],
      ['말라', AFTER_INFL, true],
      ['말랐', AFTER_PAST],
      ['마른', '데', true],
    ],
  },
  // 눈이 부시다 — '눈부시다'가 한 단어다. '부실'은 不實과 겹쳐 아예 뺐다.
  {
    head: '눈이',
    verb: '부시다',
    oneWord: '눈부시다',
    forms: [
      ['부시', '다게고지네면'],
      ['부셔', AFTER_INFL, true],
      ['부셨', AFTER_PAST],
      ['부신', '데', true],
    ],
  },
  // 힘이 들다 — '힘들다'가 한 단어라 가장 헷갈리는 짝이다.
  {
    head: '힘이',
    verb: '들다',
    oneWord: '힘들다',
    forms: [
      ['들', '다어었지면고게'],
      // '힘이든 돈이든'의 조사 '-(이)든'과 겹친다. '-ㄴ다'의 '다'가 이어질 때만 받는다.
      ['든', '다'],
      ['드', '는'],
    ],
  },
  // 맛이 있다/없다 — '맛있다·맛없다'는 한 단어지만 조사 '이'가 끼면 갈라진다.
  {
    head: '맛이',
    verb: '있다',
    oneWord: '맛있다',
    forms: [['있', '다어었는지고으네을잖더']],
  },
  {
    head: '맛이',
    verb: '없다',
    oneWord: '맛없다',
    forms: [['없', '다어었는지고으네을잖더']],
  },
  // 정신이 없다 — '정신없다'가 한 단어다.
  {
    head: '정신이',
    verb: '없다',
    oneWord: '정신없다',
    forms: [['없', '다어었는지고으네을잖더']],
  },
  // 집에/학교에 가다 — 부사어 + 서술어. 붙여 쓰는 한 단어는 없다.
  {
    head: '집에',
    verb: '가다',
    forms: [
      ['가', AFTER_VOWEL_STEM, true],
      ['간', '다', true],
      ['갈', AFTER_L, true],
      ['갔', AFTER_PAST],
    ],
  },
  {
    head: '학교에',
    verb: '가다',
    forms: [
      ['가', AFTER_VOWEL_STEM, true],
      ['간', '다', true],
      ['갈', AFTER_L, true],
      ['갔', AFTER_PAST],
    ],
  },
  // 밖에 나가다 — 앞에 한글이 붙어 있으면 조사 '밖에'라 매치하지 않는다('이것밖에').
  {
    head: '밖에',
    verb: '나가다',
    forms: [
      ['나가', AFTER_VOWEL_STEM, true],
      ['나간', '다', true],
      ['나갈', AFTER_L, true],
      ['나갔', AFTER_PAST],
    ],
  },
  // 시간이/감기에 걸리다.
  {
    head: '시간이',
    verb: '걸리다',
    forms: [
      ['걸리', '다면지고네는겠더'],
      ['걸려', AFTER_INFL, true],
      ['걸린', '다', true],
      ['걸릴', AFTER_L, true],
      ['걸렸', AFTER_PAST],
    ],
  },
  {
    head: '감기에',
    verb: '걸리다',
    forms: [
      ['걸리', '다면지고네는겠더'],
      ['걸려', AFTER_INFL, true],
      ['걸린', '다', true],
      ['걸릴', AFTER_L, true],
      ['걸렸', AFTER_PAST],
    ],
  },
  // 잠이 오다.
  {
    head: '잠이',
    verb: '오다',
    forms: [
      ['오', '다면지고는네려겠더'],
      ['온', '다', true],
      ['올', AFTER_L, true],
      ['와', AFTER_INFL, true],
      ['왔', AFTER_PAST],
    ],
  },
]

/** 붙어 있는 표기 → 어느 짝인지. 정규식의 각 갈래가 그대로 열쇠가 된다. */
const SPLIT = new Map<string, JosaVerb>()
const alternatives: Array<{ whole: string; source: string }> = []
for (const item of TABLE) {
  for (const [stem, after, endOk] of item.forms) {
    const whole = item.head + stem
    if (SPLIT.has(whole)) continue
    SPLIT.set(whole, item)
    const look = endOk ? `(?:(?=[${after}])|(?![가-힣]))` : `(?=[${after}])`
    alternatives.push({ whole, source: whole + look })
  }
}
// 긴 갈래를 먼저 시도한다.
alternatives.sort((a, b) => b.whole.length - a.whole.length)

export const josaYongeon = defineRule({
  id: 'josa-yongeon',
  category: 'spacing',
  confidence: 0.94,
  pattern: new RegExp(`(?<![가-힣])(?:${alternatives.map((a) => a.source).join('|')})`, 'g'),
  resolve(ctx) {
    const whole = ctx.match[0]
    const item = SPLIT.get(whole)
    if (!item) return null
    const stem = whole.slice(item.head.length)
    const josa = item.head.slice(-1)
    return {
      suggestions: [`${item.head} ${stem}`],
      subId: whole,
      message: `'${item.head}'는 조사가 붙은 말이라 뒤의 용언과 띄어 씁니다.`,
      explain: item.oneWord
        ? `'${item.head} ${item.verb}'는 두 단어입니다. 조사 '${josa}' 없이 붙여 쓰는 '${item.oneWord}'는 한 단어지만, 조사가 끼면 주어와 서술어로 갈라져 반드시 띄어 씁니다.`
        : `'${item.head} ${item.verb}'는 조사가 붙은 말과 용언이 이어진 두 단어입니다. 한 단어로 사전에 오르지 않았으므로 띄어 씁니다.`,
      refs: ['한글 맞춤법 제2항', '한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '갑자기 화가나서 아무 말도 못 했다.', right: '갑자기 화가 나서 아무 말도 못 했다.' },
    { wrong: '동생 때문에 화가난 표정이었다.', right: '동생 때문에 화가 난 표정이었다.' },
    { wrong: '오늘은 집에가면 바로 씻어야지.', right: '오늘은 집에 가면 바로 씻어야지.' },
    { wrong: '배가고파서 편의점에 들렀다.', right: '배가 고파서 편의점에 들렀다.' },
    { wrong: '목이말라서 물을 벌컥벌컥 마셨다.', right: '목이 말라서 물을 벌컥벌컥 마셨다.' },
    { wrong: '요즘 잠이오지 않아 밤마다 뒤척인다.', right: '요즘 잠이 오지 않아 밤마다 뒤척인다.' },
    { wrong: '감기에걸려서 하루 종일 누워 있었다.', right: '감기에 걸려서 하루 종일 누워 있었다.' },
    { wrong: '생각보다 시간이걸린다.', right: '생각보다 시간이 걸린다.' },
    { wrong: '요즘 정신이없어서 지갑을 두고 나왔다.', right: '요즘 정신이 없어서 지갑을 두고 나왔다.' },
    { wrong: '이 집 김치찌개는 맛이있다.', right: '이 집 김치찌개는 맛이 있다.' },
    { wrong: '힘이들면 언제든 말해.', right: '힘이 들면 언제든 말해.' },
    { wrong: '학교에가는 길에 친구를 만났다.', right: '학교에 가는 길에 친구를 만났다.' },
    { wrong: '바람 좀 쐬려고 밖에나갔다.', right: '바람 좀 쐬려고 밖에 나갔다.' },
  ],
  counterExamples: [
    // 조사와 어미가 겹치는 자리
    '화가나 조각가나 모두 예술가다.',
    '힘이든 돈이든 다 필요하다.',
    '집에나 가서 쉬어라.',
    // 한 단어로 굳은 짝
    '오늘따라 유난히 힘들다.',
    '떡볶이는 맛있고 김밥은 맛없다.',
    '목마르면 물부터 마셔라.',
    '눈부신 햇살이 쏟아졌다.',
    '정신없이 하루가 지나갔다.',
    '배고프면 언제든지 말해.',
    '동생이 화나서 방으로 들어갔다.',
    // 제대로 띄어 쓴 글
    '화가 나서 아무 말도 못 했다.',
    '집에 가면 바로 씻어야지.',
    '학교에 가는 길에 친구를 만났다.',
    '밖에 나가서 바람을 쐬었다.',
    '시간이 걸리더라도 제대로 하자.',
    '감기에 걸린 것 같다.',
    '잠이 오지 않는 밤이었다.',
    // 우연히 문자열이 겹치는 자리
    '그는 치밀한 계획을 세웠다.',
    '부실 공사가 문제로 드러났다.',
    '전문가가 보기에도 어려운 문제다.',
  ],
})

export const josaYongeonRules: Rule[] = [josaYongeon]
