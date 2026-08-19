import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyFixes, check } from '../src/index.js'
import { allRules } from '../src/rules/index.js'
import { defineRule } from '../src/rules/define.js'

const CORPUS =
  'C:\\Users\\kkwki\\AppData\\Local\\Temp\\claude\\c--Users-kkwki-Desktop-gochim\\81c24d2b-2440-4bd5-b8cf-0902abc1bc22\\scratchpad\\clean-corpus.json'

const NUM =
  '\\d+|대여섯|다섯|여섯|일곱|여덟|아홉|스무|스물|서른|마흔|예순|일흔|여든|아흔|한두|두세|서너|너덧|한|두|세|네|열|몇'
const UNIT = '시간|분|초|주일|주|달|개월|년|일|시'
const POS = '뒤|앞|이후|이전|후|전|사이|무렵|즈음|안'
const TAIL =
  '(?:(?![가-힣])|(?=[에은는도만의로쯤께였이가을를야라랑])|(?=부터|까지|보다|처럼|마다|조차|밖에|뿐|대로|두고|둔|뒀|두었))'
const COMPOUND = new Set(['세일', '네일', '한일', '열일', '몇일', '한시', '두주', '세주', '세분'])

const numUnitPosition = defineRule({
  id: 'num-unit-position',
  category: 'spacing',
  confidence: 0.94,
  pattern: new RegExp(`(?<![가-힣])(${NUM})( ?)(${UNIT})(${POS})${TAIL}`, 'g'),
  resolve(ctx) {
    const [, num = '', gap = '', unit = '', pos = ''] = ctx.match
    if (num === '몇' && unit === '일') return null
    if (!gap && COMPOUND.has(num + unit)) return null
    const head = /^\d/.test(num) ? `${num}${gap}${unit}` : `${num} ${unit}`
    return { suggestions: [`${head} ${pos}`], message: 'm', explain: 'e', refs: [] }
  },
  examples: [{ wrong: '몇분뒤에 답장이 왔다.', right: '몇 분 뒤에 답장이 왔다.' }],
})

const DUR = '일주일|이주일|삼주일|여드레|아흐레|하루|이틀|사흘|나흘|닷새|엿새|이레|열흘|보름|며칠'
const durationPosition = defineRule({
  id: 'duration-position',
  category: 'spacing',
  confidence: 0.94,
  pattern: new RegExp(`(?<![가-힣])(${DUR})(${POS})${TAIL}`, 'g'),
  resolve(ctx) {
    const [, dur = '', pos = ''] = ctx.match
    return { suggestions: [`${dur} ${pos}`], message: 'm', explain: 'e', refs: [] }
  },
  examples: [{ wrong: '며칠전에 만났다.', right: '며칠 전에 만났다.' }],
})

const corpus: string[] = JSON.parse(readFileSync(CORPUS, 'utf8'))

function count(rule: ReturnType<typeof defineRule>): string[] {
  const bad: string[] = []
  for (const s of corpus) {
    for (const d of check(s, { rules: [rule] })) {
      bad.push(`${d.text} -> ${d.suggestions.join('/')} || ${s.slice(Math.max(0, d.start - 25), d.end + 25)}`)
    }
  }
  return bad
}

describe('규칙별 cleanCorpusHits', () => {
  it('num-unit-position', () => {
    const bad = count(numUnitPosition)
    console.log('num-unit-position cleanCorpusHits =', bad.length, bad.join('\n'))
    expect(bad).toEqual([])
  })
  it('duration-position', () => {
    const bad = count(durationPosition)
    console.log('duration-position cleanCorpusHits =', bad.length, bad.join('\n'))
    expect(bad).toEqual([])
  })

  it('기존 규칙의 counterExamples 를 건드리지 않는다', () => {
    const bad: string[] = []
    for (const r of allRules) {
      for (const s of r.counterExamples ?? []) {
        const ds = check(s, { rules: [numUnitPosition, durationPosition] })
        if (ds.length) bad.push(`${r.id} :: ${s} <- ${ds.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
      }
      for (const e of r.examples) {
        const ds = check(e.right, { rules: [numUnitPosition, durationPosition] })
        if (ds.length) bad.push(`${r.id} :: ${e.right} <- ${ds.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
        const ds2 = check(e.wrong, { rules: [numUnitPosition, durationPosition] })
        if (ds2.length) bad.push(`WRONG ${r.id} :: ${e.wrong} <- ${ds2.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('기존 골든셋을 건드리지 않는다', () => {
    const raw = readFileSync(new URL('../../../data/golden/golden.json', import.meta.url), 'utf8')
    const g = JSON.parse(raw)
    const bad = []
    for (const c of g.cases) {
      const ds = check(c.right, { rules: [numUnitPosition, durationPosition] })
      if (ds.length) bad.push('CASE.right ' + c.id + ' :: ' + c.right + ' <- ' + ds.map((d) => d.ruleId + ':' + d.text).join(', '))
    }
    for (const n of g.negatives) {
      const ds = check(n.text, { rules: [numUnitPosition, durationPosition] })
      if (ds.length) bad.push('NEG ' + n.id + ' :: ' + n.text + ' <- ' + ds.map((d) => d.ruleId + ':' + d.text).join(', '))
    }
    console.log('golden right/negatives 검사 대상 =', g.cases.length + g.negatives.length)
    expect(bad).toEqual([])
  })

  it('examples 가 전체 규칙과 함께 정확히 고쳐진다', () => {
    const WRONGS: Array<[string, string]> = [
      ['몇분뒤에 친구가 갑자기 내일 뭐 하냐고 물어봤다.', '몇 분 뒤에 친구가 갑자기 내일 뭐 하냐고 물어봤다.'],
      ['몇 분뒤에 답장이 왔다.', '몇 분 뒤에 답장이 왔다.'],
      ['5분뒤에 다시 걸게요.', '5분 뒤에 다시 걸게요.'],
      ['두시간전에 이미 출발했어요.', '두 시간 전에 이미 출발했어요.'],
      ['3일후에 결과가 나온대.', '3일 후에 결과가 나온대.'],
      ['한달뒤로 일정을 미뤘다.', '한 달 뒤로 일정을 미뤘다.'],
      ['6개월이후에 다시 검사받으세요.', '6개월 이후에 다시 검사받으세요.'],
      ['30분안에 끝내야 한다.', '30분 안에 끝내야 한다.'],
      ['세시무렵에 도착했다.', '세 시 무렵에 도착했다.'],
      ['10년전이 그립다.', '10년 전이 그립다.'],
      ['며칠전에 우연히 만났다.', '며칠 전에 우연히 만났다.'],
      ['이틀뒤에 다시 오겠습니다.', '이틀 뒤에 다시 오겠습니다.'],
      ['일주일후에 답장이 왔다.', '일주일 후에 답장이 왔다.'],
      ['하루전까지 알려 주세요.', '하루 전까지 알려 주세요.'],
      ['시험을 며칠앞두고 몸살이 났다.', '시험을 며칠 앞두고 몸살이 났다.'],
      ['열흘안에 처리하겠습니다.', '열흘 안에 처리하겠습니다.'],
      ['보름뒤가 마감이다.', '보름 뒤가 마감이다.'],
    ]
    const rules = [...allRules, numUnitPosition, durationPosition]
    const bad: string[] = []
    for (const [w, r] of WRONGS) {
      const got = applyFixes(w, check(w, { rules }))
      if (got !== r) bad.push(`${w} -> ${got} (기대 ${r})`)
    }
    expect(bad).toEqual([])
  })
})
