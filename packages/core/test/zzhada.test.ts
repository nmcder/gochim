import { describe, expect, it } from 'vitest'
import { applyFixes, check } from '../src/index.js'
import { allRules } from '../src/rules/index.js'
import { seosulHada } from '../src/rules/seosul-hada.js'

const rules = [seosulHada]
const withNew = [...allRules, seosulHada]

describe('seosul-hada 단독', () => {
  for (const ex of seosulHada.examples) {
    it(`고침: ${ex.wrong} → ${ex.right}`, () => {
      const ds = check(ex.wrong, { rules })
      expect(ds.length, '오류를 찾지 못했다').toBeGreaterThan(0)
      expect(applyFixes(ex.wrong, ds)).toBe(ex.right)
    })
  }
  for (const ce of seosulHada.counterExamples ?? []) {
    it(`오탐 없음: ${ce}`, () => {
      expect(check(ce, { rules })).toEqual([])
    })
  }
})

describe('seosul-hada 를 켠 전체 규칙', () => {
  it('새 규칙의 counterExamples를 기존 규칙도 건드리지 않는다', () => {
    const offenders: string[] = []
    for (const ce of seosulHada.counterExamples ?? []) {
      const ds = check(ce, { rules: withNew })
      if (ds.length) offenders.push(`${ce} ← ${ds.map((d) => `${d.ruleId}:${d.text}`).join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('새 규칙 예시의 정답 문장을 어떤 규칙도 잡지 않는다', () => {
    const offenders: string[] = []
    for (const ex of seosulHada.examples) {
      const ds = check(ex.right, { rules: withNew })
      if (ds.length) offenders.push(`${ex.right} ← ${ds.map((d) => `${d.ruleId}:${d.text}`).join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('기존 규칙들의 counterExamples를 새 규칙이 건드리지 않는다', () => {
    const offenders: string[] = []
    for (const rule of allRules) {
      for (const ce of rule.counterExamples ?? []) {
        const ds = check(ce, { rules })
        if (ds.length) offenders.push(`${ce} ← ${ds.map((d) => d.text).join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('기존 규칙 예시의 정답 문장을 새 규칙이 건드리지 않는다', () => {
    const offenders: string[] = []
    for (const rule of allRules) {
      for (const ex of rule.examples) {
        const ds = check(ex.right, { rules })
        if (ds.length) offenders.push(`${ex.right} ← ${ds.map((d) => d.text).join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('기존 규칙 예시의 오류 문장에서도 엉뚱한 자리를 잡지 않는다', () => {
    const offenders: string[] = []
    for (const rule of allRules) {
      for (const ex of rule.examples) {
        const ds = check(ex.wrong, { rules })
        if (ds.length) offenders.push(`${ex.wrong} ← ${ds.map((d) => d.text).join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
