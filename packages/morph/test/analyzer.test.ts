import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { check, fix, groupWords } from '@gochim/core'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { goldenSamples } from '../../core/test/samples.js'
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

/**
 * 밖에서 온 정상 한국어.
 *
 * 위의 '3층에서도 건드리면 안 되는 문장' 열두 개는 규칙을 다듬으며 함께 고른 것이라
 * 통과하는 것이 당연하다. 이쪽은 규칙을 보지 않고 따로 지은 문장 뭉치라
 * **정말 처음 보는 글에서 어떤지**를 잰다.
 *
 * 지금 여기서 나오는 오탐은 data/golden/known-false-positives.json 에 갈래별로
 * 적혀 있다. 그 목록에 없는 갈래가 하나라도 나오면 무언가 새로 망가진 것이다.
 * (`npm run guard` 는 여기에 더해 저장소 자기 산문까지 훑는다)
 */
describe('밖에서 온 정상 문장에 처음 보는 오탐이 없다', () => {
  const load = <T>(name: string): T =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../../data/golden/${name}`, import.meta.url)), 'utf8')) as T

  const wild = load<{ sentences: string[] }>('wild.json')
  const known = new Set(
    load<{ entries: { signatures: string[] }[] }>('known-false-positives.json').entries.flatMap((e) => e.signatures),
  )

  /**
   * 서명이 들어맞는가. `*`로 끝나면 앞부분만 맞으면 된다 —
   * 규칙이 조사까지 물고 발화하는 자리가 있어서다(`군데가·군데를·군데에`는 한 갈래다).
   * scripts/guard.mjs 도 같은 규약을 쓴다. 목록 자체는 한 파일에만 있다.
   */
  const isKnown = (key: string): boolean =>
    known.has(key) || [...known].some((k) => k.endsWith('*') && key.startsWith(k.slice(0, -1)))

  it.each([
    ['1층만', false],
    ['형태소 층 포함', true],
  ])('%s', (_label, withMorph) => {
    const unknown: string[] = []
    for (const sentence of wild.sentences) {
      for (const d of check(sentence, withMorph ? { analyzer } : {})) {
        if (d.severity === 'warning') continue
        if (isKnown(`${d.ruleId}|${d.text}`)) continue
        unknown.push(`${d.ruleId}: "${d.text}" → "${d.suggestions[0]}"  |  ${sentence}`)
      }
    }
    expect(unknown, '알고 있던 갈래가 아니다 — 규칙이 새로 망가졌거나, 목록에 없던 오탐이다').toEqual([])
  })

  it('알려진 오탐 목록이 낡지 않았다', () => {
    const firing = new Set<string>()
    for (const sentence of wild.sentences) {
      for (const withMorph of [false, true]) {
        for (const d of check(sentence, withMorph ? { analyzer } : {})) {
          if (d.severity !== 'warning') firing.add(`${d.ruleId}|${d.text}`)
        }
      }
    }
    // 목록에는 저장소 산문에서만 나오는 갈래도 있으므로, 여기서는 **이 뭉치에서 나오던 것**만 본다.
    // 그것마저 안 나오면 고쳐진 것이니 목록에서 지워야 한다 — `npm run guard`가 어느 것인지 알려 준다.
    //
    // 규칙 id를 손으로 적어 두었더니 그 규칙들이 다 고쳐진 뒤에도 목록이 남아 테스트가
    // 헛돌았다. 형태소 층 규칙만 저장소 산문에서 나오므로, 나머지는 전부 여기서 나와야 한다.
    const fromWild = [...known].filter((k) => !k.startsWith('morph-'))
    const stale = fromWild.filter((k) => !firing.has(k))
    expect(stale, 'guard.mjs를 돌려 확인하고 known-false-positives.json에서 지울 것').toEqual([])
  })
})

/**
 * 자리 셈법 — garu-ko는 코드포인트, 자바스크립트 문자열은 UTF-16.
 *
 * 이모지 하나가 서러게이트 쌍으로 두 자리를 차지하므로, 옮겨 주지 않으면 그 뒤의
 * 모든 자리가 1씩 밀린다. 밀린 자리로 어절을 자르면 아무 규칙도 맞아떨어지지 않아
 * **형태소 층이 통째로 죽는다.** 실측 재현율 0.955 → 0.790.
 *
 * 이 고장은 **틀린 자리에 밑줄을 긋는 게 아니라 아무 데도 안 긋는** 종류라 조용하다.
 * 카톡·SNS가 주 사용처인데 거기서 3층이 안 돌고 있었고 아무도 몰랐다.
 */
describe('이모지가 섞여도 자리가 맞는다', () => {
  const 문장 = [
    '오늘 학교끝나고 친구랑 놀았다',
    '물이끓으면 면을 넣으세요',
    '아무리봐도 이건 아니야',
    '눈물이났습니다 정말로',
    '누구나 할수있는 일이야',
  ]
  const sig = (ds: ReturnType<typeof check>, shift: number) =>
    ds.map((d) => `${d.ruleId}@${d.start - shift}:${d.end - shift}→${d.suggestions[0]}`).join(' | ')

  it.each(문장)('%s', (s) => {
    const 맨몸 = sig(check(s, { analyzer }), 0)
    expect(맨몸).not.toBe('') // 표본이 아무것도 안 잡으면 이 테스트는 헛돈다
    for (const 앞 of ['🙂 ', '🙂🎉👍 ', 'ㅋㅋ ']) {
      expect(sig(check(앞 + s, { analyzer }), 앞.length), `앞에 "${앞}"`).toBe(맨몸)
    }
  })

  // 창을 쓰면서 흔해졌다. 커서 둘레를 자를 때 어절 경계까지 물러나는데,
  // 겹친 공백이나 줄바꿈 앞에서 물러나면 창이 공백으로 시작한다.
  it.each([' ', '  ', '\n', ' \n ', '\t'])('앞에 공백 %j 이 붙어도 같은 자리를 가리킨다', (앞) => {
    const 본문 = '오늘 학교끝나고 친구랑 놀았다.'
    const 맨몸 = check(본문, { analyzer }).filter((d) => d.ruleId.startsWith('morph'))
    expect(맨몸.length).toBeGreaterThan(0)

    const 글 = 앞 + 본문
    const 붙인 = check(글, { analyzer }).filter((d) => d.ruleId.startsWith('morph'))
    // 예전에는 `splitSentences` 가 앞 공백을 잘라 내면서 offset 은 그대로 두어,
    // 그 문장의 형태소가 통째로 어긋나 **3층이 조용히 죽었다.**
    expect(붙인.map((d) => `${d.ruleId}|${d.text}`)).toEqual(맨몸.map((d) => `${d.ruleId}|${d.text}`))
    for (const d of 붙인) expect(글.slice(d.start, d.end)).toBe(d.text)
  })

  it('진단 구간이 서러게이트 쌍을 끊지 않는다', () => {
    const 글 = '가족과 🙂 함께 학교끝나고 왔다. 물이끓으면 🎉 알려 줘.'
    for (const d of check(글, { analyzer })) {
      expect(글.slice(d.start, d.end), `${d.ruleId}의 구간`).toBe(d.text)
      // 잘라 낸 조각에 짝 잃은 서러게이트가 남아 있으면 자리가 어긋난 것이다.
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(글.slice(d.start, d.end))).toBe(false)
    }
  })
})

/**
 * 멱등 — 고친 글을 다시 고쳐도 그대로다 (두 층 다 켠 채로).
 *
 * 여기가 진짜 위험한 자리다. 1층과 형태소 층은 **같은 자리를 반대로 판정할 수 있다.**
 * 실제로 `표기뿐이다`를 두고 1층은 붙이고(`josa-spaced`) 형태소 층은 뗐다
 * (`morph-eojeol-split`). 자동 고침이 켜져 있으면 사용자 화면에서 글자가 깜빡인다.
 *
 * 이 테스트가 빨개지면 되풀이 상한을 올릴 일이 아니라 **어느 층이 옳은지 정할** 일이다.
 * 위 자리는 체언 뒤의 `뿐`이 조사(제41항)라는 쪽으로 정리했다.
 *
 * 1층만 켠 쪽은 `packages/core/test/idempotence.test.ts`에 있다.
 */
describe('고친 글을 다시 고쳐도 그대로다 (형태소 층 포함)', () => {
  const samples = goldenSamples()

  it('표본이 충분히 모였다', () => {
    // 표본 수집이 조용히 망가지면 아래 테스트가 0개를 돌며 통과해 버린다.
    expect(samples.length).toBeGreaterThan(3000)
  })

  it('fix(fix(x)) === fix(x)', () => {
    const broken: string[] = []
    for (const text of samples) {
      const once = fix(text, { analyzer })
      const twice = fix(once, { analyzer })
      if (once === twice) continue
      const thrice = fix(twice, { analyzer })
      const kind = thrice === once ? '진동' : '미수렴'
      broken.push(`[${kind}] ${text.slice(0, 50)}\n    1회 ${once.slice(0, 50)}\n    2회 ${twice.slice(0, 50)}`)
    }
    expect(broken.slice(0, 5).join('\n  ')).toBe('')
    expect(broken).toHaveLength(0)
  }, 120_000)

  it.each([
    '반찬은 네가 먹을만큼만 덜어서 가져가.',
    '지금 회의중이라 못 받아.',
    '누구나 할수있는 일이야.',
    '나도 너 만큼 잘할 수 있어.',
    '메타언어 문장과 인터넷 유희 표기 뿐이다.',
  ])('%s', (sentence) => {
    const once = fix(sentence, { analyzer })
    expect(fix(once, { analyzer })).toBe(once)
  })
})
