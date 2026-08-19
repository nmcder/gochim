import { adaptJosa } from '../hangul.js'
import { insideQuotes } from '../protect.js'
import { defineRule } from './define.js'
import type { Example, Rule } from '../types.js'

/**
 * 겹말 — 같은 뜻을 두 번 쓴 자리.
 *
 * `재발(再發)`의 `재`가 이미 '다시'인데 앞에 `다시`를 또 붙이는 식이다.
 * 맞춤법이 틀린 건 아니어서 분류를 따로 두고 **경고**로 표시한다.
 * 글쓴이가 강조하려고 일부러 쓸 수도 있으므로, 고칠지는 사람이 정한다.
 *
 * 모든 규칙에 공통으로 걸린 조건이 하나 있다 — **두 말이 붙어 있을 때만**이다.
 * 문장 안에 두 낱말이 같이 있다는 것만으로 발화하면
 * "다시 시도했지만 문제가 재발했다"처럼 `다시`가 다른 서술어를 꾸미는 정상 문장을 잡는다.
 */

interface Pleonasm {
  id: string
  /** 겹치는 부분을 포함한 전체 패턴. 첫 번째 그룹이 남길 부분이다(없으면 `keep`를 쓴다). */
  pattern: RegExp
  /** 그룹이 없을 때 남길 문자열. */
  keep?: string
  explain: string
  examples: Example[]
  counterExamples?: string[]
  /** 추가 조건. */
  when?: (before: string) => boolean
  /** 지워지는 말에 조사가 붙어 있을 때, 그 말을 적어 두면 조사를 남는 말에 맞게 고친다. */
  josaFrom?: string
  /** 매치 바로 뒤가 이 꼴이면 발화하지 않는다. */
  denyAfter?: RegExp
}

