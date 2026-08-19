import { decompose } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 보조용언 띄어쓰기.
 *
 * 한글 맞춤법 제47항은 보조용언을 **띄어 씀을 원칙**으로 하되 두 자리에서만 붙여 쓰기를 허용한다.
 *
 *   ① `-아/-어` 뒤        — 꺼져 간다 / 꺼져간다   (둘 다 맞다)
 *   ② 관형사형 뒤          — 올 듯하다 / 올듯하다   (둘 다 맞다)
 *
 * 여기서 다루는 `-게 되다`, `-아/어야 되다`, `-아/어야 하다`는 **그 두 자리가 아니다.**
 * 그래서 붙여 쓰면 허용이 아니라 오류다.
 *
 * ## 문자열만으로 어떻게 가려내나
 *
 * `게`와 `야`는 어미이기도 하지만 명사 속에도 흔하다. 그래서 두 겹으로 막는다.
 *
 *  - **뒤를 본다.** `되/하` 다음 음절이 실제 활용형 어미인지 목록으로 확인한다.
 *    그래서 `되돌리다·되묻다·되찾다`(돌·묻·찾은 어미가 아니다)와 `여야 합의`(합+의)가 걸러진다.
 *  - **앞을 본다.** 어미 `-아/-어야`는 앞 음절이 받침 없는 ㅏ/ㅐ/ㅓ/ㅕ/ㅘ/ㅙ/ㅝ일 때만 성립한다.
 *    그래서 `분야·시야·광야·이야기·친구야·아니야`가 전부 탈락한다.
 *
 * 사전에 오른 `안되다·못되다·잘되다·헛되다·참되다`와 부사 `되게`는 앞에 `게/야`가 붙지 않아
 * 애초에 패턴이 닿지 않는다.
 *
 * ## 매치 구간과 고치는 구간이 다르다
 *
 * 패턴은 앞뒤 음절을 한 개씩 더 먹는다 — 그래야 활용형인지 판정할 수 있다.
 * 하지만 고칠 것은 가운데 두 글자뿐이라 `offset`/`length`로 구간을 좁힌다.
 * 이걸 빠뜨리면 매치 전체가 치환돼 엉뚱한 글자가 사라진다.
 */

/** `되-` 뒤에 올 수 있는 어미의 첫 음절. 여기 없으면 `되돌리다·되묻다·되찾다`류 파생어다. */
const DOE_EOMI = new Set([
  '다', '고', '면', '니', '지', '어', '었', '는', '며', '나', '도', '기', '겠', '던', '네', '자', '죠', '잖', '건', '든', '거',
])
/** `된/될/됐/됨/돼` 뒤에 올 수 있는 음절. 어절 끝(빈 문자열)도 허용한다. */
const DOEN_NEXT = new Set(['다', '대', '데', '지'])
const DOEL_NEXT = new Set(['까', '지', '수', '때', '뿐', '걸', '것', '거', '텐', '줄', '리'])
const DWAET_NEXT = new Set(['다', '어', '고', '네', '는', '지', '으', '던', '겠', '습', '음', '을'])
const DOEM_NEXT = new Set(['을', '이', '에', '도', '과', '은', '의', '만'])
const DWAE_NEXT = new Set(['서', '요', '도', '야', '라'])

/** 뒤 음절까지 보아 `되다`의 활용형이 맞는지 확인한다. */
function isDoeInflection(head: string, next: string): boolean {
  if (head === '되') return DOE_EOMI.has(next)
  if (head === '됩') return next === '니'
  if (next === '') return true
  if (head === '된') return DOEN_NEXT.has(next)
  if (head === '될') return DOEL_NEXT.has(next)
  if (head === '됐') return DWAET_NEXT.has(next)
  if (head === '됨') return DOEM_NEXT.has(next)
  if (head === '돼') return DWAE_NEXT.has(next)
  return false
}

