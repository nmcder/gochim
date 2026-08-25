import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 받침을 보고 판정하는 규칙들.
 *
 * 사전에 단어를 하나씩 넣는 대신 **규칙 자체를 코드로 적는다.**
 * `경쟁율/경쟁률`은 표제어를 다 모을 수 없지만, "앞말 받침이 ㄴ이거나 없으면 율,
 * 그 밖에는 률"이라는 규정 하나로 전부 처리된다.
 */

/** 두음법칙 — 모음이나 ㄴ 받침 뒤에서는 '열·율', 그 밖에는 '렬·률'. */
export const dueumYul = defineRule({
  id: 'dueum-yul',
  category: 'spelling',
  confidence: 0.95,
  // 뒤에 조사나 경계가 와야 한 단어의 끝이다. ('체육율동' 같은 우연한 결합 방지)
  pattern: /([가-힣])율(?=[이가은는을를도만의로과와]|[\s.,!?)\]]|$)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    const tail = finalOf(prev)
    // 받침이 없거나 ㄴ이면 '율'이 맞다 — 비율, 환율, 출산율.
    if (tail === '' || tail === 'ㄴ') return null
    return {
      suggestions: ['률'],
      offset: 1,
      length: 1,
      message: "모음이나 'ㄴ' 받침 뒤가 아니면 '률'로 적습니다.",
      explain:
        "한자 '率'은 모음이나 'ㄴ' 받침 뒤에서만 '율'로 적습니다(비율, 환율, 출산율). 그 밖에는 '률'입니다(경쟁률, 합격률).",
      refs: ['한글 맞춤법 제11항 [붙임 1]'],
    }
  },
  examples: [
    { wrong: '이번 채용은 경쟁율이 유난히 높았습니다.', right: '이번 채용은 경쟁률이 유난히 높았습니다.' },
    { wrong: '올해 합격율은 작년보다 낮다.', right: '올해 합격률은 작년보다 낮다.' },
  ],
  counterExamples: ['환율이 크게 올랐다.', '출산율 감소가 문제다.', '비율을 계산해 보자.'],
})

/** 두음법칙 반대 방향 — 모음이나 ㄴ 받침 뒤인데 '률'로 적은 자리. */
export const dueumRyul = defineRule({
  id: 'dueum-ryul',
  category: 'spelling',
  confidence: 0.95,
  pattern: /([가-힣])률(?=[이가은는을를도만의로과와]|[\s.,!?)\]]|$)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    const tail = finalOf(prev)
    // 받침이 없거나 ㄴ이면 '율'이라야 한다 — 비율, 환율, 참여율.
    if (tail !== '' && tail !== 'ㄴ') return null
    return {
      suggestions: ['율'],
      offset: 1,
      length: 1,
      message: "모음이나 'ㄴ' 받침 뒤에서는 '율'로 적습니다.",
      explain:
        "한자 '率'은 모음이나 'ㄴ' 받침 뒤에서 '율'로 적습니다(비율, 환율, 참여율). 그 밖에는 '률'입니다(경쟁률, 합격률).",
      refs: ['한글 맞춤법 제11항 [붙임 1]'],
    }
  },
  examples: [
    { wrong: '설문 조사 참여률이 90%를 넘었습니다.', right: '설문 조사 참여율이 90%를 넘었습니다.' },
    { wrong: '올해 이자률이 크게 올랐다.', right: '올해 이자율이 크게 올랐다.' },
  ],
  counterExamples: ['이번 채용은 경쟁률이 높았다.', '합격률을 계산해 보자.'],
})

/**
 * 수를 세는 말 — 수사와 수 관형사.
 *
 * 국어에서 **닫혀 있는 몇 안 되는 집합**이라 목록으로 적어도 뒷문이 되지 않는다.
 * 새 수사가 생기는 일은 없다.
 */
const SUSA = /(?:\d+|[일이삼사오육칠팔구십백천만억조]+|수[십백천만]+|몇[십백천]?|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열[한두세네댓]?|스무|스물[한두세네댓]?|서른|마흔|쉰|예순|일흔|여든|아흔|여남은|댓|서너|너덧|대여섯|예닐곱|일고여덟)여?$/

/** 두음법칙 — 어두의 '년'은 '연'으로 적는다. 수 뒤에 오는 의존명사 '년'은 그대로. */
export const dueumYeon = defineRule({
  id: 'dueum-yeon',
  autoFixSafe: true,
  category: 'spelling',
  confidence: 0.93,
  pattern: /(?<![가-힣\d])년(도|말|초|간|중)/g,
  resolve(ctx) {
    const tail = ctx.match[1] ?? ''
    // 앞말과 띄어 쓴 의존명사는 어두가 아니다 — '십 년간·몇 년도·120여 년간'.
    // lookbehind 는 공백을 어두로 읽으므로 여기서 앞 어절을 직접 본다.
    const before = ctx.text.slice(0, ctx.index)
    if (/[ \t]$/.test(before) && SUSA.test(before.trimEnd())) return null
    return {
      suggestions: [`연${tail}`],
      message: "한자어 첫머리에서는 '연'으로 적습니다.",
      explain: "두음법칙에 따라 한자어 첫머리의 '녀·뇨·뉴·니'는 '여·요·유·이'로 적습니다. ('2024년도'처럼 수 뒤에 오면 그대로 '년'입니다)",
      refs: ['한글 맞춤법 제10항'],
    }
  },
  examples: [{ wrong: '년도별 판매 실적을 정리했습니다.', right: '연도별 판매 실적을 정리했습니다.' }],
  counterExamples: [
    '2024년도 예산안을 확정했다.',
    '올해 매출은 작년 대비 늘었다.',
    '십 년간 같은 일을 했다.',
    '몇 년도에 있었던 일인지 모르겠다.',
    '120여 년간 이어진 전통이다.',
    '스물세 년간은 아무래도 어색한 말이다.',
    '수십 년간 자리를 지켰다.',
  ],
})

