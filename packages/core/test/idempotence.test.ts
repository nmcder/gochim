import { describe, expect, it } from 'vitest'
import { check, fix } from '../src/index.js'
import { goldenSamples } from './samples.js'

/**
 * 멱등 — 고친 글을 다시 고쳐도 그대로여야 한다.
 *
 * `fix(fix(x)) === fix(x)`가 깨지는 방식은 둘이다.
 *
 *  1. **진동.** 규칙 둘이 서로를 되돌린다. 1층의 `josa-spaced`가 `표기 뿐이다`를 붙이면
 *     형태소 층의 `morph-eojeol-split`이 도로 뗐다. 사용자 화면에서는 자동 고침이 켜져
 *     있을 때 글자가 깜빡이는 것으로 나타난다. 영원히 멈추지 않는다.
 *  2. **미수렴.** 고친 자리가 다음 오류를 드러내는데 한 번만 훑고 끝낸다.
 *     `않되요`가 `않돼요`에서 멈추면 여전히 틀린 글을 돌려준 것이다.
 *
 * 둘 다 실제로 있던 일이라 표본 전체로 못 박는다. 이 테스트가 빨개지면
 * **규칙 둘이 다투고 있다**는 뜻이므로, 어느 쪽이 옳은지 정해서 한쪽을 물려야 한다.
 * `fix`의 되풀이 상한을 올리는 것으로는 풀리지 않는다.
 *
 * 형태소 층 쪽은 분석기가 있어야 하므로 `packages/morph/test/analyzer.test.ts`에 있다.
 */

const SAMPLES = goldenSamples()

describe('고친 글을 다시 고쳐도 그대로다 (1층)', () => {
  it('표본이 충분히 모였다', () => {
    // 표본 수집이 조용히 망가지면 아래 테스트가 0개를 돌며 통과해 버린다.
    expect(SAMPLES.length).toBeGreaterThan(3000)
  })

  it('fix(fix(x)) === fix(x)', () => {
    const broken: string[] = []
    for (const text of SAMPLES) {
      const once = fix(text)
      const twice = fix(once)
      if (once !== twice) broken.push(`${text.slice(0, 60)}\n    1회 ${once.slice(0, 60)}\n    2회 ${twice.slice(0, 60)}`)
    }
    expect(broken.slice(0, 5).join('\n  ')).toBe('')
    expect(broken).toHaveLength(0)
  })

  it('한 번 더 고칠 것이 남아 있지 않다', () => {
    // 멱등의 다른 얼굴 — 결과에 남은 진단은 제안이 없거나 스스로를 가리키는 것뿐이어야 한다.
    const leftover: string[] = []
    for (const text of SAMPLES) {
      const fixed = fix(text)
      for (const d of check(fixed)) {
        const first = d.suggestions[0]
        if (first != null && first !== d.text) leftover.push(`${d.ruleId}: ${d.text} → ${first}  |  ${fixed.slice(0, 50)}`)
      }
    }
    expect(leftover.slice(0, 5).join('\n  ')).toBe('')
  })
})
