import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyFixes, check } from '../src/index.js'
import { allRules } from '../src/rules/index.js'
import { defineRule } from '../src/rules/define.js'
import { josa } from '../src/hangul.js'

const CORPUS =
  'C:\\Users\\kkwki\\AppData\\Local\\Temp\\claude\\c--Users-kkwki-Desktop-gochim\\81c24d2b-2440-4bd5-b8cf-0902abc1bc22\\scratchpad\\clean-corpus.json'

/** 수관형사·숫자 + 단위 명사가 한 낱말로 굳은 것. 가르면 안 된다. */
const UNIT_COMPOUND = new Set(['한일', '세일', '네일', '열일', '한시', '두주', '세주', '세분', '몇일'])

const numUnitPosition = defineRule({
  id: 'num-unit-position',
  category: 'spacing',
  confidence: 0.94,
  pattern:
    /(?<![가-힣])(\d+|대여섯|다섯|여섯|일곱|여덟|아홉|스무|스물|서른|마흔|예순|일흔|여든|아흔|한두|두세|서너|너덧|한|두|세|네|열|몇)( ?)(시간|분|초|주일|주|달|개월|년|일|시)(뒤|앞|이후|이전|후|전|사이|무렵|즈음|안)(?:(?![가-힣])|(?=[에은는도만의로쯤께였이가을를야라랑])|(?=부터|까지|보다|처럼|마다|조차|밖에|뿐|대로|두고|둔|뒀|두었))/g,
  resolve(ctx) {
    const [, num = '', gap = '', unit = '', pos = ''] = ctx.match
    if (num === '몇' && unit === '일') return null
    if (!gap && UNIT_COMPOUND.has(num + unit)) return null
    const head = /^\d/.test(num) ? `${num}${gap}${unit}` : `${num} ${unit}`
    return {
      suggestions: [`${head} ${pos}`],
      subId: pos,
      message: `'${pos}'${josa(pos, '은/는')} 앞말과 띄어 씁니다.`,
      explain: `단위를 나타내는 '${unit}'과 위치·시간을 나타내는 '${pos}'은 서로 다른 명사입니다.`,
      refs: ['한글 맞춤법 제2항', '한글 맞춤법 제43항'],
    }
  },
  examples: [
    { wrong: '몇분뒤에 답장이 왔다.', right: '몇 분 뒤에 답장이 왔다.' },
    { wrong: '5분뒤에 다시 걸게요.', right: '5분 뒤에 다시 걸게요.' },
    { wrong: '두시간전에 이미 출발했어요.', right: '두 시간 전에 이미 출발했어요.' },
    { wrong: '한달뒤로 일정을 미뤘다.', right: '한 달 뒤로 일정을 미뤘다.' },
    { wrong: '30분안에 끝내야 한다.', right: '30분 안에 끝내야 한다.' },
    { wrong: '6개월이후에 다시 검사받으세요.', right: '6개월 이후에 다시 검사받으세요.' },
    { wrong: '세시무렵에 도착했다.', right: '세 시 무렵에 도착했다.' },
  ],
})

const durationPosition = defineRule({
  id: 'duration-position',
  category: 'spacing',
  confidence: 0.94,
  pattern:
    /(?<![가-힣])(일주일|이주일|삼주일|여드레|아흐레|하루|이틀|사흘|나흘|닷새|엿새|이레|열흘|보름|며칠)(뒤|앞|이후|이전|후|전|사이|무렵|즈음|안)(?:(?![가-힣])|(?=[에은는도만의로쯤께였이가을를야라랑])|(?=부터|까지|보다|처럼|마다|조차|밖에|뿐|대로|두고|둔|뒀|두었))/g,
  resolve(ctx) {
    const [, dur = '', pos = ''] = ctx.match
    return {
      suggestions: [`${dur} ${pos}`],
      subId: pos,
      message: `'${pos}'${josa(pos, '은/는')} 앞말과 띄어 씁니다.`,
      explain: `'${dur}'과 '${pos}'은 각각 자립 명사입니다.`,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '며칠전에 우연히 만났다.', right: '며칠 전에 우연히 만났다.' },
    { wrong: '이틀뒤에 다시 오겠습니다.', right: '이틀 뒤에 다시 오겠습니다.' },
    { wrong: '일주일후에 답장이 왔다.', right: '일주일 후에 답장이 왔다.' },
    { wrong: '시험을 며칠앞두고 몸살이 났다.', right: '시험을 며칠 앞두고 몸살이 났다.' },
    { wrong: '열흘안에 처리하겠습니다.', right: '열흘 안에 처리하겠습니다.' },
  ],
})

const CE1 = [
  '오후 세 시에 만나기로 했다.',
  '내일 오전에 교수님을 뵈러 갑니다.',
  '전쟁 직후 사회는 극심한 혼돈에 빠졌다.',
  '사전에 협의된 내용대로 진행하겠습니다.',
  '생전 처음 보는 광경이었다.',
  '한일전 응원하러 광장에 나갔다.',
  '여름 세일전이 다음 주에 시작된다.',
  '네일아트를 받으러 갔다.',
  '열일 제쳐 두고 달려왔다.',
  '한시가 급한 상황이다.',
  '세분화된 기준을 마련했다.',
  '1시간 전후로 도착할 것 같다.',
  '1970년대 후반에 지어진 건물이다.',
  '2년 전세 계약을 맺었다.',
  '4년 전액 장학금을 받았다.',
  '5분 안내 방송이 나왔다.',
  '3일 안전 점검을 마쳤다.',
  '창립 5주년전을 열었다.',
  '1차전은 무승부로 끝났다.',
  '3회전에서 탈락했다.',
  '이로써 우리 팀은 3년 연속 우승을 차지했다.',
  '이 동아리는 30년간 이어 온 전통을 지키고 있습니다.',
  '서버는 접속 기록을 5분마다 갱신한다.',
  '10년 만에 만난 친구가 하나도 안 변했더라.',
  '고등학교 3년 동안 학급 도우미를 맡았습니다.',
  '3일밖에 안 남았다.',
  '몇 시간 안 남았다.',
  '2000년 초에 태어났다.',
  '3분 뒤에 다시 시도하세요.',
  '두 달 사이에 다 팔렸다.',
  '스무 살 전에는 몰랐다.',
]

