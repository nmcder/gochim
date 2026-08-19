import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 실제 글에서 압도적으로 많이 나오는 띄어쓰기.
 *
 * 골든 테스트셋은 오류 유형마다 문장을 하나씩 만든 것이라 유형별 빈도를 반영하지 않는다.
 * 사람이 쓴 일기 한 편(1,455자)의 오류 63건을 전수 조사해 보니 **56건이 띄어쓰기**였고,
 * 그중 다수가 `~하는 것 같다`처럼 **조사가 붙지 않은 의존명사**였다.
 * 기존 `nnb-geot`은 `것` 뒤에 조사를 요구해서 이 형태를 통째로 놓쳤다.
 *
 * 여기서는 조사에 기대지 않고 **앞말이 관형사형인가**로 판정한다.
 *
 * ## 관형사형 어미 판정
 *
 * 의존명사 앞에는 관형사형 어미 `-ㄴ/-은/-는/-던` 또는 `-ㄹ/-을`이 온다.
 * 문자열에서는 **앞 음절의 종성이 ㄴ이냐 ㄹ이냐**로 갈린다.
 *
 * 이 구별이 중요한 이유는 `게·걸·건`이 어미이기도 하기 때문이다.
 *
 *   되는게 → 되는 게   (`는` = ㄴ종성, 의존명사 '게')
 *   내가 할게          (`할` = ㄹ종성, 어미 '-ㄹ게' — 붙여 쓴다)
 *   참을걸 그랬다      (`을` = ㄹ종성, 어미 '-ㄹ걸' — 붙여 쓴다)
 *
 * 그래서 `게·걸·건`은 **ㄴ종성 뒤에서만** 의존명사로 본다. ㄹ종성 뒤는 건드리지 않는다.
 * `것·거`는 어미로 쓰이는 일이 없어 양쪽 다 잡는다.
 */

/** 관형사형 어미 `-ㄴ/-은/-는/-던`으로 끝나는가. */
function endsAdnominalN(syllable: string): boolean {
  return finalOf(syllable) === 'ㄴ'
}

/** 관형사형 어미 `-ㄹ/-을`로 끝나는가. */
function endsAdnominalL(syllable: string): boolean {
  return finalOf(syllable) === 'ㄹ'
}

/** `것`과 붙어 한 단어가 된 말. 가르면 안 된다. */
const WORD_GEOT = new Set(['이것', '그것', '저것', '요것', '별것', '날것', '들것', '탈것', '헛것', '군것', '아무것', '온갖것'])
/** `건`으로 끝나는 한 낱말. 의존명사 '건'(것은)과 문자열이 겹친다. */
const WORD_GEON = new Set(['안건', '사건', '여건', '조건', '요건', '용건', '문건', '물건', '인건'])

