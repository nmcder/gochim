import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 의존명사 띄어쓰기.
 *
 * 한글 맞춤법 제42항 "의존 명사는 띄어 쓴다"는 짧지만, 문자열만 보고 적용하면
 * 재앙이 된다. 같은 글자가 조사(제41항, 붙여 씀)이기도 하기 때문이다.
 *
 *   할 만큼 했다   ← 의존명사 (띄움)
 *   너만큼 했다    ← 조사     (붙임)
 *
 * 둘을 가르는 건 앞말의 품사인데, 1층 규칙은 품사를 모른다.
 * 그래서 여기서는 **문자열만으로 앞말이 용언임이 확정되는 자리**로만 좁힌다.
 *  - `-았/었/했/였 + 을` 뒤  → 앞말은 반드시 용언
 *  - `-는 / -던` 뒤          → 명사가 이 음절로 끝나는 일이 사실상 없음
 *  - 뒤따르는 말로 재확인    → `수`는 뒤에 `있/없`, `줄`은 `알/모르`
 *
 * 이 조건을 못 만드는 갈래(`-ㄴ 지`, `-ㄹ 데`, `-을 만큼`)는 재현율을 포기하고
 * 형태소 분석 층(Phase 1)으로 넘긴다. 놓치는 건 회복 가능하지만
 * 맞는 문장에 밑줄을 그으면 사용자는 돌아오지 않는다.
 */

const hasL = (ch: string) => finalOf(ch) === 'ㄹ'
const hasNorL = (ch: string) => {
  const t = finalOf(ch)
  return t === 'ㄴ' || t === 'ㄹ'
}