const ENTRIES: Pleonasm[] = [
  {
    id: 'dasi-jaebal',
    pattern: /다시\s+(재발)(?=[하되한된했됐])/g,
    explain: "'재발(再發)'의 '재'가 이미 '다시'라는 뜻입니다.",
    examples: [{ wrong: '같은 문제가 다시 재발하지 않도록 대책을 세웠다.', right: '같은 문제가 재발하지 않도록 대책을 세웠다.' }],
    counterExamples: ['다시 시도했지만 같은 문제가 재발했다.'],
  },
  {
    id: 'sajeone-miri',
    // '국어사전에'처럼 다른 낱말의 일부일 때는 건드리지 않는다.
    pattern: /(?<![가-힣])사전에\s+미리/g,
    keep: '미리',
    // '종이 사전에', '국어 사전에'의 '사전'은 辭典이다. 앞 어절을 보고 걸러낸다.
    when: (before) => !/(국어|영한|한영|종이|전자|의학|백과|용어|한자)\s*$/.test(before),
    // '미리보기'는 한 낱말(명사)이라 부사 '미리'가 아니다.
    denyAfter: /^보기/,
    explain: "'사전(事前)'이 이미 '미리'라는 뜻입니다.",
    examples: [{ wrong: '사전에 미리 신청서를 제출해야 한다.', right: '미리 신청서를 제출해야 한다.' }],
    counterExamples: [
      '국어사전에 미리 찾아본 낱말이 나온다.',
      '모르는 단어는 종이 사전에 미리 표시해 둔다.',
      '새 공지는 사전에 미리보기로 오류를 점검한다.',
    ],
  },
  {
    id: 'nameun-yeosaeng',
    pattern: /남은\s+(여생)/g,
    explain: "'여생(餘生)'이 이미 '남은 삶'이라는 뜻입니다.",
    examples: [{ wrong: '할아버지는 남은 여생을 고향에서 보내셨다.', right: '할아버지는 여생을 고향에서 보내셨다.' }],
  },
  {
    id: 'ajik-mijeong',
    // '미정'은 사람 이름이기도 하다. 뒤에 서술격 조사가 붙는 자리로만 좁힌다.
    pattern: /아직\s+(미정)(?=이라|이래|이다|이었|이야|입니)/g,
    when: (before) => !/미정\s*(씨|님)/.test(before),
    explain: "'미정(未定)'이 이미 '아직 정하지 않음'이라는 뜻입니다.",
    examples: [
      { wrong: '다음 회의 날짜는 아직 미정이라고 들었습니다.', right: '다음 회의 날짜는 미정이라고 들었습니다.' },
    ],
    counterExamples: ['아직 미정 씨한테는 말하지 않았다.', '아직 미정이가 오지 않아 회의를 시작하지 못했다.'],
  },
  {
    id: 'gati-donghaeng',
    pattern: /같이\s+(동행)(?=[하해했])/g,
    // '어머니와 같이 동행해'처럼 공동격 조사가 앞에 있으면 '같이'가 그쪽을 꾸민다.
    when: (before) => !/[와과랑]\s*$|하고\s*$/.test(before),
    explain: "'동행(同行)'의 '동'이 이미 '함께'라는 뜻입니다.",
    examples: [
      { wrong: '미성년자는 보호자가 같이 동행해야 합니다.', right: '미성년자는 보호자가 동행해야 합니다.' },
    ],
    counterExamples: ['어머니와 같이 동행해 검사를 받았다.'],
  },
  {
    id: 'geodeup-banbok',
    pattern: /거듭\s+(반복)(?=[하되됐된했])/g,
    explain: "'반복(反復)'이 이미 '되풀이함'이라는 뜻입니다.",
    examples: [{ wrong: '같은 질문이 회의마다 거듭 반복됐다.', right: '같은 질문이 회의마다 반복됐다.' }],
  },
  {
    id: 'dasi-jaegae',
    pattern: /다시\s+(재개)(?=[하되될됐된])/g,
    explain: "'재개(再開)'의 '재'가 이미 '다시'라는 뜻입니다.",
    examples: [{ wrong: '공사가 다음 달부터 다시 재개될 예정이다.', right: '공사가 다음 달부터 재개될 예정이다.' }],
    counterExamples: ['한 번 멈췄던 공사가 재개된 뒤 다시 멈췄다.'],
  },
  {
    id: 'gyesok-sokchul',
    pattern: /계속\s+(속출)(?=[하되한된했됐])/g,
    explain: "'속출(續出)'이 이미 '잇따라 나옴'이라는 뜻입니다.",
    examples: [{ wrong: '피해 사례가 계속 속출하고 있다.', right: '피해 사례가 속출하고 있다.' }],
  },
  {
    id: 'hamkke-dongcham',
    pattern: /함께\s+(동참)(?=[하해했])/g,
    // '친구와 함께 동참했다'처럼 공동격 조사가 앞에 있으면 '함께'가 그쪽을 꾸민다.
    when: (before) => !/[와과랑]\s*$|하고\s*$/.test(before),
    explain: "'동참(同參)'의 '동'이 이미 '함께'라는 뜻입니다.",
    examples: [{ wrong: '많은 시민이 함께 동참해 주셨습니다.', right: '많은 시민이 동참해 주셨습니다.' }],
    counterExamples: ['친구와 함께 동참했습니다.'],
  },
  {
    id: 'gwabansu-isang',
    pattern: /(과반수)\s+이상/g,
    // 조사가 '이상'에 붙어 있다. '과반수 이상이 → 과반수가'처럼 조사까지 고쳐야 한다.
    josaFrom: '이상',
    explain: "'과반수(過半數)'가 이미 '절반이 넘는 수'라는 뜻입니다. ('반수 이상'은 맞는 표현입니다)",
    examples: [{ wrong: '참석자 과반수 이상이 찬성했다.', right: '참석자 과반수가 찬성했다.' }],
    counterExamples: ['참석자 반수 이상이 찬성했다.'],
  },
  {
    id: 'seuseuro-jagak',
    pattern: /스스로\s+(자각)(?=[하되한된했])/g,
    explain: "'자각(自覺)'의 '자'가 이미 '스스로'라는 뜻입니다.",
    examples: [{ wrong: '문제를 스스로 자각하는 것이 시작이다.', right: '문제를 자각하는 것이 시작이다.' }],
  },
  {
    id: 'yeokjeon-ap',
    pattern: /(역전)앞/g,
    explain: "'역전(驛前)'의 '전'이 이미 '앞'이라는 뜻입니다.",
    examples: [{ wrong: '역전앞에서 만나기로 했다.', right: '역전에서 만나기로 했다.' }],
    counterExamples: ['역전을 앞두고 분위기가 달라졌다.'],
  },
  {
    id: 'gajang-choeseon',
    pattern: /가장\s+(최선|최고|최적|최우선|최상)/g,
    explain: "'최(最)'가 이미 '가장'이라는 뜻입니다.",
    examples: [{ wrong: '이게 지금 가장 최선인 방법이다.', right: '이게 지금 최선인 방법이다.' }],
    counterExamples: ['이번 달 최저 기온을 기록했다.'],
  },
  {
    id: 'geuttae-dangsi',
    pattern: /그때\s+(당시)/g,
    explain: "'당시(當時)'가 이미 '그때'라는 뜻입니다.",
    examples: [{ wrong: '그때 당시에는 아무도 몰랐다.', right: '당시에는 아무도 몰랐다.' }],
    counterExamples: ['판결문에는 "그때 당시에는 상황을 알지 못했다"라는 진술이 인용되어 있다.'],
  },
  {
    id: 'seoro-sangchung',
    pattern: /서로\s+(상충)(?=[하되해했])/g,
    explain: "'상충(相衝)'의 '상'이 이미 '서로'라는 뜻입니다.",
    examples: [{ wrong: '두 조건이 서로 상충해 보인다.', right: '두 조건이 상충해 보인다.' }],
  },
  {
    id: 'saero-sinseol',
    pattern: /새로\s+(신설)(?=[하되된한했])/g,
    explain: "'신설(新設)'의 '신'이 이미 '새로'라는 뜻입니다.",
    examples: [{ wrong: '새로 신설된 학과에 지원했다.', right: '신설된 학과에 지원했다.' }],
  },
  {
    id: 'meonjeo-seonhaeng',
    pattern: /먼저\s+(선행)(?=[하되된한했])/g,
    explain: "'선행(先行)'의 '선'이 이미 '먼저'라는 뜻입니다.",
    examples: [{ wrong: '기초 공사가 먼저 선행되어야 한다.', right: '기초 공사가 선행되어야 한다.' }],
    counterExamples: ['먼저 선행을 베푸는 사람이 되고 싶다.'],
  },
]