export const nnbGeotBare = defineRule({
  id: 'nnb-geot-bare',
  category: 'spacing',
  confidence: 0.93,
  // 조사가 붙지 않은 '것'. `~하는 것 같다`가 실제 글에서 가장 흔한 형태다.
  // '거'는 빠져 있다. 자전거·물레방아처럼 명사 안에 흔히 들어 있어
  // 조사 없이 판정하면 '자전 거'를 만든다. 조사가 붙은 '거'는 nnb-geo가 맡는다.
  pattern: /([가-힣])(것|게|건|걸)(?![가-힣])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    const noun = ctx.match[2] ?? ''
    const whole = prev + noun

    if (WORD_GEOT.has(whole) || WORD_GEON.has(whole)) return null
    // 두 글자 앞까지 보아 '아무것·온갖것'처럼 긴 한 단어도 막는다.
    const prev2 = ctx.text.slice(Math.max(0, ctx.index - 2), ctx.index + 1 + noun.length)
    if (WORD_GEOT.has(prev2) || WORD_GEON.has(prev2)) return null

    const isN = endsAdnominalN(prev)
    const isL = endsAdnominalL(prev)
    if (!isN && !isL) return null

    // `게·걸·건`은 ㄹ 뒤에서 어미다 — 할게, 참을걸, 하건. 건드리면 안 된다.
    if (isL && noun !== '것') return null

    // 어미 `-는걸/-은걸`(감탄)은 문장을 끝맺는다. 뒤에 말이 더 이어질 때만 의존명사로 본다.
    if (noun === '걸' && !/^\s+[가-힣]/.test(ctx.text.slice(ctx.index + whole.length))) return null

    return {
      suggestions: [`${prev} ${noun}`],
      message: `의존명사 '${noun}'은 앞말과 띄어 씁니다.`,
      explain:
        noun === '것' || noun === '거'
          ? "'것'은 의존명사입니다. 관형사형 어미 뒤에서 언제나 띄어 씁니다."
          : `'${noun}'은 '것${noun === '게' ? '이' : noun === '건' ? '은' : '을'}'이 줄어든 말입니다. 의존명사이므로 띄어 씁니다.`,
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '나는 하는것 같다.', right: '나는 하는 것 같다.' },
    { wrong: '조금씩 진정이 되는것 같았다.', right: '조금씩 진정이 되는 것 같았다.' },
    { wrong: '사람 관계라는게 늘 좋을 수는 없다.', right: '사람 관계라는 게 늘 좋을 수는 없다.' },
    { wrong: '이야기할 수 있었던건 잘된 일이다.', right: '이야기할 수 있었던 건 잘된 일이다.' },
    { wrong: '또 만나기로 한걸 보니 다행이다.', right: '또 만나기로 한 걸 보니 다행이다.' },
  ],
  counterExamples: [
    '내가 먼저 할게.',
    '그때 참을걸 그랬다.',
    '이건 네 거야.',
    '동생에게 자전거 타는 법을 가르쳤다.',
    '오늘 안건을 정리했다.',
    '그 사건 이후로 조심한다.',
    '이것도 저것도 다 필요해.',
    '별것 아닌 일로 다퉜다.',
    '날것으로 먹으면 배탈이 난다.',
    '오늘은 날씨가 좋은걸.',
    '하건 말건 네 마음이다.',
  ],
})

/** `때`와 붙어 한 단어가 된 말. */
const WORD_TTAE = new Set(['그때', '이때', '저때', '한때', '접때'])

export const nnbTtae = defineRule({
  id: 'nnb-ttae',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣])때(?![가-힣])|([가-힣])때(?=[가-힣])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ctx.match[2] ?? ''
    if (WORD_TTAE.has(prev + '때')) return null
    if (!endsAdnominalN(prev) && !endsAdnominalL(prev)) return null
    return {
      suggestions: [`${prev} 때`],
      message: "의존명사 '때'는 앞말과 띄어 씁니다.",
      explain: "'때'는 의존명사입니다. '그때·이때·한때'만 한 단어로 굳어 붙여 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '글을 쓸때마다 맞춤법이 헷갈린다.', right: '글을 쓸 때마다 맞춤법이 헷갈린다.' },
    { wrong: '헷갈릴때가 많다.', right: '헷갈릴 때가 많다.' },
  ],
  counterExamples: ['그때는 몰랐다.', '이때다 싶었다.', '한때 유행하던 노래다.'],
})

/**
 * `않-`은 `아니하-`의 준말 어간이라 반드시 어미가 붙는다.
 * 어미가 아닌 것이 뒤에 오면 그것은 부정 부사 `안`을 잘못 적은 것이다.
 */
const ANH_ENDINGS = new Set([
  '고', '는', '은', '을', '아', '어', '으', '지', '게', '도', '기', '던',
  '다', '니', '네', '았', '겠', '더', '냐', '소', '습', '사', '을', '음', '자', '나', '데', '군', '구',
])