/** ㄹ받침 음절 + `수`로 끝나는 명사들. `실수 없이`를 `실 수 없이`로 만들면 끝장이다. */
const NOUN_SU = new Set(['실수', '별수', '술수', '골수', '필수', '홀수', '살수', '묘수'])
/** 한 단어로 사전에 오른 `-것`. 관형사형처럼 ㄴ·ㄹ받침으로 끝나 걸려든다. */
const WORD_GEOT = new Set(['별것', '헌것', '날것', '들것', '탈것'])
/** `-적(的)` 파생 한자어. 뒤에 `있/없`이 와도 띄우면 안 된다. */
const NOUN_JEOK = new Set(['실적', '면적', '인적', '물적', '전적', '선적', '산적', '원적', '연적', '관적'])
/** 진행 중임을 뜻하는 `중`을 붙여 쓴 명사. 화이트리스트로만 발화한다. */
const JUNG_HEADS = [
  '회의', '근무', '통화', '수업', '식사', '공사', '촬영', '운전', '사용', '검토',
  '휴가', '이동', '작업', '배송', '진행', '처리', '점검', '교육', '실험', '연구',
  '상담', '출장', '외출', '대기', '정비', '시험', '조사', '준비', '개발', '심사',
]
export const nnbSu = defineRule({
  id: 'nnb-su',
  category: 'spacing',
  confidence: 0.96,
  // '수' 뒤에 보조사가 끼어들 수 있다 — '좋을 수만은 없다', '할 수도 있다'.
  pattern: /([가-힣])( ?)수((?:만은|만|도|가|는|밖에)?)( ?)(있|없)/g,
  resolve(ctx) {
    const [, prev = '', sp1 = '', josa = '', sp2 = '', tail = ''] = ctx.match
    if (sp1 && sp2) return null // 이미 올바름
    if (!hasL(prev)) return null
    if (NOUN_SU.has(prev + '수')) return null
    return {
      suggestions: [`${prev} 수${josa} ${tail}`],
      message: "의존명사 '수'는 앞말과 띄어 씁니다.",
      explain:
        "가능성·능력을 뜻하는 '수'는 의존명사입니다. 관형사형 어미 '-ㄹ' 뒤에서 띄어 쓰고, 뒤의 '있다/없다'도 별개의 용언이라 또 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '누구나 할수있는 동작이에요.', right: '누구나 할 수 있는 동작이에요.' },
    { wrong: '지금은 갈수 없어.', right: '지금은 갈 수 없어.' },
    { wrong: '항상 좋을수만은 없다.', right: '항상 좋을 수만은 없다.' },
  ],
  counterExamples: [
    '이번에는 큰 실수 없이 발표를 마쳤다.',
    '누구나 할 수 있는 동작이에요.',
    '리더십을 기를 수 있었습니다.',
    '보호자가 동행해야 검사를 받을 수 있다.',
  ],
})

export const nnbSuBakke = defineRule({
  id: 'nnb-su-bakke',
  category: 'spacing',
  confidence: 0.95,
  pattern: /([가-힣])수밖에/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!hasL(prev) || NOUN_SU.has(prev + '수')) return null
    return {
      suggestions: [`${prev} 수밖에`],
      message: "의존명사 '수'는 앞말과 띄어 씁니다. 뒤의 '밖에'는 조사라 붙여 씁니다.",
      explain: "'할 수밖에 없다'처럼 '수'는 띄우고 조사 '밖에'는 붙입니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '이렇게 된 이상 다시 할수밖에 없다.', right: '이렇게 된 이상 다시 할 수밖에 없다.' }],
  counterExamples: ['이렇게 된 이상 처음부터 다시 할 수밖에 없다.'],
})

export const nnbGeot = defineRule({
  id: 'nnb-geot',
  category: 'spacing',
  confidence: 0.94,
  pattern: /([가-힣])것([이을은도과와만])/g,
  resolve(ctx) {
    const [, prev = '', josaCh = ''] = ctx.match
    if (!hasNorL(prev)) return null
    if (WORD_GEOT.has(prev + '것')) return null
    return {
      suggestions: [`${prev} 것${josaCh}`],
      message: "의존명사 '것'은 앞말과 띄어 씁니다.",
      explain: "'것'은 관형사형 어미 '-ㄴ/-ㄹ' 뒤에 오는 의존명사입니다. ('이것·그것·날것'처럼 한 단어로 굳은 말은 예외)",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '동아리에서 배운것이 도움이 되었습니다.', right: '동아리에서 배운 것이 도움이 되었습니다.' }],
  counterExamples: ['이것보다 저것이 훨씬 마음에 든다.', '이 생선은 날것으로 먹어도 신선하다.'],
})

export const nnbGeo = defineRule({
  id: 'nnb-geo',
  category: 'spacing',
  confidence: 0.93,
  // '지'는 뺐다 — 설거지·거지처럼 명사 안에 들어 있어 '설 거지'를 만든다.
  pattern: /([가-힣])거(야|예요|에요|였|입니다|고|라고|니까|라도)(?![가-힣])/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (!hasL(prev) || prev === '별') return null
    return {
      suggestions: [`${prev} 거${tail}`],
      message: "의존명사 '거'는 앞말과 띄어 씁니다.",
      explain: "'거'는 '것'의 구어형 의존명사입니다. '만날 것이야 → 만날 거야'처럼 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '우리 내일 만날거야?', right: '우리 내일 만날 거야?' }],
  counterExamples: ['내가 이따가 다시 전화할게.', '그때 조금만 더 참을걸.', '이거야말로 진짜다.'],
})

export const nnbGeonde = defineRule({
  id: 'nnb-geonde',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])건(데|가|지)(?![가-힣])/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (!hasL(prev) || prev === '물') return null
    return {
      suggestions: [`${prev} 건${tail}`],
      message: "의존명사 '거'는 앞말과 띄어 씁니다.",
      explain: "'건'은 '것은'이 줄어든 말이라 앞말과 띄어 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '내일 할건데 괜찮아?', right: '내일 할 건데 괜찮아?' }],
  counterExamples: ['이건데 왜 못 찾아?'],
})

export const nnbMankeum = defineRule({
  id: 'nnb-mankeum',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣]*(?:는|던))만큼/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 만큼`],
      message: "용언 뒤의 '만큼'은 의존명사라 띄어 씁니다.",
      explain: "관형사형 어미 '-는/-던' 뒤의 '만큼'은 의존명사입니다. 체언 뒤('너만큼')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '노력하는만큼 결과가 나온다.', right: '노력하는 만큼 결과가 나온다.' }],
  counterExamples: ['나도 너만큼 열심히 준비했어.', '나는 너를 하늘만큼 땅만큼 좋아해.'],
})

export const nnbDaero = defineRule({
  id: 'nnb-daero',
  category: 'spacing',
  confidence: 0.93,
  pattern: /([가-힣]*(?:는|던))대로/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 대로`],
      message: "용언 뒤의 '대로'는 의존명사라 띄어 씁니다.",
      explain: "관형사형 어미 뒤의 '대로'는 의존명사입니다. 체언 뒤('규정대로')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '제가 아는대로 정리하겠습니다.', right: '제가 아는 대로 정리하겠습니다.' }],
  counterExamples: ['모든 절차는 규정대로 진행하겠습니다.', '무슨 일이 있었는지 사실대로 진술했습니다.'],
})

