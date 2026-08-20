import { check, fix, groupWords } from '@gochim/core'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { createAnalyzer, type GochimAnalyzer } from '../src/index.js'

/**
 * 형태소 층 통합 테스트.
 *
 * 여기서 확인하려는 것은 두 가지다.
 *  1. 1층이 **포기했던** 갈래를 3층이 잡는가
 *  2. 1층이 예외 목록으로 겨우 막던 오탐을 3층도 막는가 (품사를 아니까 저절로)
 */

let analyzer: GochimAnalyzer

beforeAll(async () => {
  analyzer = await createAnalyzer()
}, 30_000)

afterAll(() => {
  analyzer?.destroy()
})

describe('분석기', () => {
  it('형태소와 품사를 돌려준다', () => {
    const morphemes = analyzer.analyze('할수있다')
    expect(morphemes.length).toBeGreaterThan(0)
    expect(morphemes.map((m) => m.pos)).toContain('NNB')
  })

  it('형태소의 start/end는 그 형태소가 속한 어절의 범위다', () => {
    const text = '할 수 있다'
    const words = groupWords(text, analyzer.analyze(text))
    expect(words.map((w) => w.text)).toEqual(['할', '수', '있다'])
  })

  it('빈 문자열에도 터지지 않는다', () => {
    expect(analyzer.analyze('')).toEqual([])
  })

  it('모델 정보를 알려준다', () => {
    const info = analyzer.info()
    expect(info.size).toBeGreaterThan(0)
  })
})

describe('3층이 새로 잡는 것 (1층에서는 포기한 갈래)', () => {
  const cases = [
    { wrong: '반찬은 네가 먹을만큼만 덜어서 가져가.', right: '반찬은 네가 먹을 만큼만 덜어서 가져가.' },
    { wrong: '이번 시험 문제는 생각 보다 훨씬 쉬웠다.', right: '이번 시험 문제는 생각보다 훨씬 쉬웠다.' },
    { wrong: '지금 회의중이라 못 받아.', right: '지금 회의 중이라 못 받아.' },
    { wrong: '우리 내일 만날거야?', right: '우리 내일 만날 거야?' },
    // '대로'가 조사냐 의존명사냐는 앞말의 품사가 정한다. 1층은 손대지 않는 자리다.
    { wrong: '결국 다 네 말 대로 되고 말았네.', right: '결국 다 네 말대로 되고 말았네.' },
  ]

  it.each(cases)('$wrong → $right', ({ wrong, right }) => {
    expect(fix(wrong, { analyzer })).toBe(right)
  })

  it('1층만으로는 못 잡던 것이 있다', () => {
    // 1층 규칙이 늘면서 위 목록의 문장 넷을 1층이 따라잡았다. 그건 좋은 일이다.
    // 다만 이 describe가 무엇을 증명하는지는 흐려지므로, **1층이 아직 못 잡는 것이
    // 목록에 하나라도 남아 있는지**를 직접 확인한다.
    //
    // '대로'가 조사냐 의존명사냐는 앞말의 품사가 정한다 — 체언 뒤면 붙이고(말대로)
    // 관형사형 뒤면 띄운다(들은 대로). 문자열만으로는 갈리지 않아 1층은 손대지 않는다.
    const onlyMorph = cases.filter(({ wrong }) => check(wrong).length === 0)
    expect(onlyMorph.length, '1층이 전부 따라잡았다면 이 목록을 새로 짜야 한다').toBeGreaterThan(0)
  })
})

describe('3층에서도 건드리면 안 되는 문장', () => {
  const clean = [
    '이번에는 큰 실수 없이 발표를 마쳤다.',
    '이것보다 저것이 훨씬 마음에 든다.',
    '이 생선은 날것으로 먹어도 신선하다.',
    '올해는 실적이 없다.',
    '네 말도 일리가 있다.',
    '휴대폰에 부재중 전화가 세 통 찍혔다.',
    '그 밖에 다른 방법은 없어 보인다.',
    '나는 너를 하늘만큼 땅만큼 좋아해.',
    '내가 이따가 다시 전화할게.',
    '밥을 먹는데 갑자기 전화가 왔다.',
    '노력하는 만큼 결과가 나온다.',
    '저는 맡은 일을 했을 뿐입니다.',
  ]

  it.each(clean)('%s', (sentence) => {
    expect(check(sentence, { analyzer })).toEqual([])
  })
})

describe('형태소 규칙의 선언된 예시', () => {
  it('examples는 전부 잡고 counterExamples는 전부 건드리지 않는다', async () => {
    const { allMorphRules } = await import('@gochim/core')
    for (const rule of allMorphRules) {
      for (const example of rule.examples) {
        expect(fix(example.wrong, { analyzer }), `${rule.id}: ${example.wrong}`).toBe(example.right)
      }
      for (const counterExample of rule.counterExamples ?? []) {
        expect(
          check(counterExample, { analyzer, morphRules: [rule], rules: [] }),
          `${rule.id}: ${counterExample}`,
        ).toEqual([])
      }
    }
  })
})

describe('한 번 고친 결과는 더 고칠 것이 없다', () => {
  it.each([
    '반찬은 네가 먹을만큼만 덜어서 가져가.',
    '지금 회의중이라 못 받아.',
    '누구나 할수있는 일이야.',
    '나도 너 만큼 잘할 수 있어.',
  ])('%s', (sentence) => {
    const once = fix(sentence, { analyzer })
    expect(fix(once, { analyzer })).toBe(once)
  })
})