export const anhVsAn = defineRule({
  id: 'anh-vs-an',
  category: 'confusable',
  confidence: 0.94,
  pattern: /않([가-힣])/g,
  resolve(ctx) {
    const next = ctx.match[1] ?? ''
    // 어미가 이어지면 '않-'이 맞다. 그 밖에는 부사 '안'이어야 한다.
    if (ANH_ENDINGS.has(next)) return null
    return {
      suggestions: [`안 ${next}`],
      message: "부정의 부사는 '안'입니다.",
      explain:
        "'않-'은 '아니하-'가 줄어든 용언 어간이라 뒤에 어미가 붙어야 합니다('좋지 않다'). 용언을 직접 부정할 때는 부사 '안'을 쓰고 띄어 씁니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '분위기가 더 않좋아진 것 같았다.', right: '분위기가 더 안 좋아진 것 같았다.' },
    { wrong: '내 말을 잘 않들어준다고 했다.', right: '내 말을 잘 안 들어준다고 했다.' },
    { wrong: '기분이 정말 않좋았는데.', right: '기분이 정말 안 좋았는데.' },
  ],
  counterExamples: [
    '별로 좋지 않다.',
    '그렇게 하지 않고 다르게 했다.',
    '오지 않았다.',
    '먹지 않는다.',
    '괜찮지 않네.',
    '가지 않겠다.',
  ],
})

/** `잘못` 뒤에 오면 두 단어인 용언. `잘못하다·잘못되다`는 한 단어라 뺀다. */
const JALMOT_VERBS = '알|알고|알아|알았|생각|판단|쓰|써|썼|보|봤|들|듣|이해|계산|기억|짚|짚었|고르|골랐|건드'

export const busaJalmot = defineRule({
  id: 'busa-jalmot',
  category: 'spacing',
  confidence: 0.92,
  pattern: new RegExp(`(?<![가-힣])잘못(${JALMOT_VERBS})`, 'g'),
  resolve(ctx) {
    const verb = ctx.match[1] ?? ''
    return {
      suggestions: [`잘못 ${verb}`],
      message: "부사 '잘못'은 뒤 말과 띄어 씁니다.",
      explain: "한 단어로 사전에 오른 것은 '잘못하다·잘못되다'뿐입니다. '잘못 알다·잘못 쓰다'는 부사가 용언을 꾸미는 두 단어입니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '내가 시간을 잘못알고 있었다.', right: '내가 시간을 잘못 알고 있었다.' },
    { wrong: '가끔씩 잘못쓰고 넘어간다.', right: '가끔씩 잘못 쓰고 넘어간다.' },
  ],
  counterExamples: ['내가 잘못했다.', '일이 잘못되었다.', '잘못을 인정했다.'],
})

/**
 * 보조용언 `보다`.
 *
 * `-아/-어` 뒤의 보조용언은 붙여 쓰는 것도 허용되지만(제47항),
 * `-다(가) 보다`와 `-ㄹ까 보다`는 그 허용 범위 밖이라 반드시 띄어 쓴다.
 */
export const bojoBoda = defineRule({
  id: 'bojo-boda',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])(다보|까봐|까보)(?=[니면자았])|([가-힣])까봐(?![가-힣])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ctx.match[3] ?? ''
    const middle = ctx.match[2] ?? '까봐'
    const head = middle.slice(0, 1)
    const boda = middle.slice(1)
    return {
      suggestions: [`${prev}${head} ${boda}`],
      message: "보조용언 '보다'는 앞말과 띄어 씁니다.",
      explain:
        "'-아/-어' 뒤의 보조용언은 붙여 쓸 수도 있지만, '-다 보니·-ㄹ까 봐'는 그 허용 범위 밖이라 반드시 띄어 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '빨리 쓰다보면 자꾸 틀린다.', right: '빨리 쓰다 보면 자꾸 틀린다.' },
    { wrong: '이야기를 하다보니 불만이 나왔다.', right: '이야기를 하다 보니 불만이 나왔다.' },
    { wrong: '변명처럼 들릴까봐 아무 말도 안 했다.', right: '변명처럼 들릴까 봐 아무 말도 안 했다.' },
  ],
  counterExamples: ['경주 다보탑을 보았다.', '해 보니 알겠더라.'],
})