export const redundancyRules: Rule[] = ENTRIES.map((entry) =>
  defineRule({
    id: `pleonasm-${entry.id}`,
    category: 'redundancy',
    severity: 'warning',
    confidence: 0.9,
    pattern: entry.pattern,
    resolve(ctx) {
      // 겹말은 문체 제안이다. 남이 한 말을 인용한 자리에서는 고치라고 하지 않는다.
      if (insideQuotes(ctx.text, ctx.index)) return null
      if (entry.when && !entry.when(ctx.text.slice(Math.max(0, ctx.index - 12), ctx.index))) return null
      const keep = entry.keep ?? ctx.match[1]
      if (!keep) return null
      if (entry.denyAfter?.test(ctx.text.slice(ctx.index + ctx.match[0].length))) return null

      // 지워지는 말에 조사가 붙어 있으면 남는 말에 맞게 고친다. '과반수 이상이 → 과반수가'
      const rest = ctx.text.slice(ctx.index + ctx.match[0].length)
      const adapted = entry.josaFrom ? adaptJosa(entry.josaFrom, keep, rest) : null

      return {
        suggestions: [adapted ? keep + adapted.josa : keep],
        ...(adapted ? { length: ctx.match[0].length + adapted.consumed } : {}),
        message: '같은 뜻이 두 번 쓰였습니다.',
        explain: entry.explain,
      }
    },
    examples: entry.examples,
    ...(entry.counterExamples ? { counterExamples: entry.counterExamples } : {}),
  }),
)
