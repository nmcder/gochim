import { describe, expect, it } from 'vitest'
import { applyFixes, check } from '../src/index.js'
import { allRules } from '../src/rules/index.js'

/**
 * 규칙은 스스로를 증명한다.
 *
 * 모든 규칙이 `examples`(잡아야 하는 것)와 `counterExamples`(건드리면 안 되는 것)를
 * 들고 다니므로, 규칙을 추가하면 테스트도 함께 늘어난다.
 */
describe('규칙이 선언한 예시', () => {
  for (const rule of allRules) {
    describe(rule.id, () => {
      for (const example of rule.examples) {
        it(`고침: ${example.wrong} → ${example.right}`, () => {
          const diagnostics = check(example.wrong, { rules: [rule] })
          expect(diagnostics.length, '오류를 찾지 못했다').toBeGreaterThan(0)
          expect(applyFixes(example.wrong, diagnostics)).toBe(example.right)
        })
      }

      for (const counterExample of rule.counterExamples ?? []) {
        it(`오탐 없음: ${counterExample}`, () => {
          expect(check(counterExample, { rules: [rule] })).toEqual([])
        })
      }
    })
  }
})

describe('규칙 전체를 켠 상태에서의 오탐', () => {
  const counterExamples = allRules.flatMap((r) => r.counterExamples ?? [])

  // 경고는 '이건 틀렸다'가 아니라 '원칙은 이쪽이다'라는 안내다(제46·47항이 허용하는 표기 등).
  // 정상 문장에 떠도 약속을 어기는 게 아니므로 오류 심각도만 0이어야 한다.
  const errorsOnly = (sentence: string) => check(sentence).filter((d) => d.severity !== 'warning')

  it.each(counterExamples)('정상 문장에 오류 밑줄을 긋지 않는다: %s', (sentence) => {
    expect(errorsOnly(sentence)).toEqual([])
  })

  it('예시의 정답 문장은 어떤 규칙도 잡지 않는다', () => {
    const offenders: string[] = []
    for (const rule of allRules) {
      for (const example of rule.examples) {
        const diagnostics = errorsOnly(example.right)
        if (diagnostics.length > 0) {
          offenders.push(`${example.right} ← ${diagnostics.map((d) => d.ruleId).join(', ')}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('규칙 메타데이터', () => {
  it('모든 규칙은 예시를 하나 이상 가진다', () => {
    for (const rule of allRules) expect(rule.examples.length, rule.id).toBeGreaterThan(0)
  })

  it('예시의 오류 문장과 정답 문장은 서로 달라야 한다', () => {
    for (const rule of allRules) {
      for (const example of rule.examples) {
        expect(example.wrong, rule.id).not.toBe(example.right)
      }
    }
  })
})