/** `-기로 하다`의 `하다`는 보조용언이 아니라 본용언이라 반드시 띄어 쓴다. */
export const giroHada = defineRule({
  id: 'giro-hada',
  category: 'spacing',
  confidence: 0.93,
  pattern: /기로(하|했|하고|하기)(?![가-힣])|기로(하)(?=[고기었])/g,
  resolve(ctx) {
    const tail = ctx.match[1] ?? ctx.match[2] ?? ''
    return {
      suggestions: [`기로 ${tail}`],
      message: "'-기로 하다'의 '하다'는 띄어 씁니다.",
      explain: "'-기로 하다'의 '하다'는 보조용언이 아니라 별개의 본용언입니다. 붙여쓰기 허용 규정이 적용되지 않습니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [{ wrong: '서로 양보를 하기로하고 헤어졌다.', right: '서로 양보를 하기로 하고 헤어졌다.' }],
  counterExamples: ['그러기로 했다.'],
})

/** 관형사 뒤의 명사. `이런 식·아무 말·이런 일`처럼 한 단어가 아닌 것들. */
const DETERMINERS = '이런|그런|저런|어떤|무슨|아무|여러|온갖|별의별'
const AFTER_DET = '식|말|일|것들|생각|사람|때문'

export const gwanhyeongsaNoun = defineRule({
  id: 'gwanhyeongsa-noun',
  category: 'spacing',
  confidence: 0.92,
  pattern: new RegExp(`(?<![가-힣])(${DETERMINERS})(${AFTER_DET})(?![가-힣])|(?<![가-힣])(${DETERMINERS})(${AFTER_DET})(?=[이가은는을를도만에으로])`, 'g'),
  resolve(ctx) {
    const det = ctx.match[1] ?? ctx.match[3] ?? ''
    const noun = ctx.match[2] ?? ctx.match[4] ?? ''
    return {
      suggestions: [`${det} ${noun}`],
      message: '관형사는 뒤 말과 띄어 씁니다.',
      explain: `'${det}'은 관형사, '${noun}'은 명사로 서로 다른 단어입니다. 한 단어로 사전에 오르지 않았으므로 띄어 씁니다.`,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '너는 맨날 이런식으로 약속을 어긴다.', right: '너는 맨날 이런 식으로 약속을 어긴다.' },
    { wrong: '아무말도 안 하고 가만히 있었다.', right: '아무 말도 안 하고 가만히 있었다.' },
    { wrong: '이런일이 없도록 하겠다.', right: '이런 일이 없도록 하겠다.' },
  ],
  counterExamples: ['아무것도 모른다.', '이런저런 이야기를 했다.'],
})


/** 수관형사. 단위 명사와 띄어 쓴다. */
const NUMERALS = '한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무'
/** 수관형사 뒤에 오면 띄어 쓰는 단위 명사. */
// '대·판·채·줄'은 뺐다 — 세대(世代)·열대·한판·한줄처럼 한 낱말을 이루는 일이 잦다.
const COUNTERS = '시간|분|초|살|명|개|권|장|마리|가지|잔|병|그릇|송이|켤레|벌|달|해'

export const numeralCounter = defineRule({
  id: 'numeral-counter',
  category: 'spacing',
  confidence: 0.92,
  pattern: new RegExp(`(?<![가-힣])(${NUMERALS})(${COUNTERS})(?![가-힣])|(?<![가-힣])(${NUMERALS})(${COUNTERS})(?=[이가은는을를도만에])`, 'g'),
  resolve(ctx) {
    const numeral = ctx.match[1] ?? ctx.match[3] ?? ''
    const counter = ctx.match[2] ?? ctx.match[4] ?? ''
    return {
      suggestions: [`${numeral} ${counter}`],
      message: '단위 명사는 수관형사와 띄어 씁니다.',
      explain:
        "단위를 나타내는 명사는 앞말과 띄어 씁니다. 붙여 쓸 수 있는 것은 순서를 나타내거나 아라비아 숫자와 어울릴 때뿐입니다(제43항 다만).",
      refs: ['한글 맞춤법 제43항'],
    }
  },
  examples: [
    { wrong: '약속 시간보다 한시간이나 늦었다.', right: '약속 시간보다 한 시간이나 늦었다.' },
    { wrong: '사과 세개를 샀다.', right: '사과 세 개를 샀다.' },
  ],
  counterExamples: ['한번 해 보자.', '두말할 것 없다.', '세상에 그런 일이.', '세대 간 대화가 필요하다.', '열대 지방의 기후.'],
})

/** `동안` 앞에 올 수 있는 시간 표현. `그동안·한동안·오랫동안`은 한 단어라 뺀다. */
export const donganNoun = defineRule({
  id: 'dongan-noun',
  category: 'spacing',
  confidence: 0.92,
  pattern: /(?<![가-힣])(한참|잠깐|잠시|얼마|평생|사흘|이틀|보름|한참)동안/g,
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    return {
      suggestions: [`${head} 동안`],
      message: "'동안'은 앞말과 띄어 씁니다.",
      explain: "'동안'은 자립 명사입니다. '그동안·한동안·오랫동안'만 한 단어로 굳어 붙여 씁니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [{ wrong: '한참동안 얘기를 나눴다.', right: '한참 동안 얘기를 나눴다.' }],
  counterExamples: ['그동안 잘 지냈니?', '한동안 소식이 없었다.', '오랫동안 기다렸다.'],
})

/** `-어야겠다`는 한 덩어리다. 사이를 띄우면 안 된다. */
export const yagetda = defineRule({
  id: 'yagetda',
  category: 'ending',
  confidence: 0.93,
  pattern: /([가-힣])야\s+(겠[가-힣]*)/g,
  resolve(ctx) {
    const stem = ctx.match[1] ?? ''
    const tail = ctx.match[2] ?? ''
    return {
      suggestions: [`${stem}야${tail}`],
      message: '어미는 앞말에 붙여 씁니다.',
      explain: "'-어야겠다'는 어미 '-어야'와 '-겠-'이 이어진 한 덩어리입니다. 어미는 언제나 앞말에 붙여 씁니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [{ wrong: '더 귀 기울여 들어야 겠다고 생각했다.', right: '더 귀 기울여 들어야겠다고 생각했다.' }],
})

/** 비교의 `보다`는 부사격 조사라 앞말에 붙여 쓴다. */
export const josaBoda = defineRule({
  id: 'josa-boda',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣]{2,})\s+보다(?=\s|[,.]|$)/g,
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length, ctx.index + ctx.match[0].length + 18)
    // 부사 '보다'(보다 나은)는 꾸밈 받는 말이 바로 뒤에 온다.
    if (/^\s*(?:나은|나아|더|많은|적은|빨리|높은|낮은|큰|작은)/.test(rest)) return null
    // 조사 '보다'는 비교 서술이 뒤따른다. 그 신호가 없으면 동사 '보다'일 수 있다 — '영화 보다 잠들었다'.
    if (!/더|훨씬|덜|늦|빠르|빨리|크|작|많|적|낫|나은|먼저|잘|위|아래|앞|뒤/.test(rest)) return null
    return {
      suggestions: [`${head}보다`],
      message: "비교의 '보다'는 조사라 앞말에 붙여 씁니다.",
      explain: "'보다'가 비교 기준을 나타내면 부사격 조사입니다. 조사는 앞말에 붙여 씁니다. ('보다 나은'의 '보다'는 부사라 띄어 씁니다)",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [{ wrong: '약속시간 보다 한 시간이나 늦었다.', right: '약속시간보다 한 시간이나 늦었다.' }],
  counterExamples: ['보다 나은 내일을 위하여.', '생각보다 쉬웠다.', '어젯밤엔 영화 보다 소파에서 그대로 잠들었다.'],
})

/**
 * 부정 부사 `안` + 용언.
 *
 * `안`은 명사이기도 하고(`안에`, `안으로`) 수많은 한자어의 첫 음절이기도 하다
 * (`안전·안내·안건·안정`). 그래서 뒤따르는 말이 **용언임이 문자열로 확실할 때만** 띄운다.
 */
const AN_VERBS =
  '지키|지켰|지킨|보이|보였|보인|좋아|좋았|좋은|맞|받|들어|먹|자|씻|입|신|읽|사|팔|열|닫|믿|웃|울|가|오|주|쓰|보내|만나|바뀌|바꾸|늦|이르'

export const busaAn = defineRule({
  id: 'busa-an',
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])안(${AN_VERBS})(?=[가-힣])`, 'g'),
  resolve(ctx) {
    const verb = ctx.match[1] ?? ''
    // '안전·안내'처럼 한자어 첫 음절인 경우를 막는다. 뒤가 용언 활용형이어야 한다.
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length)
    if (!/^[가-힣]/.test(rest)) return null
    if (/^(?:전|내|건|정|경|심|부|성|과)/.test(verb)) return null
    return {
      suggestions: [`안 ${verb}`],
      message: "부정의 부사 '안'은 뒤 말과 띄어 씁니다.",
      explain: "'안'은 '아니'의 준말인 부사입니다. 사전에 한 단어로 오른 '안되다·안쓰럽다'가 아닌 한 언제나 띄어 씁니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '약속 시간도 안지키고 연락도 안 한다.', right: '약속 시간도 안 지키고 연락도 안 한다.' },
    { wrong: '이야기가 끝날 기미가 안보였다.', right: '이야기가 끝날 기미가 안 보였다.' },
  ],
  counterExamples: [
    '국가 안보를 논의했다.',
    '안전을 최우선으로 한다.',
    '오늘 안건을 정리했다.',
    '집 안에서 기다렸다.',
    '그 일은 잘 안됐다.',
  ],
})


/** 부사끼리, 또는 부사와 용언이 붙어 버린 자리. */
const ADVERB_PAIRS = [
  { wrong: '잘안하', right: '잘 안 하', note: "'잘하다'는 한 단어지만 부정 부사 '안'이 끼면 '잘 안 하다'로 세 토막이 된다." },
  { wrong: '잘안해', right: '잘 안 해', note: "'잘 안 해'로 세 토막으로 띄어 쓴다." },
  { wrong: '잘안했', right: '잘 안 했', note: "'잘 안 했'으로 세 토막으로 띄어 쓴다." },
  { wrong: '잘안', right: '잘 안', note: "'잘'과 '안'은 각각의 부사이므로 띄어 쓴다." },
  { wrong: '많이나', right: '많이 나', note: "'많이'는 부사이므로 뒤 용언과 띄어 쓴다." },
  { wrong: '더잘', right: '더 잘', note: '부사가 겹쳐 놓일 때도 각각 띄어 쓴다.' },
  { wrong: '못알', right: '못 알', note: "부정 부사 '못'은 뒤 용언과 띄어 쓴다." },
]

export const adverbPair = defineRule({
  id: 'adverb-pair',
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])(${ADVERB_PAIRS.map((e) => e.wrong).join('|')})(?=[가-힣])`, 'g'),
  resolve(ctx) {
    const entry = ADVERB_PAIRS.find((e) => e.wrong === ctx.match[1])
    if (!entry) return null
    return {
      suggestions: [entry.right],
      subId: entry.wrong,
      message: '부사는 뒤 말과 띄어 씁니다.',
      explain: entry.note,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '연락도 잘안하면서 뭐라고 한다.', right: '연락도 잘 안 하면서 뭐라고 한다.' },
    { wrong: '화가 많이나있어서 말을 못 걸었다.', right: '화가 많이 나있어서 말을 못 걸었다.' },
  ],
  counterExamples: ['잘 안 보인다.', '많이 나아졌다.'],
})

