import { describe, expect, it } from 'vitest'
import { applyFixes, check, fix, ignoreKey, VERSION, allRules } from '../src/index.js'
import type { Rule } from '../src/types.js'

/**
 * 공개 API가 스스로를 지키는가.
 *
 * npm에 한 번 나가면 되돌리기 어렵다. 남이 어떻게 쓸지 우리가 못 고르므로,
 * **잘못 쓰기 쉬운 자리는 라이브러리 쪽에서 막아야** 한다.
 */
describe('applyFixes는 낡은 진단으로 남의 글을 자르지 않는다', () => {
  it('다른 글에서 나온 진단을 넘겨도 원문이 그대로다', () => {
    const 진단 = check('그러면 안 되요.')
    expect(진단.length).toBeGreaterThan(0)

    const 남의글 = '완전히 다른 문장입니다요.'
    // 예전에는 '완전히 다른돼요장입니다요.' 가 나왔다 — 자리만 믿고 잘라 붙였다.
    expect(applyFixes(남의글, 진단)).toBe(남의글)
  })

  it('제 글에는 그대로 적용된다', () => {
    expect(applyFixes('그러면 안 되요.', check('그러면 안 되요.'))).toBe('그러면 안 돼요.')
  })

  it('글이 조금이라도 바뀌면 그 진단은 버린다', () => {
    const 원문 = '그러면 안 되요.'
    const 진단 = check(원문)
    // 앞에 한 글자만 끼워도 자리가 밀린다.
    expect(applyFixes(`아 ${원문}`, 진단)).toBe(`아 ${원문}`)
  })

  it('빈 목록이나 빈 글에도 터지지 않는다', () => {
    expect(applyFixes('', check('그러면 안 되요.'))).toBe('')
    expect(applyFixes('아무 글', [])).toBe('아무 글')
  })
})

describe('심각도로 좁힐 수 있다', () => {
  const 글 = '좀더 자세히 보고 안 되요.'

  it('기본은 전부 준다', () => {
    const 전부 = check(글)
    expect(전부.some((d) => d.severity === 'warning')).toBe(true)
    expect(전부.some((d) => d.severity === 'error')).toBe(true)
  })

  it("severity: ['error'] 면 경고가 빠진다", () => {
    const 오류만 = check(글, { severity: ['error'] })
    expect(오류만.length).toBeGreaterThan(0)
    expect(오류만.every((d) => d.severity === 'error')).toBe(true)
  })

  it('fix도 같은 옵션을 받는다', () => {
    // fix의 기본은 경고까지 적용한다 — 혼동어가 대부분 경고라 빼면 값진 교정이 사라진다.
    expect(fix(글)).toBe('좀 더 자세히 보고 안 돼요.')
    expect(fix(글, { severity: ['error'] })).toBe('좀더 자세히 보고 안 돼요.')
  })
})

describe('걸러내기는 결과를 줄이기만 한다', () => {
  // 심각도를 겹침 해소 **전에** 거르면, 경고가 막고 있던 자리에서
  // 더 공격적인 규칙이 드러난다. 아래 두 문장은 저장소가 스스로
  // "건드리면 안 된다"고 적어 둔 정상문이다(결재 = 승인).
  it.each(['대금 지급 결재를 요청했습니다.', '요금 인상 결재가 어제 났다.'])(
    "severity:['error'] 가 %s 를 드러내지 않는다",
    (글) => {
      const 전부 = check(글)
      const 오류만 = check(글, { severity: ['error'] })
      // 줄이기만 해야 한다 — 없던 진단이 생기면 안 된다.
      expect(오류만.length).toBeLessThanOrEqual(전부.length)
      for (const d of 오류만) {
        expect(전부.some((o) => o.ruleId === d.ruleId && o.start === d.start)).toBe(true)
      }
      expect(applyFixes(글, 오류만)).toBe(글)
    },
  )
})