/** `하-` 뒤에 올 수 있는 어미의 첫 음절. */
const HA_EOMI = new Set([
  '다', '고', '면', '니', '지', '는', '며', '나', '도', '기', '겠', '던', '네', '자', '죠', '잖', '건', '든', '거', '여', '였',
])
const HAN_NEXT = new Set(['다', '대', '데', '지'])
const HAL_NEXT = new Set(['까', '지', '수', '때', '뿐', '걸', '것', '거', '텐', '줄', '리', '만'])
const HAET_NEXT = new Set(['다', '어', '고', '네', '는', '지', '으', '던', '겠', '습', '음', '을'])
const HAM_NEXT = new Set(['을', '이', '에', '도', '과', '은', '의', '만'])
const HAE_NEXT = new Set(['서', '요', '도', '야', '라'])

/** 뒤 음절까지 보아 `하다`의 활용형이 맞는지 확인한다. `여야 합의`의 '합의'는 여기서 걸러진다. */
function isHadaInflection(head: string, next: string): boolean {
  if (head === '하') return HA_EOMI.has(next)
  if (head === '합') return next === '니'
  if (next === '') return true
  if (head === '한') return HAN_NEXT.has(next)
  if (head === '할') return HAL_NEXT.has(next)
  if (head === '했') return HAET_NEXT.has(next)
  if (head === '함') return HAM_NEXT.has(next)
  if (head === '해') return HAE_NEXT.has(next)
  return false
}

/**
 * 어미 `-아/-어야`의 앞자리인가.
 *
 * `야`는 조사이기도 하고(`철수야`, `내 거야`) 명사 안에도 흔하다(`분야·시야·이야기`).
 * 어미 `-아/-어야`가 붙으려면 앞 음절이 **받침 없는** ㅏ/ㅐ/ㅓ/ㅕ/ㅘ/ㅙ/ㅝ여야 한다.
 * `해야·돼야·가야·봐야·먹어야`는 걸리고 `분야·시야·친구야·아니야`는 걸리지 않는다.
 */
const EOYA_VOWELS = new Set(['ㅏ', 'ㅐ', 'ㅓ', 'ㅕ', 'ㅘ', 'ㅙ', 'ㅝ'])

function isEoyaStem(syllable: string): boolean {
  const jamo = decompose(syllable)
  if (!jamo) return false
  return jamo.tail === '' && EOYA_VOWELS.has(jamo.vowel)
}

export const bojoGeDoeda = defineRule({
  id: 'bojo-ge-doeda',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣])게(되|된|될|됐|됨|됩|돼)([가-힣]?)/g,
  resolve(ctx) {
    const head = ctx.match[2] ?? ''
    // '되돌려·되묻지·되찾을'처럼 접두사 '되-'가 붙은 파생어는 여기서 걸러진다.
    if (!isDoeInflection(head, ctx.match[3] ?? '')) return null
    return {
      suggestions: [`게 ${head}`],
      offset: 1,
      length: 2,
      message: "보조용언 '되다'는 앞말과 띄어 씁니다.",
      explain:
        "'-게 되다'는 본용언과 보조용언이 이어진 구성입니다. 붙여 쓸 수 있는 것은 '-아/-어' 뒤와 관형사형 뒤의 보조용언뿐이라(제47항), '-게' 뒤의 '되다'는 반드시 띄어 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '노력하다 보니 좋은 결과를 얻게된다.', right: '노력하다 보니 좋은 결과를 얻게 된다.' },
    { wrong: '결국 나도 같은 말을 하게됐다.', right: '결국 나도 같은 말을 하게 됐다.' },
    { wrong: '시간이 지나면 자연스럽게 알게될 것이다.', right: '시간이 지나면 자연스럽게 알게 될 것이다.' },
    { wrong: '그 일을 맡게되면서 생각이 바뀌었다.', right: '그 일을 맡게 되면서 생각이 바뀌었다.' },
    { wrong: '이런 일이 자꾸 반복되면 서로 지치게됩니다.', right: '이런 일이 자꾸 반복되면 서로 지치게 됩니다.' },
  ],
  counterExamples: [
    '오늘 날씨가 되게 춥다.',
    '그 영화 되게 재미있었어.',
    '되게 오래 기다렸네.',
    '일이 잘되면 좋겠다.',
    '장사가 잘된다.',
    '그 사람 참 못됐어.',
    '헛된 꿈이었다.',
    '참된 어른이 되고 싶다.',
    '우리 가게 된장찌개가 맛있다.',
    '동생에게 되돌려 주었다.',
    '나에게 되묻지 마라.',
    '쉽게 되찾을 수 있다.',
    '그 말을 되풀이했다.',
    '자연스럽게 되도록 연습했다.',
    '서로를 더 이해하게 되는 게 아닐까.',
    '어떻게 되었는지 궁금하다.',
    '성함이 어떻게 되세요?',
  ],
})

