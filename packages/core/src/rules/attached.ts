import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 붙여 써야 하는데 띄어 쓴 것들.
 *
 * 의존명사 규칙([spacing.ts](./spacing.ts))의 정확한 반대 방향이다.
 * 어미와 조사는 앞말에 붙는다 — `-ㄹ지`, `-ㄹ수록`, `-뿐만`, `-까지`.
 *
 * 여기서도 판별의 어려움은 같다. `만큼·대로·뿐`은 앞말이 용언이면 띄고 체언이면 붙는다.
 * 그래서 **앞 음절 종성이 ㄴ·ㄹ이면 손대지 않는다** — 관형사형 어미일 가능성이 있기 때문이다.
 * `내일 까지`(→내일까지)처럼 ㄹ받침 체언에서 놓치는 것은 감수한다.
 */

const isNorL = (ch: string) => {
  const t = finalOf(ch)
  return t === 'ㄴ' || t === 'ㄹ'
}

/** 언제나 조사인 것들. 체언·조사 뒤에만 오므로 종성 가드가 필요 없다. */
const ALWAYS_JOSA = ['커녕', '처럼', '조차', '마저', '부터', '까지']
/** 용언 뒤에서는 의존명사가 되는 것들. 앞 음절 종성이 ㄴ·ㄹ이면 건드리지 않는다. */
const AMBIGUOUS_JOSA = ['뿐만', '뿐이', '만큼', '대로']
/** 어절이 이 조사로 끝나면 그 위에 조사를 하나 더 붙일 수 없다. */
const ENDS_WITH_JOSA = /(?:이나|나|이라도|라도|은|는|이|가|을|를|도|만|과|와|에서|에게|으로|로|의|에)$/

export const josaSpaced = defineRule({
  id: 'josa-spaced',
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`([가-힣]) (${[...ALWAYS_JOSA, ...AMBIGUOUS_JOSA].join('|')})`, 'g'),
  resolve(ctx) {
    const [, prev = '', josaText = ''] = ctx.match
    // ㄴ·ㄹ 종성이면 관형사형 어미일 수 있다 — 그 경우 띄어 쓰는 게 맞다.
    if (AMBIGUOUS_JOSA.includes(josaText) && isNorL(prev)) return null

    // `마저`는 조사이기도 하고 부사이기도 하다 — `너마저`(조사) / `일이나 마저 하자`(부사).
    // 체언에 조사가 이미 붙어 있으면 그 위에 조사를 하나 더 붙일 수 없으므로,
    // 앞 어절이 조사로 끝나면 뒤의 `마저`는 부사다.
    if (josaText === '마저') {
      const word = /(?:^|[^가-힣])([가-힣]+)$/.exec(ctx.text.slice(0, ctx.index + 1))?.[1] ?? ''
      if (ENDS_WITH_JOSA.test(word)) return null
    }
    return {
      suggestions: [`${prev}${josaText}`],
      message: `조사 '${josaText}'는 앞말에 붙여 씁니다.`,
      explain: "조사는 앞말에 붙여 씁니다. 같은 글자라도 용언 뒤에서는 의존명사가 되어 띄어 씁니다(할 만큼 / 너만큼).",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '너 뿐만 아니라 우리 모두가 같은 마음이야.', right: '너뿐만 아니라 우리 모두가 같은 마음이야.' },
    { wrong: '미안하다는 말은 커녕 눈길조차 주지 않았다.', right: '미안하다는 말은커녕 눈길조차 주지 않았다.' },
    { wrong: '우리 반에서 그 친구 만큼 성실한 사람은 없다.', right: '우리 반에서 그 친구만큼 성실한 사람은 없다.' },
  ],
  counterExamples: [
    '노력하는 만큼 결과가 나온다.',
    '제가 아는 대로 정리하겠습니다.',
    '저는 맡은 일을 했을 뿐입니다.',
    '이렇게 된 이상 다시 할 수밖에 없다.',
  ],
})

/**
 * `밖에`는 따로 다룬다.
 *
 * 조사 `밖에`(오직 그것뿐)와 명사 `밖`+조사 `에`(바깥)가 문자열로 같다.
 *
 *   나밖에 없더라      ← 조사 (붙임)
 *   울타리 밖에 아무것도 ← 명사 (띄움)
 *
 * 조사 `밖에`는 **반드시 부정 표현과 호응**한다는 성질을 가드로 쓴다.
 * 바로 다음 어절이 부정어가 아니면 손대지 않는다.
 */
export const josaBakke = defineRule({
  id: 'josa-bakke',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣]) 밖에(?=\s*(?:없|모르|못|안 ))/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    // '그/이/저 밖에'는 관형사 + 명사 '밖'이다.
    if ('그이저' .includes(prev)) return null
    return {
      suggestions: [`${prev}밖에`],
      message: "조사 '밖에'는 앞말에 붙여 씁니다.",
      explain:
        "'오직 그것뿐'을 뜻하는 '밖에'는 조사라 붙여 씁니다. 바깥을 뜻하는 명사 '밖'과는 다릅니다(울타리 밖에 있다).",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [{ wrong: '이 일을 맡을 사람은 나 밖에 없더라.', right: '이 일을 맡을 사람은 나밖에 없더라.' }],
  counterExamples: [
    '그 밖에 다른 방법은 없어 보인다.',
    '울타리 밖에 아무것도 남아 있지 않았다.',
    '나 밖에 있으니까 도착하면 전화해.',
  ],
})