const CE2 = [
  '하루 종일 비가 내렸다.',
  '하루빨리 나아지기를 바란다.',
  '하루아침에 달라질 리 없다.',
  '하루 이틀 일이 아니다.',
  '보름달이 밝게 떴다.',
  '며칠간 자리를 비웠습니다.',
  '이틀간 자리를 비웁니다.',
  '사흘째 연락이 없다.',
  '이레 동안 앓았다.',
  '보름 만에 소식이 왔다.',
  '일주일 만에 다 읽었다.',
  '며칠 뒤에 보자.',
  '이틀밖에 안 남았다.',
  '나흘 앞으로 다가온 시험이 걱정이다.',
  '며칠 사이에 부쩍 추워졌다.',
]

const corpus: string[] = JSON.parse(readFileSync(CORPUS, 'utf8'))

function hits(rule: ReturnType<typeof defineRule>): string[] {
  const out: string[] = []
  for (const s of corpus) {
    for (const d of check(s, { rules: [rule] })) out.push(`${d.text} -> ${d.suggestions[0]} || ${s.slice(Math.max(0, d.start - 20), d.end + 20)}`)
  }
  return out
}

describe('최종 검증', () => {
  it('num-unit-position cleanCorpusHits', () => {
    const h = hits(numUnitPosition)
    console.log('num-unit-position cleanCorpusHits =', h.length, h.join('\n'))
    expect(h.length).toBe(0)
  })
  it('duration-position cleanCorpusHits', () => {
    const h = hits(durationPosition)
    console.log('duration-position cleanCorpusHits =', h.length, h.join('\n'))
    expect(h.length).toBe(0)
  })

  it('examples: 규칙 단독으로 정확히 고친다', () => {
    const bad: string[] = []
    for (const r of [numUnitPosition, durationPosition]) {
      for (const e of r.examples) {
        const ds = check(e.wrong, { rules: [r] })
        if (ds.length === 0) { bad.push(`못 잡음 ${r.id}: ${e.wrong}`); continue }
        const got = applyFixes(e.wrong, ds)
        if (got !== e.right) bad.push(`${r.id}: ${e.wrong} -> ${got} (기대 ${e.right})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('examples: 전체 규칙과 함께 돌려도 정확히 고친다', () => {
    const rules = [...allRules, numUnitPosition, durationPosition]
    const bad: string[] = []
    for (const r of [numUnitPosition, durationPosition]) {
      for (const e of r.examples) {
        const got = applyFixes(e.wrong, check(e.wrong, { rules }))
        if (got !== e.right) bad.push(`${r.id}: ${e.wrong} -> ${got} (기대 ${e.right})`)
      }
    }
    expect(bad).toEqual([])
  })

  it('counterExamples: 후보 단독 + 전체 규칙 둘 다 조용하다', () => {
    const rules = [...allRules, numUnitPosition, durationPosition]
    const bad: string[] = []
    for (const [r, list] of [[numUnitPosition, CE1] as const, [durationPosition, CE2] as const]) {
      for (const s of list) {
        const solo = check(s, { rules: [r] })
        if (solo.length) bad.push(`SOLO ${r.id} :: ${s} <- ${solo.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
        const all = check(s, { rules })
        if (all.length) bad.push(`ALL ${r.id} :: ${s} <- ${all.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('examples 의 정답 문장은 어떤 규칙도 잡지 않는다', () => {
    const rules = [...allRules, numUnitPosition, durationPosition]
    const bad: string[] = []
    for (const r of [numUnitPosition, durationPosition]) {
      for (const e of r.examples) {
        const ds = check(e.right, { rules })
        if (ds.length) bad.push(`${e.right} <- ${ds.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('골든셋 정답/부정 예시를 건드리지 않는다', () => {
    const g = JSON.parse(readFileSync(new URL('../../../data/golden/golden.json', import.meta.url), 'utf8'))
    const bad: string[] = []
    for (const c of g.cases) {
      const ds = check(c.right, { rules: [numUnitPosition, durationPosition] })
      if (ds.length) bad.push(`CASE ${c.id} :: ${c.right}`)
    }
    for (const n of g.negatives) {
      const ds = check(n.text, { rules: [numUnitPosition, durationPosition] })
      if (ds.length) bad.push(`NEG ${n.id} :: ${n.text}`)
    }
    expect(bad).toEqual([])
  })

  it('기존 규칙의 예시/반례를 건드리지 않는다', () => {
    const bad: string[] = []
    for (const r of allRules) {
      for (const s of [...(r.counterExamples ?? []), ...r.examples.map((e) => e.right), ...r.examples.map((e) => e.wrong)]) {
        const ds = check(s, { rules: [numUnitPosition, durationPosition] })
        if (ds.length) bad.push(`${r.id} :: ${s} <- ${ds.map((d) => d.ruleId + ':' + d.text).join(', ')}`)
      }
    }
    expect(bad).toEqual([])
  })
})
