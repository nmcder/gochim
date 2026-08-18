import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { check, fix } from '../src/index.js'
import type { Diagnostic } from '../src/types.js'

/**
 * 골든 테스트셋 기반 정확도 측정.
 *
 * Phase 0의 합격선은 **정밀도 0.98 이상**이다. 재현율은 낮아도 된다 —
 * 못 잡은 오류는 나중에 규칙을 더하면 되지만, 맞는 문장에 밑줄을 그으면
 * 사용자는 그 자리에서 확장을 지운다.
 */

interface GoldenSpan {
  start: number
  end: number
  wrong: string
  right: string
  ruleHint: string
}

interface GoldenCase {
  id: string
  cluster: string
  category: string
  domain: string
  freq: string
  wrong: string
  right: string
  spans: GoldenSpan[]
  note: string
}

interface GoldenSet {
  version: number
  counts: Record<string, number>
  cases: GoldenCase[]
  negatives: { id: string; cluster: string; text: string; trap: string }[]
}

const goldenPath = fileURLToPath(new URL('../../../data/golden/golden.json', import.meta.url))
const golden: GoldenSet = JSON.parse(readFileSync(goldenPath, 'utf8'))

const overlaps = (d: Diagnostic, s: GoldenSpan) => d.start < s.end && s.start < d.end

interface Score {
  truePositives: number
  falsePositives: { sentence: string; diagnostic: Diagnostic }[]
  falseNegatives: { id: string; sentence: string; span: GoldenSpan }[]
  exactFixes: number
}

function score(): Score {
  const result: Score = { truePositives: 0, falsePositives: [], falseNegatives: [], exactFixes: 0 }

  for (const testCase of golden.cases) {
    const diagnostics = check(testCase.wrong)
    const covered = new Set<number>()

    for (const d of diagnostics) {
      const index = testCase.spans.findIndex((s) => overlaps(d, s))
      if (index === -1) result.falsePositives.push({ sentence: testCase.wrong, diagnostic: d })
      else {
        result.truePositives += 1
        covered.add(index)
      }
    }

    testCase.spans.forEach((span, index) => {
      if (!covered.has(index)) result.falseNegatives.push({ id: testCase.id, sentence: testCase.wrong, span })
    })

    if (fix(testCase.wrong) === testCase.right) result.exactFixes += 1
  }

  // 정답 문장과 negatives는 오직 오탐만 만들 수 있다.
  for (const sentence of [...new Set(golden.cases.map((c) => c.right)), ...golden.negatives.map((n) => n.text)]) {
    for (const d of check(sentence)) result.falsePositives.push({ sentence, diagnostic: d })
  }

  return result
}

const s = score()
const precision = s.truePositives / Math.max(1, s.truePositives + s.falsePositives.length)
const recall = s.truePositives / Math.max(1, s.truePositives + s.falseNegatives.length)

describe(`골든 테스트셋 (cases ${golden.cases.length} · negatives ${golden.negatives.length})`, () => {
  it(`정밀도 ${precision.toFixed(4)} ≥ 0.98`, () => {
    const report = s.falsePositives
      .slice(0, 20)
      .map((fp) => `  ${fp.diagnostic.ruleId}: "${fp.diagnostic.text}" ← ${fp.sentence}`)
      .join('\n')
    expect(s.falsePositives.length === 0 || precision >= 0.98, `오탐 ${s.falsePositives.length}건\n${report}`).toBe(
      true,
    )
  })

  it('정답 문장에는 아무 진단도 나오지 않는다', () => {
    const offenders = [...new Set(golden.cases.map((c) => c.right))]
      .flatMap((sentence) => check(sentence).map((d) => `${d.ruleId}: "${d.text}" ← ${sentence}`))
    expect(offenders).toEqual([])
  })

  it('오탐 유도 문장(negatives)에도 진단이 나오지 않는다', () => {
    const offenders = golden.negatives.flatMap((n) =>
      check(n.text).map((d) => `${d.ruleId}: "${d.text}" ← ${n.text}\n    함정: ${n.trap}`),
    )
    expect(offenders).toEqual([])
  })

  it(`재현율 ${recall.toFixed(4)} — 현재 구현 범위를 기록한다`, () => {
    // 재현율에는 합격선을 두지 않는다. 1층에서 못 잡기로 **결정한** 갈래가 있기 때문이다.
    // 다만 0으로 떨어지면 무언가 망가진 것이므로 최소선만 지킨다.
    expect(recall).toBeGreaterThan(0.3)
  })

  it('데이터 자체의 불변식이 유지된다', () => {
    for (const testCase of golden.cases) {
      for (const span of testCase.spans) {
        expect(testCase.wrong.slice(span.start, span.end), testCase.id).toBe(span.wrong)
      }
      expect(testCase.wrong, testCase.id).not.toBe(testCase.right)
    }
  })
})