export const nnbPpun = defineRule({
  id: 'nnb-ppun',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣]*(?:[았었했였]을|할|일))뿐(?!더러)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 뿐`],
      message: "용언 뒤의 '뿐'은 의존명사라 띄어 씁니다.",
      explain: "관형사형 어미 '-ㄹ' 뒤의 '뿐'은 의존명사입니다. 체언 뒤('말뿐이다')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '저는 맡은 일을 했을뿐입니다.', right: '저는 맡은 일을 했을 뿐입니다.' }],
  counterExamples: ['그는 늘 말뿐이고 실천이 없다.', '이건 너뿐만 아니라 나한테도 중요해.', '그 친구는 성실할뿐더러 손도 빠르다.'],
})

export const nnbGyeom = defineRule({
  id: 'nnb-gyeom',
  category: 'spacing',
  confidence: 0.92,
  pattern: /([가-힣])겸(?=[\s해도에])/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!hasL(prev)) return null
    return {
      suggestions: [`${prev} 겸`],
      message: "의존명사 '겸'은 앞말과 띄어 씁니다.",
      explain: "두 가지 목적을 아우르는 '겸'은 의존명사입니다. '운동도 할 겸 자전거로 출근한다'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '운동도 할겸 해서 자전거로 출근해.', right: '운동도 할 겸 해서 자전거로 출근해.' }],
})

export const nnbManTime = defineRule({
  id: 'nnb-man-time',
  category: 'spacing',
  confidence: 0.94,
  pattern: /(\d+\s*(?:년|개월|달|주일|주|일|시간|분|초)|일주일|이틀|사흘|나흘|보름|하루)만에/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 만에`],
      message: "시간의 경과를 뜻하는 '만'은 의존명사라 띄어 씁니다.",
      explain: "'일주일 만에'의 '만'은 의존명사입니다. 한정을 뜻하는 '너만 와라'의 '만'은 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '그 책을 일주일만에 다 읽었다.', right: '그 책을 일주일 만에 다 읽었다.' }],
  counterExamples: ['정말 오랜만에 친구들을 만났다.', '너만 오면 바로 출발할게.', '그 도시의 인구는 백만에 이르렀다.'],
})

