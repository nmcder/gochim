import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 문어체 — 자기소개서·생활기록부·보고서에서 자주 나오는 표기·띄어쓰기 오류.
 *
 * 수와 단위, 접두사 `제-`, 접미사 `-가량`처럼 **한글 맞춤법 제43~46항**이 다루는
 * 자리가 많다. 규정 자체는 단순한데, 문자열만 보고 적용하면 숫자가 없는 자리까지
 * 건드리게 되므로 **수가 앞에 있을 때만** 발화하도록 못박았다.
 */

/** 수 뒤에 붙는 단위 명사. 붙여 쓰는 접미사와 띄어 쓰는 의존명사를 가르는 기준이 된다. */
const UNITS = '시간|분|초|일|주|주일|개월|년|달|명|개|권|장|가지|곳|차례|번|건|편|회|원|점|kg|km|cm|%'

export const jeOrdinal = defineRule({
  id: 'je-ordinal',
  category: 'spacing',
  confidence: 0.93,
  // 접두사 '제-'는 뒤에 붙여 쓴다(제43항 붙임). 관형사 '제(=저의)'와 달리 홀로 서지 않는다.
  pattern: /(?<![가-힣])제\s+(\d+\s*(?:회|차|항|조|장|편|호|기|절|과))/g,
  resolve(ctx) {
    const tail = ctx.match[1] ?? ''
    return {
      suggestions: [`제${tail}`],
      message: "차례를 나타내는 '제-'는 뒤 말에 붙여 씁니다.",
      explain: "'제(第)'는 접두사라 '제1회, 제3장'처럼 붙여 씁니다. 소유를 뜻하는 관형사 '제(=저의)'와는 다릅니다.",
      refs: ['한글 맞춤법 제43항'],
    }
  },
  examples: [{ wrong: '제 1회 교내 과학 탐구 대회에서 금상을 받았습니다.', right: '제1회 교내 과학 탐구 대회에서 금상을 받았습니다.' }],
  counterExamples: ['제 3번째 도전이었습니다.', '이건 제 책입니다.'],
})

