import { describe, expect, it } from 'vitest'
import { groupWords, morphemeOffset } from '../src/morph/words.js'
import type { Morpheme } from '../src/types.js'

/**
 * 어절 묶기와 자모 정렬은 형태소 층 전체가 딛고 선 계산이다.
 * 분석기 없이도 검증할 수 있도록 형태소를 손으로 만들어 넣는다.
 */

const morpheme = (text: string, pos: string, start: number, end: number): Morpheme => ({ text, pos, start, end })

describe('groupWords', () => {
  it('같은 어절 범위를 가진 형태소들을 하나로 묶는다', () => {
    const text = '할 수 있다'
    const words = groupWords(text, [
      morpheme('하', 'VV', 0, 1),
      morpheme('ㄹ', 'ETM', 0, 1),
      morpheme('수', 'NNB', 2, 3),
      morpheme('있', 'VA', 4, 6),
      morpheme('다', 'EF', 4, 6),
    ])
    expect(words.map((w) => w.text)).toEqual(['할', '수', '있다'])
    expect(words.map((w) => w.morphemes.length)).toEqual([2, 1, 2])
  })

  it('붙어 있는 어절은 형태소가 여럿인 한 덩어리가 된다', () => {
    const words = groupWords('할수있다', [
      morpheme('하', 'VV', 0, 4),
      morpheme('ㄹ', 'ETM', 0, 4),
      morpheme('수', 'NNB', 0, 4),
      morpheme('있', 'VX', 0, 4),
      morpheme('다', 'EF', 0, 4),
    ])
    expect(words.length).toBe(1)
    expect(words[0]!.morphemes.length).toBe(5)
  })

  it('빈 입력에도 터지지 않는다', () => {
    expect(groupWords('', [])).toEqual([])
  })
})

describe('morphemeOffset — 자모 정렬', () => {
  const word = (text: string, morphemes: [string, string][]) => ({
    start: 0,
    end: text.length,
    text,
    morphemes: morphemes.map(([t, p]) => morpheme(t, p, 0, text.length)),
  })

  it('받침으로 녹아든 형태소를 지나쳐 위치를 찾는다', () => {
    // '할' = 하 + ㄹ. 'ㄹ'은 글자를 차지하지 않으므로 '수'는 1번 글자에서 시작한다.
    const w = word('할수있다', [
      ['하', 'VV'],
      ['ㄹ', 'ETM'],
      ['수', 'NNB'],
      ['있', 'VX'],
      ['다', 'EF'],
    ])
    expect(morphemeOffset(w, 2)).toBe(1)
  })

  it('표면형이 형태소와 달라도 앞부분만 맞으면 위치를 찾는다', () => {
    // '거'의 형태소는 '것'이다. 앞의 '만나 + ㄹ'만 맞으면 되므로 정렬에 성공한다.
    const w = word('만날거야', [
      ['만나', 'VV'],
      ['ㄹ', 'ETM'],
      ['것', 'NNB'],
      ['이', 'VCP'],
      ['야', 'EF'],
    ])
    expect(morphemeOffset(w, 2)).toBe(2)
  })

  it('첫 형태소의 위치는 언제나 0이다', () => {
    const w = word('회의중', [
      ['회의', 'NNG'],
      ['중', 'NNB'],
    ])
    expect(morphemeOffset(w, 0)).toBe(0)
    expect(morphemeOffset(w, 1)).toBe(2)
  })

  it('불규칙 활용으로 어긋나면 위치를 포기한다', () => {
    // 틀린 자리에 밑줄을 긋느니 안 긋는 게 낫다.
    const w = word('구워서', [
      ['굽', 'VV'], // 표면형은 '구워'라 자모가 어긋난다
      ['어서', 'EC'],
    ])
    expect(morphemeOffset(w, 1)).toBeNull()
  })

  it('음절 중간에서 시작하는 형태소는 포기한다', () => {
    // 공백을 넣을 수 없는 자리다.
    const w = word('갔다', [
      ['가', 'VV'],
      ['았', 'EP'], // 'ㅆ'이 '갔'의 받침으로 녹아 있다
      ['다', 'EF'],
    ])
    expect(morphemeOffset(w, 1)).toBeNull()
  })
})