export const nnbRi = defineRule({
  id: 'nnb-ri',
  category: 'spacing',
  confidence: 0.94,
  pattern: /([았었했였]을|할|그럴|이럴|저럴)리(가|는|도)?(\s*)(없|있|만무)/g,
  resolve(ctx) {
    const [, prev = '', josaCh = '', gap = '', tail = ''] = ctx.match
    return {
      suggestions: [`${prev} 리${josaCh}${gap || ' '}${tail}`],
      message: "의존명사 '리'는 앞말과 띄어 씁니다.",
      explain: "'까닭·이치'를 뜻하는 '리(理)'는 의존명사입니다. '그럴 리가 없다'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '그런 말을 했을리가 없어요.', right: '그런 말을 했을 리가 없어요.' }],
  counterExamples: ['네 말도 일리가 있다.'],
})

export const nnbTende = defineRule({
  id: 'nnb-tende',
  category: 'spacing',
  confidence: 0.95,
  pattern: /([가-힣])(텐데|테니|테지)/g,
  resolve(ctx) {
    const [, prev = '', tail = ''] = ctx.match
    if (!hasL(prev)) return null
    return {
      suggestions: [`${prev} ${tail}`],
      message: "'텐데'는 의존명사 '터'가 든 말이라 띄어 씁니다.",
      explain: "'터인데'가 줄어든 말입니다. '할 터인데 → 할 텐데'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '우산을 챙겼으면 안 맞았을텐데.', right: '우산을 챙겼으면 안 맞았을 텐데.' }],
})

export const nnbBa = defineRule({
  id: 'nnb-ba',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])바([를이가에와도])/g,
  resolve(ctx) {
    const [, prev = '', josaCh = ''] = ctx.match
    if (finalOf(prev) !== 'ㄴ' && prev !== '는' && prev !== '던') return null
    return {
      suggestions: [`${prev} 바${josaCh}`],
      message: "의존명사 '바'는 앞말과 띄어 씁니다.",
      explain: "'앞에서 말한 내용 그 자체'를 뜻하는 '바'는 의존명사입니다. 조사가 붙는 자리이므로 어미 '-ㄴ바'와 구별됩니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '회의에서 논의된바를 정리했습니다.', right: '회의에서 논의된 바를 정리했습니다.' }],
})

export const nnbChae = defineRule({
  id: 'nnb-chae',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])채([로도])(?=[\s.,!?]|$)/g,
  resolve(ctx) {
    const [, prev = '', josaCh = ''] = ctx.match
    if (!hasNorL(prev)) return null
    return {
      suggestions: [`${prev} 채${josaCh}`],
      message: "의존명사 '채'는 앞말과 띄어 씁니다.",
      explain: "'이미 있는 상태 그대로'를 뜻하는 '채'는 의존명사입니다. '신발을 신은 채로'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '신발을 신은채로 들어오면 안 되지.', right: '신발을 신은 채로 들어오면 안 되지.' }],
  counterExamples: ['이번 행사 안내는 은채로부터 들었습니다.'],
})

export const nnbJul = defineRule({
  id: 'nnb-jul',
  category: 'spacing',
  confidence: 0.94,
  pattern: /([가-힣])줄(을|도)?(\s*)(알|모르|몰)/g,
  resolve(ctx) {
    const [, prev = '', josaCh = '', gap = '', tail = ''] = ctx.match
    if (!hasL(prev)) return null
    return {
      suggestions: [`${prev} 줄${josaCh}${gap || ' '}${tail}`],
      message: "의존명사 '줄'은 앞말과 띄어 씁니다.",
      explain: "방법·사실을 뜻하는 '줄'은 의존명사로 '알다/모르다'와 짝을 이룹니다. '수영을 할 줄 몰라요'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: '아직 수영을 할줄 몰라요.', right: '아직 수영을 할 줄 몰라요.' },
    { wrong: '이런 상황이 올줄 몰랐어.', right: '이런 상황이 올 줄 몰랐어.' },
  ],
  counterExamples: ['폭포에서 떨어지는 물줄기가 시원했다.'],
})

export const nnbTtaemun = defineRule({
  id: 'nnb-ttaemun',
  category: 'spacing',
  confidence: 0.96,
  pattern: /([가-힣])때문/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 때문`],
      message: "의존명사 '때문'은 앞말과 띄어 씁니다.",
      explain: "'때문'은 늘 앞말과 띄어 쓰는 의존명사입니다. '폭설 때문에', '비가 왔기 때문에'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '어제 내린 폭설때문에 늦었다.', right: '어제 내린 폭설 때문에 늦었다.' }],
})

export const nnbJung = defineRule({
  id: 'nnb-jung',
  category: 'spacing',
  confidence: 0.93,
  pattern: new RegExp(`(${JUNG_HEADS.join('|')})중(?=[이에의\\s.,!?]|$)`, 'g'),
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    return {
      suggestions: [`${prev} 중`],
      message: "'진행 중'을 뜻하는 '중'은 의존명사라 띄어 씁니다.",
      explain:
        "'회의 중, 근무 중'처럼 띄어 씁니다. 다만 '부재중·한밤중·그중'은 한 단어라 붙여 쓰므로, 이 규칙은 확인된 말에만 적용합니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '지금 회의중이라 전화를 받기 어렵습니다.', right: '지금 회의 중이라 전화를 받기 어렵습니다.' }],
  counterExamples: ['휴대폰에 부재중 전화가 세 통 찍혔다.', '회의 도중에 급한 연락이 왔다.'],
})

export const nnbJeok = defineRule({
  id: 'nnb-jeok',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])적(이|은|도)?(\s*)(있|없)/g,
  resolve(ctx) {
    const [, prev = '', josaCh = '', gap = '', tail = ''] = ctx.match
    if (!hasNorL(prev)) return null
    if (NOUN_JEOK.has(prev + '적')) return null
    return {
      suggestions: [`${prev} 적${josaCh}${gap || ' '}${tail}`],
      message: "'경험'을 뜻하는 의존명사 '적'은 앞말과 띄어 씁니다.",
      explain: "'만난 적이 없다'의 '적'은 의존명사입니다. 접미사 '-적(的)'이 붙은 '개인적·일반적'과는 다릅니다.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '그 사람을 직접 만난적이 없습니다.', right: '그 사람을 직접 만난 적이 없습니다.' }],
  counterExamples: ['이건 어디까지나 개인적인 의견입니다.', '올해는 실적이 없다.'],
})

/** 한 단어로 굳은 `-김`. 쇠뿔도 단김에 빼라. */
const WORD_GIM = new Set(['단김', '술김', '홧김', '얼김'])

export const nnbGim = defineRule({
  id: 'nnb-gim',
  category: 'spacing',
  confidence: 0.9,
  pattern: /([가-힣])김에/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    if (!hasNorL(prev)) return null
    // '단김에·술김에'는 한 단어로 굳은 말이다.
    if (WORD_GIM.has(prev + '김')) return null
    return {
      suggestions: [`${prev} 김에`],
      message: "의존명사 '김'은 앞말과 띄어 씁니다.",
      explain: "'어떤 일의 기회'를 뜻하는 '김'은 의존명사입니다. '우체국에 간 김에'.",
      refs: ['한글 맞춤법 제42항'],
    }
  },
  examples: [{ wrong: '우체국에 간김에 택배도 부치고 왔어.', right: '우체국에 간 김에 택배도 부치고 왔어.' }],
  counterExamples: ['쇠뿔도 단김에 빼라니까 지금 바로 시작하자.'],
})

export const spacingRules: Rule[] = [
  nnbSu,
  nnbSuBakke,
  nnbGeot,
  nnbGeo,
  nnbGeonde,
  nnbMankeum,
  nnbDaero,
  nnbPpun,
  nnbGyeom,
  nnbManTime,
  nnbRi,
  nnbTende,
  nnbBa,
  nnbChae,
  nnbJul,
  nnbTtaemun,
  nnbJung,
  nnbJeok,
  nnbGim,
]
