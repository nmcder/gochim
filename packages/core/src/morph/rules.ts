import type { MorphFinding, MorphRule, MorphRuleContext, Word } from '../types.js'
import { morphemeOffset } from './words.js'

/**
 * 품사 기반 띄어쓰기 규칙 (3층).
 *
 * 1층 규칙이 받침과 뒤따르는 말로 힘겹게 근사하던 판정이, 품사를 알면 그냥 풀린다.
 *
 *   할수있다   → 수/NNB 가 앞말과 같은 어절 안에 있다      → 띄어야 한다
 *   실수 없이  → 실수/NNG 한 덩어리                          → 건드리지 않는다
 *   너 만큼    → 만큼/JKB 가 홀로 어절을 이룬다              → 붙여야 한다
 *   그 밖에    → 밖/NNG + 에/JKB                             → 건드리지 않는다
 *   나 밖에    → 밖에/JX                                     → 붙여야 한다
 *
 * 1층에서 예외 목록으로 막아야 했던 `실수·별것·부재중·일리`가 여기서는 저절로 걸러진다.
 */

/** 조사 계열 태그. J로 시작하면 전부 조사다. */
const isJosa = (pos: string) => pos.startsWith('J')

/** 동사·부사로도 쓰여 분석기가 자주 헷갈리는 말. 붙이면 뜻이 바뀌므로 손대지 않는다. */
const RISKY_JOSA = new Set(['같이', '만치'])

/**
 * `보다`는 셋으로 갈린다 — 조사(생각보다), 부사(보다 나은), 동사(영화 보다 잠들었다).
 * 조사일 때는 비교의 정도를 나타내는 부사가 뒤따른다는 성질만 믿는다.
 */
const DEGREE_ADVERBS = ['훨씬', '더', '덜', '조금', '한참', '많이', '적게', '빨리', '늦게', '일찍', '크게', '작게']
const BODA_OK = new RegExp(`^\\s*(?:${DEGREE_ADVERBS.join('|')})[\\s가-힣]`)

/** 어절 안에서 형태소가 실제로 몇 글자를 차지하는지 모르므로, 붙은 의존명사는 뒤까지 통째로 옮긴다. */
function splitFinding(word: Word, at: number, nnb: string): MorphFinding | null {
  // 어절 범위에는 뒤따르는 문장부호가 딸려 온다. 밑줄은 글자에만 긋는다.
  const trimmed = word.text.replace(/[\s.,!?…"')\]}]+$/, '')
  if (at <= 0 || at >= trimmed.length) return null
  const head = trimmed.slice(0, at)
  const tail = trimmed.slice(at)
  return {
    start: word.start,
    end: word.start + trimmed.length,
    suggestions: [`${head} ${tail}`],
    message: `의존명사 '${nnb}'는 앞말과 띄어 씁니다.`,
    explain:
      '형태소 분석 결과 이 자리의 말이 의존명사로 쓰였습니다. 의존명사는 앞말과 띄어 씁니다. (같은 글자라도 조사로 쓰이면 붙여 씁니다)',
    refs: ['한글 맞춤법 제42항'],
  }
}

export const morphNnbSpacing: MorphRule = {
  id: 'morph-nnb-spacing',
  category: 'spacing',
  severity: 'error',
  confidence: 0.93,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []
    for (const word of ctx.words) {
      if (word.morphemes.length < 2) continue
      // 어절의 첫 형태소가 의존명사면 이미 띄어 쓴 것이다.
      const index = word.morphemes.findIndex((m, i) => i > 0 && m.pos === 'NNB')
      if (index === -1) continue

      // 수 + 단위명사는 붙여 쓸 수 있다 — `10년`, `90점`, `3개`. (제43항 다만)
      if (word.morphemes[index - 1]?.pos === 'SN' || /^\d/.test(word.text)) continue

      const at = morphemeOffset(word, index)
      if (at == null) continue

      const finding = splitFinding(word, at, word.morphemes[index]!.text)
      if (finding) found.push(finding)
    }
    return found
  },
  examples: [
    { wrong: '누구나 할수있는 일이야.', right: '누구나 할 수 있는 일이야.' },
    { wrong: '동아리에서 배운것이 도움이 되었다.', right: '동아리에서 배운 것이 도움이 되었다.' },
    { wrong: '지금 회의중이라 못 받아.', right: '지금 회의 중이라 못 받아.' },
    { wrong: '우리 내일 만날거야?', right: '우리 내일 만날 거야?' },
  ],
  counterExamples: [
    '10년 만에 만난 친구가 하나도 안 변했더라.',
    '장학금을 받으려면 평균이 90점은 돼야 한다.',
    '이번에는 큰 실수 없이 발표를 마쳤다.',
    '이것보다 저것이 훨씬 마음에 든다.',
    '이 생선은 날것으로 먹어도 신선하다.',
    '올해는 실적이 없다.',
    '네 말도 일리가 있다.',
    '휴대폰에 부재중 전화가 세 통 찍혔다.',
  ],
}

export const morphJosaAttach: MorphRule = {
  id: 'morph-josa-attach',
  category: 'spacing',
  severity: 'error',
  confidence: 0.92,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []
    for (let i = 1; i < ctx.words.length; i += 1) {
      const word = ctx.words[i]!
      const prev = ctx.words[i - 1]!
      // 어절 전체가 조사로만 이루어졌다면 앞말에 붙어야 한다.
      if (word.morphemes.length === 0 || !word.morphemes.every((m) => isJosa(m.pos))) continue
      // 사이에 공백만 있어야 한다 (줄바꿈이나 문장부호가 끼면 다른 이야기다).
      const between = ctx.text.slice(prev.end, word.start)
      if (between !== ' ') continue

      // 한 글자 어절은 분석기가 수관형사('두', '서')를 조사로 잘못 보는 일이 잦다.
      if (word.text.length < 2) continue
      if (RISKY_JOSA.has(word.text)) continue
      // '보다'는 뒤에 정도부사가 올 때만 비교의 조사다.
      if (word.text === '보다' && !BODA_OK.test(ctx.text.slice(word.end))) continue
      // 조사 '밖에'는 반드시 부정 표현과 호응한다. 아니면 바깥을 뜻하는 명사 '밖'이다.
      if (word.text === '밖에' && !/^\s*(없|모르|못|안[\s가-힣])/.test(ctx.text.slice(word.end))) continue

      found.push({
        start: prev.start,
        end: word.end,
        suggestions: [`${prev.text}${word.text}`],
        message: `조사 '${word.text}'는 앞말에 붙여 씁니다.`,
        explain: '형태소 분석 결과 이 말이 조사로 쓰였습니다. 조사는 앞말에 붙여 씁니다.',
        refs: ['한글 맞춤법 제41항'],
      })
    }
    return found
  },
  examples: [
    { wrong: '나도 너 만큼 잘할 수 있어.', right: '나도 너만큼 잘할 수 있어.' },
    { wrong: '이 일을 맡을 사람은 나 밖에 없더라.', right: '이 일을 맡을 사람은 나밖에 없더라.' },
  ],
  counterExamples: [
    '그 밖에 다른 방법은 없어 보인다.',
    '노력하는 만큼 결과가 나온다.',
    '창문 밖에 눈이 소복하게 쌓였다.',
    '어젯밤엔 영화 보다 소파에서 그대로 잠들었다.',
    '회사는 고객에게 보다 나은 서비스를 제공하겠다고 밝혔다.',
    '이것은 쌀 두 되요, 저것은 팥 서 되다.',
  ],
}

export const allMorphRules: MorphRule[] = [morphNnbSpacing, morphJosaAttach]