/** 관형어 뒤의 `말`. `할 말·자기 말·무슨 말`은 두 단어다. */
const MAL_HEADS = '할|한|하는|자기|무슨|그런|이런|저런|어떤|남의|헛|빈'

export const malSpacing = defineRule({
  id: 'mal-spacing',
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])(${MAL_HEADS})말(?=[을이은는도만과에]|\\s|[.,!?]|$)`, 'g'),
  resolve(ctx) {
    const head = ctx.match[1] ?? ''
    // '헛말·빈말'은 사전에 오른 한 단어다.
    if (head === '헛' || head === '빈') return null
    return {
      suggestions: [`${head} 말`],
      message: "'말'은 명사라 앞의 관형어와 띄어 씁니다.",
      explain: "'할 말·자기 말'은 관형어와 명사가 이어진 두 단어입니다. 한 단어로 사전에 오르지 않았습니다.",
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '나도 할말은 있었지만 참았다.', right: '나도 할 말은 있었지만 참았다.' },
    { wrong: '서로 자기말이 맞다고 생각한다.', right: '서로 자기 말이 맞다고 생각한다.' },
  ],
  counterExamples: ['그건 빈말이 아니었다.', '헛말이라도 고맙다.'],
})

export const proseSpacingRules: Rule[] = [
  nnbGeotBare,
  nnbTtae,
  anhVsAn,
  busaJalmot,
  bojoBoda,
  giroHada,
  gwanhyeongsaNoun,
  numeralCounter,
  donganNoun,
  yagetda,
  josaBoda,
  busaAn,
  adverbPair,
  malSpacing,
]