/** `-슴`은 없다. 명사형 어미는 `-(으)ㅁ`이라 `했음`이다. */
export const myeongsahyeongEum = defineRule({
  id: 'myeongsa-eum',
  category: 'ending',
  confidence: 0.95,
  pattern: /([가-힣])슴(?!니)/g,
  resolve(ctx) {
    // 받침 있는 음절 뒤의 '슴'은 명사형 '-음'의 잘못이다. ('가슴·사슴'은 받침이 없다)
    if (finalOf(ctx.match[1] ?? '') === '') return null
    return {
      suggestions: ['음'],
      offset: 1,
      length: 1,
      message: "명사형 어미는 '-음'입니다.",
      explain:
        "'했습니다'의 '습'에 이끌려 '했슴'으로 적는 일이 잦지만, 명사형 어미는 '-(으)ㅁ'이라 '했음'입니다.",
      refs: ['한글 맞춤법 제19항'],
    }
  },
  examples: [{ wrong: '다음 주에 다시 논의하기로 했슴.', right: '다음 주에 다시 논의하기로 했음.' }],
  counterExamples: ['다음 주에 다시 논의하기로 했음.', '회의를 마쳤습니다.', '가슴이 두근거렸다.', '사슴이 뛰어갔다.'],
})

/** 까닭을 나타내는 어미는 `-(으)므로`다. `-(으)ㅁ + 으로`는 수단을 뜻하는 다른 말이다. */
export const eumeuroMeuro = defineRule({
  id: 'eum-euro',
  category: 'ending',
  confidence: 0.9,
  pattern: /([가-힣])음으로(?!써)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    // 과거 시제 'ㅆ' 받침 뒤일 때만. '믿음으로 살다'처럼 진짜 명사형은 건드리지 않는다.
    if (finalOf(prev) !== 'ㅆ') return null
    return {
      suggestions: [`${prev}으므로`],
      offset: 0,
      length: 4,
      message: "까닭을 나타낼 때는 '-으므로'입니다.",
      explain:
        "'-(으)므로'는 까닭을 나타내는 어미이고, '-(으)ㅁ으로(써)'는 수단을 나타내는 명사형 + 조사입니다. 뒤에 '써'를 넣어 말이 되면 '-ㅁ으로', 안 되면 '-므로'입니다.",
    }
  },
  examples: [{ wrong: '폭우가 쏟아졌음으로 행사는 취소되었다.', right: '폭우가 쏟아졌으므로 행사는 취소되었다.' }],
  counterExamples: ['그는 꾸준히 운동함으로써 체력을 길렀다.', '믿음으로 어려움을 이겨 냈다.'],
})

/** 자격을 나타내는 것은 `-로서`, 수단은 `-로써`. 사람·역할 명사 뒤라면 자격이다. */
const ROLE_NOUNS = [
  '학생', '회장', '반장', '팀장', '부모', '선생', '교사', '의사', '시민', '국민',
  '친구', '아들', '사람', '담당자', '대표', '주장', '리더', '위원장', '사장', '직원',
  '후배', '선배', '작가', '가장', '어른', '선수', '회원', '개발자', '전문가',
]

export const roseoQualification = defineRule({
  id: 'roseo-qualification',
  autoFixSafe: true,
  category: 'confusable',
  confidence: 0.92,
  pattern: new RegExp(`(${ROLE_NOUNS.join('|')})(으로써|로써)`, 'g'),
  resolve(ctx) {
    const [, noun = '', particle = ''] = ctx.match
    return {
      suggestions: [`${noun}${particle === '으로써' ? '으로서' : '로서'}`],
      message: "자격·신분을 나타낼 때는 '-로서'입니다.",
      explain: "'-로서'는 지위나 자격(학생으로서), '-로써'는 수단이나 도구(대화로써 해결)를 나타냅니다.",
    }
  },
  examples: [
    { wrong: '학생회장으로써 책임을 다하겠습니다.', right: '학생회장으로서 책임을 다하겠습니다.' },
    { wrong: '학생으로써 지켜야 할 규칙을 정리했다.', right: '학생으로서 지켜야 할 규칙을 정리했다.' },
  ],
  counterExamples: ['대화로써 문제를 해결했다.', '학생으로서 할 일을 했다.'],
})

export const morphologyRules: Rule[] = [dueumYul, dueumRyul, dueumYeon, myeongsahyeongEum, eumeuroMeuro, roseoQualification]