/** `-ㄹ지`는 어미다. `할 지` → `할지` */
export const eomiLji = defineRule({
  id: 'eomi-lji',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣]) 지([도요])?(?=[\s.,?!]|$)/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (finalOf(prev) !== 'ㄹ') return null
    return {
      suggestions: [`${prev}지${tail}`],
      message: "추측·의문을 나타내는 '-ㄹ지'는 어미라 붙여 씁니다.",
      explain:
        "'-ㄹ지'는 하나의 어미입니다. 시간의 경과를 뜻하는 의존명사 '지'(먹은 지 한 달)와 달리 앞말에 붙습니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '이걸 어떻게 설명해야 할 지 막막하네요.', right: '이걸 어떻게 설명해야 할지 막막하네요.' }],
  counterExamples: ['밥을 먹은 지 한참 지났다.', '내일 비가 올지 안 올지 모르겠다.'],
})

/** `-ㄹ뿐더러`, `-ㄹ수록`도 어미다. */
export const eomiAttached = defineRule({
  id: 'eomi-attached',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣]) (뿐더러|수록)/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (finalOf(prev) !== 'ㄹ') return null
    return {
      suggestions: [`${prev}${tail}`],
      message: `'-ㄹ${tail}'는 어미라 붙여 씁니다.`,
      explain: "어미는 어간에 붙여 씁니다. 의존명사 '뿐'(했을 뿐)과 달리 '-ㄹ뿐더러'는 통째로 하나의 어미입니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '그 친구는 성실할 뿐더러 손도 빠르다.', right: '그 친구는 성실할뿐더러 손도 빠르다.' },
    { wrong: '이 노래는 들으면 들을 수록 더 좋아진다.', right: '이 노래는 들으면 들을수록 더 좋아진다.' },
  ],
  counterExamples: ['저는 맡은 일을 했을 뿐입니다.'],
})

/**
 * 인용격 조사 `라고·이라고·라는·이라는`.
 *
 * 남의 말을 옮길 때 쓰는 조사라 앞말에 붙는다. 그런데 인용한 말이 문장처럼 길다 보니
 * 거기서 한 번 끊고 싶어져서 `조심할게 라고 카톡을 보냈다`처럼 띄어 쓰는 일이 잦다.
 *
 * 이 자리는 다른 조사보다 오히려 안전하다. `라고`로 시작하는 말 자체가 거의 없기 때문이다.
 * 뒤에 한글이 더 붙는 경우(라고스 같은 지명)만 빼면 띄어 쓴 `라고`는 사실상 전부 조사다.
 *
 * 따옴표로 닫은 인용도 같이 받는다 — `"미안해" 라고` → `"미안해"라고`.
 *
 * 앞 글자를 매치에 넣지 않는 것이 중요하다. `조심할께 라고`에서는 `께→게`도 같이 틀렸는데,
 * 두 진단의 구간이 겹치면 엔진이 확신도가 높은 하나만 남긴다. 공백부터 매치를 시작하면
 * 두 오류가 각자 자기 자리를 차지해 둘 다 살아남는다.
 */
const QUOTE_END = /[가-힣0-9\p{Ll}\p{Lu}"'”’」』\]）)]/u

export const josaRago = defineRule({
  id: 'josa-rago',
  category: 'spacing',
  confidence: 0.92,
  pattern: /(?<=\S)[ \t]+(이라고|라고|이라는|라는)(?![가-힣])/g,
  resolve(ctx) {
    const [, josaText = ''] = ctx.match
    const prev = ctx.text[ctx.index - 1] ?? ''
    if (!QUOTE_END.test(prev)) return null
    // `이라고·이라는`의 `이-`는 받침 있는 말 뒤에만 붙는다. 받침이 없으면 원래 `라고`가 맞다.
    if (josaText.startsWith('이') && /[가-힣]/.test(prev) && finalOf(prev) === '') return null
    return {
      suggestions: [josaText],
      message: `인용격 조사 '${josaText}'는 앞말에 붙여 씁니다.`,
      explain: "'라고·이라고'는 남의 말을 옮길 때 쓰는 조사입니다. 조사는 앞말에 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '다음부터는 조심할게 라고 카톡을 보냈다.', right: '다음부터는 조심할게라고 카톡을 보냈다.' },
    { wrong: '친구가 나도 미안해 라고 답장을 보내왔다.', right: '친구가 나도 미안해라고 답장을 보내왔다.' },
    { wrong: '그는 끝까지 모르겠다 라는 말만 했다.', right: '그는 끝까지 모르겠다라는 말만 했다.' },
  ],
  counterExamples: [
    '조금만 기다리라고 했잖아.',
    '이건 사과라고 부른다.',
    '나이지리아의 라고스는 큰 도시다.',
    '무슨 소리냐고 되물었다.',
  ],
})

export const attachedRules: Rule[] = [josaSpaced, josaBakke, eomiLji, eomiAttached, josaRago]
