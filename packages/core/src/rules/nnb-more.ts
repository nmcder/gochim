import { decompose, finalOf } from '../hangul.js'
import { defineLexicon, defineRule } from './define.js'
import type { Rule } from '../types.js'

const isN = (ch: string) => finalOf(ch) === 'ㄴ'
const isL = (ch: string) => finalOf(ch) === 'ㄹ'
const isNorL = (ch: string) => isN(ch) || isL(ch)

/** `듯`과 붙어 한 낱말이 된 말. */
const WORD_DEUT = new Set(['반듯', '번듯', '산듯', '선듯'])

export const nnbDeut = defineRule({
  id: 'nnb-deut',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣])듯/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    // ㄴ종성만 본다. ㄹ은 어간 끝소리일 수 있어 어미 '-듯'과 가를 수 없다 (알듯 말듯).
    if (!isN(prev)) return null
    if (WORD_DEUT.has(prev + '듯')) return null
    if (!/[가-힣]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 듯`],
      offset: 0,
      length: 2,
      message: "의존명사 '듯'은 앞말과 띄어 씁니다.",
      explain:
        "관형사형 어미 '-ㄴ/-는' 뒤의 '듯'은 의존명사입니다. 어간에 바로 붙는 어미 '-듯'('물 흐르듯')과는 다릅니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '콘텐츠는 좋은데 운영이 안되는듯.', right: '콘텐츠는 좋은데 운영이 안되는 듯.' },
    { wrong: '다들 아는듯이 고개를 끄덕였다.', right: '다들 아는 듯이 고개를 끄덕였다.' },
    { wrong: '비가 올 것 같은듯한 하늘이다.', right: '비가 올 것 같은 듯한 하늘이다.' },
  ],
  counterExamples: [
    '액자를 벽에 반듯이 걸어 두었다.',
    '번듯한 직장을 구했다.',
    '물 흐르듯 시간이 지나갔다.',
    '구름에 달 가듯 살고 싶다.',
    '눈 녹듯 사라졌다.',
    '불 보듯 뻔하다.',
  ],
})

/**
 * 의존명사 `데`.
 *
 * 연결어미 `-는데`(비가 오는데 우산이 없다)와 문자열이 완전히 같다.
 * 그래서 두 규칙 모두 **연결어미로는 설명이 안 되는 자리**만 잡는다.
 *
 *  - `데` 뒤에 조사가 붙은 자리 — 어미 뒤에는 조사가 못 온다 (`하는 데에`, `갈 데가`)
 *  - `데` 뒤에 의존명사만이 채울 수 있는 술어가 오는 자리 (`-는 데 그치다`, `-는 데 쓰이다`)
 *
 * `-은데/-ㄴ데`는 통째로 포기한다. 형용사·서술격 뒤라 연결어미일 공산이 압도적이다.
 */
const EXACT_DE = new Set([
  '가운데', '한데', '온데', '간데', '그런데', '근데', '뭔데', '건데',
  '오는데', '내리는데', '모르는데', '안되는데', '맞는데', '그러는데',
])
/** 꼬리만 같아도 막는다. `맛있는데`·`학생인데`·`한가운데`. */
const SUFFIX_DE = ['인데', '없는데', '있는데', '싶은데', '가운데']

function blockedDe(word: string): boolean {
  const whole = word + '데'
  if (EXACT_DE.has(whole)) return true
  return SUFFIX_DE.some((tail) => whole.endsWith(tail))
}

export const nnbDeJosa = defineRule({
  id: 'nnb-de-josa',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣])데(에서|에는|에도|에|가|를|는|까지|마다)(?![가-힣])/g,
  resolve(ctx) {
    const [, prev = '', josa = ''] = ctx.match
    if (!isNorL(prev)) return null
    const word = /(?:^|[^가-힣])([가-힣]*)$/.exec(ctx.text.slice(0, ctx.index + 1))?.[1] ?? prev
    if (blockedDe(word)) return null
    return {
      suggestions: [`${prev} 데${josa}`],
      offset: 0,
      length: 2 + josa.length,
      message: "의존명사 '데'는 앞말과 띄어 씁니다.",
      explain:
        "뒤에 조사가 붙었으므로 이 '데'는 연결어미 '-는데'가 아니라 '곳·일·경우'를 뜻하는 의존명사입니다. 어미 뒤에는 조사가 붙지 못합니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '자료를 모으는데에 시간을 다 썼다.', right: '자료를 모으는 데에 시간을 다 썼다.' },
    { wrong: '갈데가 없어서 그냥 집에 왔다.', right: '갈 데가 없어서 그냥 집에 왔다.' },
    { wrong: '이걸 고치는데는 품이 많이 든다.', right: '이걸 고치는 데는 품이 많이 든다.' },
  ],
  counterExamples: [
    '가운데에 놓인 화분이 예쁘다.',
    '가운데가 움푹 파였다.',
    '한가운데를 가로질렀다.',
    '비가 오는데도 우산을 안 챙겼다.',
    '돈은 없는데 사고 싶은 건 많다.',
  ],
})

/** 의존명사 `데`가 아니면 성립하지 않는 술어들. */
const DE_PREDICATE = [
  /^\s+그[치쳤친칠]/,
  /^\s+목적[이을]/,
  /^\s+(?:[^\s.,!?]+\s+){0,1}도움[이을]/,
  /^\s+(?:초점|중점|역점|방점)[을이]/,
  /^\s+의의[가를]/,
  /^\s+어려움[이을]/,
  /^\s+(?:무리|한계)[가는]/,
  /^\s+(?:성공|실패|집중|주력|전념|몰두|기여|일조|한몫)[했하한할해]/,
  /^\s+필요[한하했함히]/,
  /^\s+(?:쓰였|쓰인|쓰이|사용되|활용되)/,
  /^\s+(?:거의\s+|모두\s+)?다\s+(?:썼|쓰|써)/,
  /^\s+(?:[^\s.,!?]+\s+)?(?:분|시간|초|일|주|달|개월|년)[이은도만]?\s+(?:더\s+)?걸[리린렸립]/,
]

export const nnbDePredicate = defineRule({
  id: 'nnb-de-predicate',
  category: 'spacing',
  confidence: 0.9,
  pattern: /((?<![가-힣])[가-힣]*([가-힣]))데(?=\s)/g,
  resolve(ctx) {
    const word = ctx.match[1] ?? ''
    const prev = ctx.match[2] ?? ''
    // 관형사형 '-는'과 '-ㄹ'만 본다. '-은데/-ㄴ데'는 형용사·서술격의 연결어미일 공산이 압도적이다.
    if (prev !== '는' && !isL(prev)) return null
    if (blockedDe(word)) return null
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length)
    if (!DE_PREDICATE.some((re) => re.test(rest))) return null
    return {
      suggestions: [`${prev} 데`],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "의존명사 '데'는 앞말과 띄어 씁니다.",
      explain:
        "'…에 그치다·…에 쓰이다·…에 시간이 걸리다'처럼 자리를 요구하는 술어 앞의 '데'는 '일·것'을 뜻하는 의존명사입니다. 연결어미 '-는데'로는 이 문장이 성립하지 않습니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '본 보고서는 축제의 효과를 분석하는데 목적이 있다.', right: '본 보고서는 축제의 효과를 분석하는 데 목적이 있다.' },
    { wrong: '주문한 게 나오는데 이십 분이 걸렸다.', right: '주문한 게 나오는 데 이십 분이 걸렸다.' },
    { wrong: '주문을 받는 법을 배우는데 다 썼다.', right: '주문을 받는 법을 배우는 데 다 썼다.' },
    { wrong: '저는 보고서를 읽는데 그치지 않았습니다.', right: '저는 보고서를 읽는 데 그치지 않았습니다.' },
    { wrong: '이 자료는 판단하는데 도움이 되었다.', right: '이 자료는 판단하는 데 도움이 되었다.' },
    { wrong: '그 돈은 집을 사는데 쓰였다.', right: '그 돈은 집을 사는 데 쓰였다.' },
    { wrong: '설득하는데 성공했다.', right: '설득하는 데 성공했다.' },
  ],
  counterExamples: [
    '비가 오는데 우산이 없다.',
    '눈이 내리는데 그치질 않는다.',
    '나도 힘든데 도움이 안 된다니.',
    '시간은 있는데 시간이 걸리는 일이라 못 하겠다.',
    '그런데 도움이 되는 사람이 없었다.',
    '근데 목적이 뭐야?',
    '학생인데 도움이 필요하다.',
    '방이 좋은데 가격이 비싸다.',
    '연구하는 데 필요한 자료를 모았다.',
  ],
})

/**
 * 의존명사 `점`.
 *
 * `점`은 한자어 합성의 뒷가지로 워낙 흔하다 — 개선점·기준점·출발점·전환점·착안점.
 * 그래서 블록리스트가 아니라 **관형사형 어미 음절 화이트리스트**로 좁힌다.
 * 합성어의 앞 음절(선·준·발·환·안·완·관·원·만·단·반·논·결·실)은 이 목록에 없다.
 */
const JEOM_HEAD = new Set([
  '은', '운', '른', '한', '인', '진', '친', '린', '든', '는', '긴', '힌', '쁜', '픈', '뜬', '쉰', '던', '뀐', '낀', '신',
  '할', '울', '볼', '을', '될', '릴', '칠', '밀', '들',
])

export const nnbJeom = defineRule({
  id: 'nnb-jeom',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])점([은는을이도만과와])/g,
  resolve(ctx) {
    const [, prev = '', josa = ''] = ctx.match
    if (!JEOM_HEAD.has(prev)) return null
    if (!/[가-힣]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 점${josa}`],
      offset: 0,
      length: 2 + josa.length,
      message: "'점'은 명사라 앞의 관형어와 띄어 씁니다.",
      explain:
        "'배운 점·아쉬운 점·주의할 점'은 관형사형과 명사가 이어진 두 단어입니다. '관점·요점·개선점'처럼 한 낱말로 굳은 말과는 다릅니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '이 경험에서 배운점은 리더십입니다.', right: '이 경험에서 배운 점은 리더십입니다.' },
    { wrong: '아쉬운점은 가격이었다.', right: '아쉬운 점은 가격이었다.' },
    { wrong: '주의할점을 미리 알려 주세요.', right: '주의할 점을 미리 알려 주세요.' },
    { wrong: '달라진점이 하나도 없다.', right: '달라진 점이 하나도 없다.' },
  ],
  counterExamples: [
    '요점만 간단히 말해라.',
    '관점이 다르다.',
    '초점을 맞췄다.',
    '개선점이 밝혀졌다.',
    '기준점을 잡았다.',
    '출발점은 여기다.',
    '전환점이 되었다.',
    '착안점은 단순했다.',
    '보완점을 찾았다.',
    '문제점을 정리했다.',
    '단점은 가격이다.',
    '만점을 받았다.',
    '원점으로 돌아갔다.',
    '논점을 흐리지 마라.',
    '결점이 없는 사람은 없다.',
    '실점을 최소화했다.',
  ],
})