export const garyangSuffix = defineRule({
  id: 'garyang-suffix',
  category: 'spacing',
  confidence: 0.93,
  // '-가량'은 접미사라 붙여 쓴다. 수량 표현 뒤에서만 발화한다.
  pattern: new RegExp(`(\\d+\\s*(?:${UNITS}))\\s+가량`, 'g'),
  resolve(ctx) {
    const quantity = ctx.match[1] ?? ''
    return {
      suggestions: [`${quantity}가량`],
      message: "'-가량'은 접미사라 앞말에 붙여 씁니다.",
      explain: "'가량(假量)'은 '정도'를 뜻하는 접미사입니다. 의존명사 '정도'와 달리 띄어 쓰지 않습니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [{ wrong: '졸업까지 총 120시간 가량 봉사에 참여했습니다.', right: '졸업까지 총 120시간가량 봉사에 참여했습니다.' }],
  counterExamples: ['봉사 시간이 120시간 정도 됩니다.'],
})

export const yeoUnit = defineRule({
  id: 'yeo-unit',
  category: 'spacing',
  confidence: 0.93,
  // '-여'는 수에 붙는 접미사, 그 뒤의 단위 명사는 띄어 쓴다. 숫자가 없으면 '여명(餘命)'이 깨진다.
  pattern: new RegExp(`(\\d+여)(${UNITS})`, 'g'),
  resolve(ctx) {
    const [, quantity = '', unit = ''] = ctx.match
    return {
      suggestions: [`${quantity} ${unit}`],
      message: '단위 명사는 앞말과 띄어 씁니다.',
      explain: "'-여'는 수에 붙는 접미사이므로 '300여'까지 붙여 쓰고, 단위 명사 '명'은 띄어 씁니다.",
      refs: ['한글 맞춤법 제43항'],
    }
  },
  examples: [{ wrong: '발표회에는 전교생 300여명이 참석했습니다.', right: '발표회에는 전교생 300여 명이 참석했습니다.' }],
  counterExamples: ['남은 여명을 헤아리는 일은 부질없다.'],
})

export const donganSpacing = defineRule({
  id: 'dongan-spacing',
  category: 'spacing',
  confidence: 0.94,
  // 의존명사 '동안'은 띄어 쓴다. 한 단어인 '그동안·한동안·오랫동안'은 숫자가 앞에 없다.
  pattern: new RegExp(`(\\d+\\s*(?:년|개월|달|주|주일|일|시간|분))동안`, 'g'),
  resolve(ctx) {
    const quantity = ctx.match[1] ?? ''
    return {
      suggestions: [`${quantity} 동안`],
      message: "의존명사 '동안'은 앞말과 띄어 씁니다.",
      explain: "'동안'은 의존명사입니다. '그동안·한동안·오랫동안'은 한 단어로 굳어 붙여 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '고등학교 3년동안 학급 도우미를 맡았습니다.', right: '고등학교 3년 동안 학급 도우미를 맡았습니다.' }],
  counterExamples: ['그동안 고마웠습니다.', '한동안 연락이 없었다.', '오랫동안 기다렸다.'],
})

export const geotIbnida = defineRule({
  id: 'geot-ibnida',
  category: 'spacing',
  confidence: 0.95,
  // 서술격 조사는 앞말에 붙여 쓴다.
  pattern: /것\s+(입니다|이다|이었습니다|이에요|입니까|이라고)/g,
  resolve(ctx) {
    const tail = ctx.match[1] ?? ''
    return {
      suggestions: [`것${tail}`],
      message: '서술격 조사는 앞말에 붙여 씁니다.',
      explain: "'입니다'의 '이-'는 서술격 조사입니다. 조사는 앞말에 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [{ wrong: '제 꿈은 생명공학 연구원이 되는 것 입니다.', right: '제 꿈은 생명공학 연구원이 되는 것입니다.' }],
  counterExamples: ['이 일은 제가 맡은 것 중 가장 어려웠습니다.'],
})

export const dahada = defineRule({
  id: 'dahada',
  category: 'spacing',
  confidence: 0.92,
  // '다하다'는 한 단어다. 부사 '다'와 동사 '하다'가 따로 있는 것이 아니다.
  pattern: /(최선|정성|책임|소임|의무|본분|힘)을\s+다\s+(했|하|한|함|합|해)/g,
  resolve(ctx) {
    const [, object = '', tail = ''] = ctx.match
    return {
      suggestions: [`${object}을 다${tail}`],
      message: "'다하다'는 한 단어라 붙여 씁니다.",
      explain: "'최선을 다하다'의 '다하다'는 사전에 오른 한 단어입니다. 부사 '다' + '하다'로 나누어 쓰지 않습니다.",
    }
  },
  examples: [{ wrong: '저는 맡은 역할에 언제나 최선을 다 했습니다.', right: '저는 맡은 역할에 언제나 최선을 다했습니다.' }],
  counterExamples: ['숙제를 다 하고 나서 놀았습니다.'],
})

export const doublePassive = defineRule({
  id: 'double-passive',
  category: 'ending',
  confidence: 0.93,
  // '-되다'가 이미 피동인데 '-어지다'를 겹쳐 붙인 자리.
  // '되어집니다'의 셋째 음절은 '집'이지 '지'가 아니다. 활용형을 하나씩 열거해야 한다.
  pattern: /(생각|고려|판단|예상|기대|추측|해석|이해|평가)되어(집니다|집니까|지다|지는|지지|진|졌|져)/g,
  resolve(ctx) {
    const stem = ctx.match[1] ?? ''
    const inflection = ctx.match[2] ?? ''
    const plain: Record<string, string> = {
      집니다: '됩니다',
      집니까: '됩니까',
      지다: '되다',
      지는: '되는',
      지지: '되지',
      진: '된',
      졌: '됐',
      져: '되어',
    }
    const fixed = plain[inflection]
    if (!fixed) return null
    return {
      suggestions: [`${stem}${fixed}`],
      message: '피동을 두 번 겹쳐 썼습니다.',
      explain: "'-되다'가 이미 피동입니다. 여기에 '-어지다'를 또 붙이면 이중 피동이 됩니다. ('생각됩니다'가 맞습니다)",
    }
  },
  examples: [
    { wrong: '이 경험은 제게 큰 자산이 되었다고 생각되어집니다.', right: '이 경험은 제게 큰 자산이 되었다고 생각됩니다.' },
    { wrong: '그렇게 판단되어지는 이유가 있습니다.', right: '그렇게 판단되는 이유가 있습니다.' },
  ],
  counterExamples: ['그 계획은 잘 만들어졌습니다.', '합의가 이루어지지 않았습니다.'],
})


/** `-등`으로 끝나는 한 낱말. 나열의 의존명사 '등'과 문자열이 겹친다. */
const WORD_DEUNG = new Set([
  '평등', '차등', '균등', '고등', '초등', '중등', '대등', '동등', '열등', '우등',
  '무등', '상등', '하등', '계등', '불평등', '남등',
])

export const nnbDeung = defineRule({
  id: 'nnb-deung',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣]{2,})등([을이과와의도만])/g,
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    const josaCh = ctx.match[2] ?? ''
    // '평등을·고등의'처럼 한 낱말이면 건드리지 않는다. 뒤에서 두 글자만 본다.
    if (WORD_DEUNG.has(head.slice(-1) + '등') || WORD_DEUNG.has(head.slice(-2) + '등')) return null
    // 나열의 '등'은 앞에 쉼표가 있다. 이 조건이 없으면 '평등을'류를 전부 훑는다.
    if (!/[,·]/.test(ctx.text.slice(0, ctx.index))) return null
    return {
      suggestions: [`${head} 등${josaCh}`],
      message: "나열을 뜻하는 '등'은 의존명사라 띄어 씁니다.",
      explain: "'등(等)'은 의존명사입니다. '평등·고등'처럼 한 낱말의 일부인 '등'과는 다릅니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '지원서, 자기소개서, 포트폴리오등을 함께 제출하세요.', right: '지원서, 자기소개서, 포트폴리오 등을 함께 제출하세요.' },
  ],
  counterExamples: ['자유, 평등, 박애는 프랑스 혁명의 구호였다.', '고등학교 3년 동안 반장을 맡았다.'],
})

/** `께서` 주어에는 서술어에도 높임이 와야 한다. */
const HONORED_VERBS: Record<string, string> = {
  갔습니다: '가셨습니다',
  왔습니다: '오셨습니다',
  했습니다: '하셨습니다',
  봤습니다: '보셨습니다',
  먹었습니다: '드셨습니다',
  말했습니다: '말씀하셨습니다',
  보냈습니다: '보내셨습니다',
  줬습니다: '주셨습니다',
}

export const kkeseoAgreement = defineRule({
  id: 'kkeseo-agreement',
  category: 'ending',
  confidence: 0.9,
  pattern: new RegExp(`께서\\s*((?:[가-힣]+\\s+){0,3}?)(${Object.keys(HONORED_VERBS).join('|')})`, 'g'),
  resolve(ctx) {
    const middle = ctx.match[1] ?? ''
    const verb = ctx.match[2] ?? ''
    // 사이에 다른 주어나 절 경계가 있으면 그 주어의 서술어다.
    if (/제가|저는|저희|이가|가\s|은\s|는\s|니까|테니|어서|아서|으면/.test(middle)) return null
    const honored = HONORED_VERBS[verb]
    if (!honored) return null
    return {
      suggestions: [honored],
      offset: ctx.match[0].length - verb.length,
      length: verb.length,
      message: "'께서'가 주어면 서술어에도 높임을 씁니다.",
      explain:
        "주격 조사 '께서'는 주어를 높이는 형태입니다. 서술어에 '-시-'를 넣지 않으면 높임이 반쪽만 됩니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [{ wrong: '사장님께서 방금 회의실로 갔습니다.', right: '사장님께서 방금 회의실로 가셨습니다.' }],
  counterExamples: ['사장님께서 부르셔서 제가 회의실로 갔습니다.'],
})


export const waeIrae = defineRule({
  id: 'wae-irae',
  category: 'spacing',
  confidence: 0.94,
  // 부사 '왜'와 '이러다'는 별개의 말이다.
  pattern: /(?<![가-힣])왜(이래|이러|이랬|이러지|이럴)/g,
  resolve(ctx) {
    const tail = ctx.match[1] ?? ''
    return {
      suggestions: [`왜 ${tail}`],
      message: "부사 '왜'는 뒤 말과 띄어 씁니다.",
      explain: "'왜'는 부사, '이러다'는 동사입니다. 서로 다른 낱말이라 띄어 씁니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [{ wrong: '야 너 오늘따라 왜이래 무슨 일 있어?', right: '야 너 오늘따라 왜 이래 무슨 일 있어?' }],
  counterExamples: ['왜 이렇게 늦었어?'],
})

export const myeotBeon = defineRule({
  id: 'myeot-beon',
  category: 'spacing',
  confidence: 0.94,
  // 관형사 '몇'과 단위 명사는 띄어 쓴다.
  pattern: /(?<![가-힣])몇(번|개|명|시|분|살|권|장|가지|군데|차례)(?=[을를이가은는도만의에]|\s|[.,!?]|$)/g,
  resolve(ctx) {
    const unit = ctx.match[1] ?? ''
    return {
      suggestions: [`몇 ${unit}`],
      message: "관형사 '몇'은 단위 명사와 띄어 씁니다.",
      explain: "'몇'은 수를 묻는 관형사이고 '번·개·명'은 단위 명사입니다. 서로 띄어 씁니다.",
      refs: ['한글 맞춤법 제43항'],
    }
  },
  examples: [{ wrong: '내가 몇번을 말했는지 기억도 안 나.', right: '내가 몇 번을 말했는지 기억도 안 나.' }],
  counterExamples: ['며칠 뒤에 보자.', '몇몇 사람만 왔다.'],
})

export const kkeoya = defineRule({
  id: 'kkeo-ya',
  category: 'ending',
  confidence: 0.93,
  // 의존명사 '거'를 된소리로 적은 형태. '것'의 구어형이라 '거'로 적고 띄어 쓴다.
  pattern: /([가-힣])꺼(야|예요|에요|다|니|임|였)/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (finalOf(prev) !== 'ㄹ') return null
    return {
      suggestions: [`${prev} 거${tail}`],
      message: "의존명사 '거'는 된소리로 적지 않고 띄어 씁니다.",
      explain: "'거'는 '것'의 구어형 의존명사입니다. [꺼]로 소리 나도 '거'로 적고 앞말과 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '너 내일 학교 안 가면 뭐 할꺼야?', right: '너 내일 학교 안 가면 뭐 할 거야?' }],
  counterExamples: ['이거 네 거야?', '반찬 껍데기를 벗겼다.'],
})

export const formalRules: Rule[] = [
  jeOrdinal,
  garyangSuffix,
  yeoUnit,
  donganSpacing,
  geotIbnida,
  dahada,
  doublePassive,
  nnbDeung,
  kkeseoAgreement,
  waeIrae,
  myeotBeon,
  kkeoya,
]
