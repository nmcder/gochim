import { insideQuotes } from '../protect.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 한자어 오용.
 *
 * 이 범주는 **원리적으로 1층에서 대부분 불가능하다.** 두 말이 모두 실재하고
 * 무엇이 맞는지는 문맥 의미가 정하기 때문이다.
 *
 *   고객 만족을 지양하다   ← 틀림 (추구 대상이므로 지향)
 *   양적 성장을 지양하다   ← 맞음 (회피 대상)
 *
 * 그래서 여기 남긴 것은 **목적어를 닫힌 목록으로 못박을 수 있는 것들**뿐이다.
 * 목록을 넓히는 순간 반대쪽 정상 문장을 고치기 시작한다.
 * 나머지(유래/유례, 곤혹/곤욕, 실재/실제, 갱신/경신, 부문/부분, 일절/일체,
 * 임대/임차, 출연/출현, 혼돈/혼동)는 형태소 태그로도 갈리지 않아 손대지 않는다.
 */

/** 추구할 수밖에 없는 목표. 이 목적어 뒤의 '지양'은 '지향'의 잘못이다. */
const GOALS = '고객\\s*만족|고객\\s*감동|상생|사회\\s*통합|양성평등|세계\\s*평화|지속\\s*가능|공존|화합|혁신'
/** 회피 대상임을 드러내는 수식어. 이게 붙으면 '지양'이 맞다. */
const AVOIDANCE = /양적|무분별한|과도한|지나친|맹목적|일방적|무리한|소모적|불필요한|극단적/

export const jihyang = defineRule({
  id: 'hanja-jihyang',
  category: 'confusable',
  confidence: 0.9,
  pattern: new RegExp(`(${GOALS})(?:을|를)\\s*지양(?=[하한할함했])`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    // 앞에 회피를 뜻하는 수식어가 있으면 '지양'이 맞다.
    const before = ctx.text.slice(Math.max(0, ctx.index - 12), ctx.index)
    if (AVOIDANCE.test(before)) return null
    return {
      suggestions: ['지향'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "추구하는 것은 '지향'입니다.",
      explain:
        "'지양(止揚)'은 하지 않는 것, '지향(志向)'은 목표로 향하는 것입니다. '고객 만족을 지양한다'면 만족시키지 않겠다는 뜻이 됩니다.",
    }
  },
  examples: [{ wrong: '고객 만족을 지양하는 기업이 되겠습니다.', right: '고객 만족을 지향하는 기업이 되겠습니다.' }],
  counterExamples: [
    '양적 성장을 지양하고 질적 성장을 지향한다.',
    '무분별한 개발을 지양해야 한다.',
  ],
})

/** '제고(提高)'의 대상이 되는 추상 품질 명사. */
const QUALITIES = '생산성|효율성|효율|이미지|위상|경쟁력|신뢰도|만족도|인식|가치|품질|성과'

export const jego = defineRule({
  id: 'hanja-jego',
  category: 'confusable',
  confidence: 0.9,
  pattern: new RegExp(`(${QUALITIES})\\s*재고(?=[를을]\\s*(?:위해|높이|도모|기대)|하[여기고])`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['제고'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "수준을 높이는 것은 '제고'입니다.",
      explain:
        "'제고(提高)'는 쳐들어 높임, '재고(再考)'는 다시 생각함, '재고(在庫)'는 창고의 물건입니다. 생산성을 높이는 것은 '제고'입니다.",
    }
  },
  examples: [{ wrong: '생산성 재고를 위해 공정을 개선했다.', right: '생산성 제고를 위해 공정을 개선했다.' }],
  counterExamples: ['합병 결정의 재고를 요구했다.', '창고에 재고가 얼마 남지 않았다.'],
})

/** '타개(打開)'의 대상이 되는 어려운 상황. */
const HARDSHIPS = '위기|난국|난관|국면|정국|불황|교착|위기감|난제|침체'

export const tagae = defineRule({
  id: 'hanja-tagae',
  category: 'confusable',
  confidence: 0.92,
  pattern: new RegExp(`(${HARDSHIPS})(?:을|를)\\s*타계(?=[하한할함했])`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['타개'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "어려움을 헤쳐 나가는 것은 '타개'입니다.",
      explain: "'타개(打開)'는 헤쳐서 열어 나감, '타계(他界)'는 세상을 떠남입니다. 뜻이 전혀 다릅니다.",
    }
  },
  examples: [{ wrong: '위기를 타계할 방법을 찾고 있다.', right: '위기를 타개할 방법을 찾고 있다.' }],
  counterExamples: ['그 배우는 지난해 타계했다.'],
})


export const siljelo = defineRule({
  id: 'hanja-silje',
  category: 'confusable',
  confidence: 0.9,
  // 부사 '실제로'와 명사 '실재(實在)'+조사가 문자열이 같다.
  pattern: /(?<![가-힣])실재로(?=\s)/g,
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    const rest = ctx.text.slice(ctx.index + 4)
    // '참된 실재로 여기다'처럼 자격·간주 구문이면 '실재로'가 맞다.
    if (/^\s*(?:[가-힣]+\s+){0,2}(?:간주|여[기겼긴길]|받아들|인정|믿|본|봤|보았|착각|혼동|오해)/.test(rest)) return null
    return {
      suggestions: ['실제로'],
      message: "'사실은'의 뜻은 '실제로'입니다.",
      explain:
        "'실제(實際)'는 사실의 경우나 형편, '실재(實在)'는 실제로 존재함입니다. 부사로 쓸 때는 '실제로'입니다.",
    }
  },
  examples: [{ wrong: '실재로 만나 보니 사진과 많이 달랐다.', right: '실제로 만나 보니 사진과 많이 달랐다.' }],
  counterExamples: [
    '이데아를 참된 실재로 여기는 관점이다.',
    '철학자들은 이데아를 참된 실재로 여겼다.',
    '그는 소설 속 세계를 실재로 착각했다.',
    '실재론은 관념론과 대립한다.',
  ],
})