/** 조사 `만큼`이 붙는 체언. 관형사형과 문자열이 겹친다. */
const NOT_MANKEUM = new Set([
  '남한', '북한', '대한', '가을', '마을', '노인', '성인', '개인', '시인', '확인', '원인', '부인', '주인',
  '연인', '애인', '군인', '죄인', '상인', '본인', '타인', '미인', '위인', '거인', '살인', '지인', '장인',
  '요인', '법인', '신인', '증인', '만인', '문인', '촌인', '광인', '범인', '병인',
])
/** 관형사형 어미로만 쓰이는 음절. 체언 끝소리로는 거의 오지 않는다. */
const MANKEUM_HEAD = new Set(['한', '할', '된', '될', '은', '을', '인'])

export const nnbMankeumAdnominal = defineRule({
  id: 'nnb-mankeum-adnominal',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])만큼/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!MANKEUM_HEAD.has(prev)) return null
    const two = ctx.text.slice(Math.max(0, ctx.index - 1), ctx.index + 1)
    if (NOT_MANKEUM.has(two)) return null
    // '은·을·인·한'은 홀로 관형사형이 못 된다 — 앞에 어간이 있어야 한다.
    if ('은을인한'.includes(prev) && !/[가-힣]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 만큼`],
      offset: 0,
      length: 3,
      message: "용언 뒤의 '만큼'은 의존명사라 띄어 씁니다.",
      explain:
        "관형사형 어미 '-ㄴ/-ㄹ' 뒤의 '만큼'은 의존명사입니다. 체언 뒤('너만큼·하늘만큼')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '어떤 업무를 맡든지 노력한만큼 돌아온다.', right: '어떤 업무를 맡든지 노력한 만큼 돌아온다.' },
    { wrong: '먹은만큼 움직여야 한다.', right: '먹은 만큼 움직여야 한다.' },
    { wrong: '할만큼 했다.', right: '할 만큼 했다.' },
    { wrong: '준비된만큼 결과가 나온다.', right: '준비된 만큼 결과가 나온다.' },
    { wrong: '믿을만큼 성실했다.', right: '믿을 만큼 성실했다.' },
    { wrong: '중요한 사안인만큼 신중해야 한다.', right: '중요한 사안인 만큼 신중해야 한다.' },
  ],
  counterExamples: [
    '나도 너만큼 열심히 준비했어.',
    '나는 너를 하늘만큼 땅만큼 좋아해.',
    '북한만큼 폐쇄적인 나라도 드물다.',
    '가을만큼 좋은 계절이 없다.',
    '성인만큼 컸구나.',
    '본인만큼 잘 아는 사람은 없다.',
    '이만큼만 주세요.',
    '그만큼 노력했으니 됐다.',
  ],
})

/** `-아/-어지다`의 관형사형이 될 수 있는 열린 모음. */
const OPEN_VOWEL = new Set(['ㅏ', 'ㅓ', 'ㅐ', 'ㅔ', 'ㅕ', 'ㅘ', 'ㅝ', 'ㅙ', 'ㅞ', 'ㅚ', 'ㅟ'])
/** ㄹ 관형사형 가운데 체언 끝소리로 거의 오지 않는 음절. */
const PPUN_HEAD = new Set(['될', '을', '낼', '올', '갈', '볼', '찰', '길', '릴', '킬'])
const NOT_PPUN = new Set([
  '가을', '마을', '재질', '자질', '체질', '저질', '차질', '이질', '하질', '기질', '지질', '소질',
])

/** `늦어질·나빠질·좋아질`처럼 `-아/-어지다`의 관형사형인가. */
function isEojil(before: string, prev: string): boolean {
  if (prev !== '질') return false
  const j = decompose(before)
  return !!j && j.tail === '' && OPEN_VOWEL.has(j.vowel)
}

export const nnbPpunL = defineRule({
  id: 'nnb-ppun-l',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])뿐(?!더러)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!isL(prev)) return null
    const two = ctx.text.slice(Math.max(0, ctx.index - 1), ctx.index + 1)
    if (NOT_PPUN.has(two)) return null
    if (!PPUN_HEAD.has(prev) && !isEojil(ctx.before, prev)) return null
    // '할뿐·일뿐·했을뿐'은 nnb-ppun이 맡는다.
    if (prev === '할' || prev === '일') return null
    if (prev === '을' && /[았었했였]/.test(ctx.before)) return null
    if (!/[가-힣]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 뿐`],
      offset: 0,
      length: 2,
      message: "용언 뒤의 '뿐'은 의존명사라 띄어 씁니다.",
      explain:
        "관형사형 어미 '-ㄹ' 뒤의 '뿐'은 의존명사입니다. 체언 뒤('말뿐·너뿐')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '일정이 늦어질뿐만 아니라 준비도 부족합니다.', right: '일정이 늦어질 뿐만 아니라 준비도 부족합니다.' },
    { wrong: '그는 웃고 있을뿐이었다.', right: '그는 웃고 있을 뿐이었다.' },
    { wrong: '상황이 나빠질뿐이다.', right: '상황이 나빠질 뿐이다.' },
  ],
  counterExamples: [
    '그는 늘 말뿐이고 실천이 없다.',
    '이건 너뿐만 아니라 나한테도 중요해.',
    '가을뿐만 아니라 봄도 좋다.',
    '하늘뿐이었다.',
    '그 친구는 성실할뿐더러 손도 빠르다.',
    '저는 맡은 일을 했을 뿐입니다.',
    '본질뿐 아니라 형식도 중요하다.',
  ],
})