describe('무시 사전은 일회성 이터러블로 넘겨도 풀리지 않는다', () => {
  const 글 = '않되요. 그리고 어의없다.'
  const 열쇠 = ignoreKey({ ruleId: 'lexicon/어의없', text: '어의없' })

  it.each([
    ['Set', () => new Set([열쇠])],
    ['배열', () => [열쇠]],
    ['제너레이터', () => (function* () { yield 열쇠 })()],
    ['Set.values()', () => new Set([열쇠]).values()],
  ])('%s', (_label, make) => {
    // fix() 는 고정점까지 되풀이하며 check() 를 여러 번 부른다.
    // 이터러블을 그대로 다시 훑으면 두 번째 패스부터 무시 사전이 비게 된다.
    expect(fix(글, { ignore: make() })).toBe('안 돼요. 그리고 어의없다.')
  })
})

/**
 * 남이 손으로 지은 규칙이 브라우저를 얼리지 못하게 한다.
 *
 * `Rule`과 `CheckOptions.rules`가 공개 타입이라, 정규식을 잘못 지어 오는 것은
 * **막을 수 없고 일어날 일**이다. 라이브러리가 그것을 감당해야 한다.
 *
 * 아래 테스트가 깨지면 통과/실패가 아니라 **테스트가 끝나지 않는다.** 그래서 시간 제한을 건다.
 */
describe('남이 지은 규칙이 검사를 멈추지 못하게 한다', () => {
  const 뼈대: Omit<Rule, 'pattern' | 'resolve'> = {
    id: 'probe',
    category: 'spelling',
    severity: 'error',
    confidence: 0.9,
    examples: [{ wrong: 'foo', right: 'bar' }],
  }

  it('g 플래그가 없어도 끝난다', { timeout: 5000 }, () => {
    // g 없는 exec 는 lastIndex 를 보지도 올리지도 않아 언제나 0번째부터 다시 찾는다.
    const 규칙: Rule = { ...뼈대, pattern: /foo/, resolve: () => ({ suggestions: ['bar'], message: 'x' }) }
    const 결과 = check('foo 그리고 foo', { rules: [규칙] })
    expect(결과.map((d) => d.start)).toEqual([0, 8])
  })

  it('넘긴 정규식을 우리가 바꿔 놓지 않는다', { timeout: 5000 }, () => {
    const 패턴 = /foo/
    check('foo', { rules: [{ ...뼈대, pattern: 패턴, resolve: () => ({ suggestions: ['bar'], message: 'x' }) }] })
    // 남의 객체를 몰래 고치면 그쪽 코드가 먼저 부서진다.
    expect(패턴.global).toBe(false)
    expect(패턴.flags).toBe('')
  })

  it('resolve 가 lastIndex 를 되감아도 끝난다', { timeout: 5000 }, () => {
    const 패턴 = /foo/g
    const 규칙: Rule = {
      ...뼈대,
      pattern: 패턴,
      resolve: () => {
        패턴.lastIndex = 0 // 같은 정규식으로 test() 를 부르면 실제로 이렇게 된다
        return { suggestions: ['bar'], message: 'x' }
      },
    }
    expect(check('foo foo foo', { rules: [규칙] })).toHaveLength(3)
  })

  it('길이 0 매치도 끝난다', { timeout: 5000 }, () => {
    const 규칙: Rule = { ...뼈대, pattern: /(?:)/g, resolve: () => ({ suggestions: ['x'], message: 'x' }) }
    expect(check('아무 글', { rules: [규칙] })).toEqual([])
  })

  it('규칙 하나가 터져도 나머지는 돈다', { timeout: 5000 }, () => {
    const 터지는: Rule = {
      ...뼈대,
      pattern: /foo/,
      resolve: () => {
        throw new Error('boom')
      },
    }
    expect(check('foo 안 되요.', { rules: [터지는, ...allRules] }).length).toBeGreaterThan(0)
  })
})

describe('공개 상수', () => {
  it('VERSION 은 리터럴 타입이 아니라 string 이다', () => {
    // 리터럴로 새어 나가면 남이 쓴 `if (VERSION === '0.2.0')` 가 컴파일 오류가 된다.
    const 대조: string = VERSION
    expect(대조).toMatch(/^\d+\.\d+\.\d+/)
  })
})