export const gonyok = defineRule({
  id: 'hanja-gonyok',
  category: 'confusable',
  confidence: 0.92,
  // '치르다'와 어울리는 것은 '곤욕'이다. '곤혹'은 '느끼다·스럽다'와 어울린다.
  pattern: /곤혹(?=을\s*(?:치렀|치르|치를))/g,
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['곤욕'],
      message: "심한 모욕을 겪는 것은 '곤욕'입니다.",
      explain: "'곤욕(困辱)'은 심한 모욕, '곤혹(困惑)'은 어찌할 바를 몰라 당황함입니다. '곤욕을 치르다'가 짝입니다.",
    }
  },
  examples: [{ wrong: '선배들 앞에서 한바탕 곤혹을 치렀다.', right: '선배들 앞에서 한바탕 곤욕을 치렀다.' }],
  counterExamples: ['갑작스러운 질문에 곤혹을 느꼈다.', '표정이 곤혹스러워 보였다.'],
})

/** 전례가 없다는 뜻이 성립하는 주제어. 사건·정도를 나타내는 말이어야 한다. */
const EVENTS = '사태|사건|참사|위기|호황|폭염|기록|규모|증가세|한파|수치'
/** 기원을 찾는 대상. 이쪽이면 '유래(由來)'가 맞다. */
const ORIGINS = /말|표현|어원|지명|이름|풍습|축제|관습|명칭|전설/

export const yurye = defineRule({
  id: 'hanja-yurye',
  category: 'confusable',
  confidence: 0.9,
  pattern: new RegExp(`(${EVENTS})(?:은|는|이|가)?\\s*(?:[가-힣]+\\s+){0,2}유래(?=를\\s*찾)`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    const before = ctx.text.slice(Math.max(0, ctx.index - 16), ctx.index)
    if (ORIGINS.test(before)) return null
    return {
      suggestions: ['유례'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "전례가 없다는 뜻은 '유례'입니다.",
      explain: "'유례(類例)'는 같은 종류의 예, '유래(由來)'는 사물이 생겨난 내력입니다. '유례를 찾기 힘들다'가 짝입니다.",
    }
  },
  examples: [{ wrong: '이번 사태는 유래를 찾기 힘든 일이다.', right: '이번 사태는 유례를 찾기 힘든 일이다.' }],
  counterExamples: ['이 지명은 유래를 찾기 어렵다.', '축제의 유래를 조사했다.'],
})

/** 기록을 깨는 것은 '경신'이다. 자료를 새로 고치는 것은 '갱신'이다. */
const RECORDS = '신기록|세계\\s*기록|최고\\s*기록|개인\\s*기록|한국\\s*기록|최고치|최다\\s*기록|대기록'

export const gyeongsin = defineRule({
  id: 'hanja-gyeongsin',
  category: 'confusable',
  confidence: 0.9,
  pattern: new RegExp(`(${RECORDS})(?:을|를)\\s*갱신`, 'g'),
  resolve(ctx) {
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['경신'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "기록을 새로 세우는 것은 '경신'입니다.",
      explain:
        "'경신(更新)'은 종전 기록을 깨는 것, '갱신(更新)'은 계약·자료를 새로 고치는 것입니다. 같은 한자를 쓰지만 쓰임이 갈립니다.",
    }
  },
  examples: [{ wrong: '그는 세계 신기록을 갱신하며 금메달을 땄다.', right: '그는 세계 신기록을 경신하며 금메달을 땄다.' }],
  counterExamples: ['접속 기록을 갱신한다.', '운전면허를 갱신했다.', '계약을 갱신하기로 했다.'],
})

export const hanjaRules: Rule[] = [jihyang, jego, tagae, siljelo, gonyok, yurye, gyeongsin]