export const nnbJulN = defineRule({
  id: 'nnb-jul-n',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣])줄(을|도|은)?(\s*)(알|모르|몰)/g,
  resolve(ctx) {
    const [, prev = '', josa = '', gap = '', tail = ''] = ctx.match
    // ㄹ종성(할 줄·올 줄)은 nnb-jul이 맡는다. 여기서는 ㄴ종성만 본다.
    if (!isN(prev)) return null
    return {
      suggestions: [`${prev} 줄${josa}${gap || ' '}${tail}`],
      message: "의존명사 '줄'은 앞말과 띄어 씁니다.",
      explain: "사실·방법을 뜻하는 '줄'은 의존명사로 '알다/모르다'와 짝을 이룹니다. '바쁘신 줄 알지만'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '바쁘신줄 알지만 검토해 주십시오.', right: '바쁘신 줄 알지만 검토해 주십시오.' },
    { wrong: '그가 온줄 몰랐다.', right: '그가 온 줄 몰랐다.' },
  ],
  counterExamples: ['폭포에서 떨어지는 물줄기가 시원했다.', '한 줄 알고 갔더니 두 줄이었다.'],
})

export const nnbBaJosa = defineRule({
  id: 'nnb-ba-josa',
  category: 'spacing',
  confidence: 0.92,
  // nnb-ba가 보는 조사(를·이·가·에·와·도) 밖의 자리.
  pattern: /([가-힣])바(는|만|조차|까지)/g,
  resolve(ctx) {
    const [, prev = '', josa = ''] = ctx.match
    if (!isN(prev)) return null
    return {
      suggestions: [`${prev} 바${josa}`],
      offset: 0,
      length: 2 + josa.length,
      message: "의존명사 '바'는 앞말과 띄어 씁니다.",
      explain:
        "뒤에 조사가 붙었으므로 어미 '-ㄴ바'가 아니라 '앞에서 말한 내용'을 뜻하는 의존명사입니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '이러한 결과가 시사하는바는 크다.', right: '이러한 결과가 시사하는 바는 크다.' },
    { wrong: '제가 아는바만 말씀드리겠습니다.', right: '제가 아는 바만 말씀드리겠습니다.' },
  ],
  counterExamples: ['그는 사장인바 책임을 져야 한다.', '아르바이트를 구했다.'],
})

/** ㄹ받침 뒤의 `리`와 붙어 한 낱말이 되는 말. */
const NOT_RI = new Set(['일리', '실리', '물리', '별리', '절리', '활리', '열리', '골리', '갈리', '달리'])

export const nnbRiL = defineRule({
  id: 'nnb-ri-l',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])리(가|도)?(\s*)(없|있|만무)/g,
  resolve(ctx) {
    const [, prev = '', josa = '', gap = '', tail = ''] = ctx.match
    if (!isL(prev)) return null
    if (NOT_RI.has(prev + '리')) return null
    // 열거로 이미 잡는 자리(할·그럴·이럴·저럴·-았을)는 nnb-ri가 맡는다.
    if (prev === '할') return null
    if (prev === '을' && /[았었했였]/.test(ctx.before)) return null
    if (prev === '럴' && /[그이저]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 리${josa}${gap || ' '}${tail}`],
      message: "의존명사 '리'는 앞말과 띄어 씁니다.",
      explain: "'까닭·이치'를 뜻하는 '리(理)'는 의존명사입니다. 관형사형 어미 '-ㄹ' 뒤에서 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '건의해 봤는데 바뀔리가 없어 보임.', right: '건의해 봤는데 바뀔 리가 없어 보임.' },
    { wrong: '그 사람이 올리가 없다.', right: '그 사람이 올 리가 없다.' },
  ],
  counterExamples: ['네 말도 일리가 있다.', '실리가 없는 협상이었다.', '물리가 제일 어렵다.'],
})

/** `-등`으로 끝나는 한 낱말. */
const WORD_DEUNG = new Set([
  '평등', '차등', '균등', '고등', '초등', '중등', '대등', '동등', '열등', '우등', '무등', '상등', '하등',
  '계등', '남등', '갈등', '발등', '손등', '등등', '일등', '이등', '삼등', '특등', '불평등',
])

export const nnbDeungBare = defineRule({
  id: 'nnb-deung-bare',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣]{2,})등([을이과와의도만])/g,
  resolve(ctx) {
    const [, head = '', josa = ''] = ctx.match
    if (WORD_DEUNG.has(head.slice(-1) + '등') || WORD_DEUNG.has(head.slice(-2) + '등')) return null
    // 앞에 쉼표가 있는 자리는 nnb-deung이 맡는다.
    if (/[,·]/.test(ctx.text.slice(0, ctx.index))) return null
    return {
      suggestions: [`${head} 등${josa}`],
      message: "나열을 뜻하는 '등'은 의존명사라 띄어 씁니다.",
      explain: "'등(等)'은 의존명사입니다. '평등·고등·갈등'처럼 한 낱말의 일부인 '등'과는 다릅니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '자료 조사등을 누가 할지 정하지 못했습니다.', right: '자료 조사 등을 누가 할지 정하지 못했습니다.' },
  ],
  counterExamples: ['고등학교 3년 동안 반장을 맡았다.', '갈등이 깊어졌다.', '발등에 불이 떨어졌다.', '일등을 놓치지 않았다.'],
})

/** 진행 중임을 뜻하는 `중`을 붙여 쓴 명사. 화이트리스트로만 발화한다. */
const JUNG_HEADS = [
  '회의', '근무', '통화', '수업', '식사', '공사', '촬영', '운전', '사용', '검토', '휴가', '이동', '작업',
  '배송', '진행', '처리', '점검', '교육', '실험', '연구', '상담', '출장', '외출', '대기', '정비', '시험',
  '조사', '준비', '개발', '심사', '공부', '청소', '수리', '논의', '협의', '방송', '녹화', '편집', '발표',
  '면접', '제작', '모집', '판매', '수강', '대여', '공유', '운영', '확인', '검사', '수정', '보수', '임신',
  '재직', '수술', '회복', '시공', '설치', '충전',
]

export const nnbJungIp = defineRule({
  id: 'nnb-jung-ip',
  category: 'spacing',
  confidence: 0.93,
  // nnb-jung은 뒤 한 글자가 [이에의 공백 문장부호]일 때만 본다. 서술격이 이어지는 자리를 메운다.
  pattern: new RegExp(`(?<![가-힣])(${JUNG_HEADS.join('|')})중(?=[입인임])`, 'g'),
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    return {
      suggestions: [`${head} 중`],
      offset: 0,
      length: head.length + 1,
      message: "'진행 중'을 뜻하는 '중'은 의존명사라 띄어 씁니다.",
      explain: "'검토 중입니다·회의 중인 사람'처럼 띄어 씁니다. '부재중·한밤중·그중'만 한 낱말로 굳어 붙여 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '계약서는 법무팀에서 검토중입니다.', right: '계약서는 법무팀에서 검토 중입니다.' },
    { wrong: '지금 회의중인 사람은 나중에 연락 주세요.', right: '지금 회의 중인 사람은 나중에 연락 주세요.' },
  ],
  counterExamples: ['휴대폰에 부재중 전화가 세 통 찍혔다.', '중학교 때 배운 내용이다.', '집중임을 알 수 있다.'],
})

/** ㄴ·ㄹ받침 뒤의 `거`와 붙어 한 낱말이 되는 말. */
const WORD_GEO = new Set(['자전거', '인력거', '은거', '별거', '동거', '헌거', '삼륜거'])

export const nnbGeoBare = defineRule({
  id: 'nnb-geo-bare',
  category: 'spacing',
  confidence: 0.9,
  // nnb-geo·nnb-geo-attached는 뒤에 조사나 어미가 붙은 `거`만 본다. 홀로 선 `거`를 메운다.
  pattern: /([가-힣])거(?![가-힣])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!isNorL(prev)) return null
    const two = ctx.text.slice(Math.max(0, ctx.index - 1), ctx.index + 2)
    const three = ctx.text.slice(Math.max(0, ctx.index - 2), ctx.index + 2)
    if (WORD_GEO.has(two) || WORD_GEO.has(three)) return null
    if (!/[가-힣]/.test(ctx.before)) return null
    return {
      suggestions: [`${prev} 거`],
      offset: 0,
      length: 2,
      message: "의존명사 '거'는 앞말과 띄어 씁니다.",
      explain: "'거'는 '것'의 구어형 의존명사입니다. 관형사형 어미 뒤에서 언제나 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '미리 예약하고 가면 안 기다려도 되는거 아님?', right: '미리 예약하고 가면 안 기다려도 되는 거 아님?' },
    { wrong: '그렇게 하는거 맞아?', right: '그렇게 하는 거 맞아?' },
  ],
  counterExamples: [
    '동생 자전거 타는 법을 가르쳤다.',
    '별거 아니야.',
    '이건 네 거야.',
    '설거지를 하고 나왔다.',
    '먹을거리가 풍성하다.',
  ],
})

/** `것`과 붙어 한 단어가 된 말. */
const WORD_GEOT = new Set(['이것', '그것', '저것', '요것', '별것', '날것', '들것', '탈것', '헛것', '군것', '아무것', '온갖것'])

export const nnbGeotIda = defineRule({
  id: 'nnb-geot-ida',
  category: 'spacing',
  confidence: 0.93,
  // nnb-geot이 보는 조사(이·을·은·도·과·와·만) 밖의 자리 — 서술격 조사가 활용한 꼴.
  pattern: /([가-힣])것(입니다|입니까|인지|인가|인데|일지|일까|임)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!isNorL(prev)) return null
    const two = ctx.text.slice(Math.max(0, ctx.index - 1), ctx.index + 2)
    const three = ctx.text.slice(Math.max(0, ctx.index - 2), ctx.index + 2)
    if (WORD_GEOT.has(two) || WORD_GEOT.has(three)) return null
    return {
      suggestions: [`${prev} 것`],
      offset: 0,
      length: 2,
      message: "의존명사 '것'은 앞말과 띄어 씁니다.",
      explain: "'것'은 관형사형 어미 뒤의 의존명사입니다. 뒤에 붙은 '입니다·인지'는 서술격 조사라 그대로 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '필요한 항목만 추린것입니다.', right: '필요한 항목만 추린 것입니다.' },
    { wrong: '이게 맞는것인지 모르겠다.', right: '이게 맞는 것인지 모르겠다.' },
  ],
  counterExamples: ['이것인지 저것인지 모르겠다.', '별것인가 싶었다.', '날것임을 알았다.'],
})

export const josaBodaGeot = defineRule({
  id: 'josa-boda-geot',
  category: 'spacing',
  confidence: 0.9,
  // josa-boda는 앞말이 두 음절 이상일 때만 본다. 한 음절 의존명사 뒤를 메운다.
  pattern: /([가-힣])\s(것|거)\s+보다(?![가-힣])/g,
  resolve(ctx) {
    const [, prev = '', noun = ''] = ctx.match
    if (!isNorL(prev)) return null
    const after = ctx.index + ctx.match[0].length
    // 부사 '보다'(보다 나은)는 꾸밈 받는 말이 바로 뒤에 온다.
    if (/^\s*(?:나은|나아|더|많은|적은|빨리|높은|낮은|큰|작은)/.test(ctx.text.slice(after, after + 20))) return null
    return {
      suggestions: [`${noun}보다`],
      offset: 2,
      length: ctx.match[0].length - 2,
      message: "비교의 '보다'는 조사라 앞말에 붙여 씁니다.",
      explain:
        "'보다'가 비교 기준을 나타내면 부사격 조사입니다. 앞의 의존명사 '것'과는 띄어 쓴 것이 맞고, 조사만 붙이면 됩니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [{ wrong: '홍보를 늘리는 것 보다 자료를 쌓는 편이 낫다.', right: '홍보를 늘리는 것보다 자료를 쌓는 편이 낫다.' }],
  counterExamples: ['보다 나은 내일을 위하여.', '어젯밤엔 영화 보다 소파에서 그대로 잠들었다.'],
})

export const josaIdaNnb = defineRule({
  id: 'josa-ida-nnb',
  category: 'spacing',
  confidence: 0.93,
  pattern: /(뿐|따름|나름|터)\s+(이었|이다|이라|이며|이니|입니|이지|이야(?!기))/g,
  resolve(ctx) {
    const [, noun = '', tail = ''] = ctx.match
    return {
      suggestions: [`${noun}${tail}`],
      message: '서술격 조사는 앞말에 붙여 씁니다.',
      explain:
        "'이다'의 '이-'는 서술격 조사입니다. 의존명사는 앞말과 띄어 쓰지만, 그 뒤에 오는 조사는 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '사장님은 웃으실 뿐 이었다.', right: '사장님은 웃으실 뿐이었다.' },
    { wrong: '그것은 시작일 따름 이다.', right: '그것은 시작일 따름이다.' },
  ],
  counterExamples: ['그 뿐 아니라 나도 갔다.', '내 나름 이야기를 해 봤다.'],
})

/** 관형사 뒤의 의존명사. 문자열만 보고 갈아 끼워도 되는 자리다. */
export const nnbDeterminer = defineLexicon({
  id: 'nnb-determiner',
  category: 'spacing',
  confidence: 0.94,
  entries: [
    {
      wrong: '딴데',
      right: '딴 데',
      explain: "'딴'은 관형사, '데'는 '곳'을 뜻하는 의존명사입니다. 사전에 '딴데'라는 한 낱말은 없습니다.",
      refs: ['한글 맞춤법 제42항'],
      atWordStart: true,
      atWordEnd: false,
      examples: [{ wrong: '그 돈이면 딴데 가서 마시고 말지.', right: '그 돈이면 딴 데 가서 마시고 말지.' }],
      counterExamples: ['딴생각은 하지 마라.', '딴짓하다 혼났다.'],
    },
    {
      wrong: '어느것',
      right: '어느 것',
      explain: "'어느'는 관형사, '것'은 의존명사입니다.",
      refs: ['한글 맞춤법 제42항'],
      atWordStart: true,
      atWordEnd: false,
      examples: [{ wrong: '기록이 달라 어느것이 옳은지 판단하기 어려웠다.', right: '기록이 달라 어느 것이 옳은지 판단하기 어려웠다.' }],
    },
    {
      wrong: '어느쪽',
      right: '어느 쪽',
      explain: "'어느'는 관형사, '쪽'은 의존명사입니다.",
      refs: ['한글 맞춤법 제42항'],
      atWordStart: true,
      atWordEnd: false,
    },
    {
      wrong: '어느곳',
      right: '어느 곳',
      explain: "'어느'는 관형사, '곳'은 명사입니다.",
      refs: ['한글 맞춤법 제2항'],
      atWordStart: true,
      atWordEnd: false,
    },
    {
      wrong: '어느정도',
      right: '어느 정도',
      explain: "'어느'는 관형사입니다. '어느새·어느덧'만 한 낱말로 굳었습니다.",
      refs: ['한글 맞춤법 제2항'],
      atWordStart: true,
      atWordEnd: false,
    },
    {
      wrong: '여러것',
      right: '여러 것',
      explain: "'여러'는 관형사, '것'은 의존명사입니다.",
      refs: ['한글 맞춤법 제42항'],
      atWordStart: true,
      atWordEnd: false,
    },
    {
      wrong: '여러곳',
      right: '여러 곳',
      explain: "'여러'는 관형사, '곳'은 명사입니다.",
      refs: ['한글 맞춤법 제2항'],
      atWordStart: true,
      atWordEnd: false,
    },
  ],
})

/**
 * `다른데 가자 → 다른 데 가자`.
 *
 * `다른데`도 둘로 갈린다 — 관형사 `다른` + 의존명사 `데`(곳)와, 형용사 `다르다`의
 * 연결어미 `-ㄴ데`다.
 *
 *   다른데 가는 게 어때?   ← 곳. 띄어 쓴다
 *   성격은 다른데 잘 맞아   ← 어미. 붙여 쓴다
 *
 * [nnb-de-josa](#nnbDeJosa)는 뒤에 조사가 붙은 자리만(`다른데로·다른데를`) 잡고,
 * [nnb-de-predicate](#nnbDePredicate)는 관형사형 `-는/-ㄹ` 뒤만 본다. 조사 없이 선
 * `다른데`는 둘 다 놓친다. 그래서 **뒤따르는 용언**으로 가른다 — 장소를 요구하는
 * `가다·오다·들르다·찾다`가 이어지면 그 `데`는 곳이다.
 * 어미로 읽으면 `성격은 다른데 가는 게 어때?`가 되어 말이 이어지지 않는다.
 */
const DE_PLACE_VERB = /^\s+(?:가는|가자|가서|가고|가면|가려|갈|갔|가 |오는|오면|올|와서|왔|들르|둘러|찾아|찾을|알아보)/

export const nnbDeDareun = defineRule({
  id: 'nnb-de-dareun',
  category: 'spacing',
  confidence: 0.9,
  pattern: /(?<![가-힣])다른데(?=\s)/g,
  resolve(ctx) {
    if (!DE_PLACE_VERB.test(ctx.text.slice(ctx.index + 3))) return null
    return {
      suggestions: ['다른 데'],
      message: "'곳'을 뜻하는 의존명사 '데'는 앞말과 띄어 씁니다.",
      explain:
        "여기서 '데'는 '곳·장소'를 뜻하는 의존명사입니다. 형용사 '다르다'의 연결어미 '-ㄴ데'(성격은 다른데 잘 맞아)와 달리 앞말과 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '여기 말고 다른데 가는 게 어때?', right: '여기 말고 다른 데 가는 게 어때?' },
    { wrong: '오늘은 다른데 들르지 말고 바로 오자.', right: '오늘은 다른 데 들르지 말고 바로 오자.' },
  ],
  counterExamples: [
    '성격은 다른데 이상하게 잘 맞는다.',
    '값은 다른데 품질은 비슷하다.',
    '취향이 다른데 가끔은 통한다.',
    '생각은 다른데 결론은 같았다.',
  ],
})

export const nnbMoreRules: Rule[] = [
  nnbDeut,
  nnbDeJosa,
  nnbDePredicate,
  nnbDeDareun,
  nnbJeom,
  nnbMankeumAdnominal,
  nnbPpunL,
  nnbJulN,
  nnbBaJosa,
  nnbRiL,
  nnbDeungBare,
  nnbJungIp,
  nnbGeoBare,
  nnbGeotIda,
  josaBodaGeot,
  josaIdaNnb,
  nnbDeterminer,
]