export const bojoEoyaDoeda = defineRule({
  id: 'bojo-eoya-doeda',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])야(되|된|될|됐|됨|됩|돼)([가-힣]?)/g,
  resolve(ctx) {
    if (!isEoyaStem(ctx.match[1] ?? '')) return null
    const head = ctx.match[2] ?? ''
    if (!isDoeInflection(head, ctx.match[3] ?? '')) return null
    return {
      suggestions: [`야 ${head}`],
      offset: 1,
      length: 2,
      message: "보조용언 '되다'는 앞말과 띄어 씁니다.",
      explain:
        "'-아/-어야 되다'의 '되다'는 보조용언입니다. 제47항이 붙여쓰기를 허용하는 것은 '-아/-어' 뒤뿐이고 '-아/-어야'는 그 범위 밖이라, 언제나 띄어 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '내일까지는 이 일을 끝내야된다.', right: '내일까지는 이 일을 끝내야 된다.' },
    { wrong: '지금 출발해야된다고 재촉했다.', right: '지금 출발해야 된다고 재촉했다.' },
    { wrong: '숙제를 다 해야될 것 같다.', right: '숙제를 다 해야 될 것 같다.' },
  ],
  counterExamples: [
    '평균이 90점은 돼야 한다.',
    '이 정도는 돼야 말이 되지.',
    '분야를 넓혀야 한다.',
    '시야가 흐려졌다.',
    '광야를 홀로 걸었다.',
    '이야기를 오래 나누었다.',
    '철수야 학교 가자.',
    '영희야 밥 먹어.',
    '그건 내 거야.',
    '더 이상 미뤄서는 안 되겠다.',
  ],
})

export const bojoEoyaHada = defineRule({
  id: 'bojo-eoya-hada',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])야(하|한|할|했|함|합|해)([가-힣]?)/g,
  resolve(ctx) {
    if (!isEoyaStem(ctx.match[1] ?? '')) return null
    const head = ctx.match[2] ?? ''
    if (!isHadaInflection(head, ctx.match[3] ?? '')) return null
    return {
      suggestions: [`야 ${head}`],
      offset: 1,
      length: 2,
      message: "보조용언 '하다'는 앞말과 띄어 씁니다.",
      explain:
        "'-아/-어야 하다'의 '하다'는 보조용언입니다. 제47항이 붙여쓰기를 허용하는 것은 '-아/-어' 뒤뿐이고 '-아/-어야'는 그 범위 밖이라, 언제나 띄어 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '약속을 했으면 지켜야한다.', right: '약속을 했으면 지켜야 한다.' },
    { wrong: '아침은 꼭 먹어야한다고 배웠다.', right: '아침은 꼭 먹어야 한다고 배웠다.' },
    { wrong: '규칙은 모두가 지켜야합니다.', right: '규칙은 모두가 지켜야 합니다.' },
    { wrong: '이제는 스스로 결정해야해.', right: '이제는 스스로 결정해야 해.' },
  ],
  counterExamples: [
    '옷차림이 너무 야하다.',
    '저 옷은 좀 야한 것 같아.',
    '반드시 지켜야 합니다.',
    '이 정도는 돼야 하지 않을까.',
    '분야를 넓혀야 한다.',
    '여야 합의로 예산안이 통과됐다.',
    '영희야 밥 먹어.',
    '얘기야 많이 들었지.',
    '빨리 나아야 할 텐데.',
    '이제 그만해야겠다.',
  ],
})

export const bojoRules: Rule[] = [bojoGeDoeda, bojoEoyaDoeda, bojoEoyaHada]
