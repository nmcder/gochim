import { finalOf, hasFinal, stripFinal } from '../hangul.js'
import type { MorphFinding, MorphRule, MorphRuleContext } from '../types.js'
import { groupWords } from './words.js'
import { isPlainHangulWord, reanalyze, trimTail } from './split.js'

/**
 * 어미·조사를 잘못 적은 것 (3층).
 *
 * 띄어쓰기가 아니라 **표기**를 고치는 자리인데도 품사가 필요한 것들을 모았다.
 * 둘 다 1층에서는 목록을 손으로 이어 붙여야 했고, 그 목록이 끝내 닫히지 않았다.
 */

/* ────────────────── `-ㄹ려고` — 어미에 ㄹ을 덧붙인 것 ────────────────── */

/**
 * `할려고 → 하려고`.
 *
 * 어미는 `-려고`다. 받침 있는 어간 뒤에서는 `-으려고`가 된다(먹으려고).
 * 그런데 소리 나는 대로 `ㄹ`을 하나 더 얹어 적는 일이 아주 잦다 —
 * `할려고·볼려고·시킬려고·먹을려고`.
 *
 * ## 갈림길
 *
 * 이 자리는 겉모양만으로는 못 가른다. **ㄹ받침 어간**은 원래 이 꼴이 맞기 때문이다.
 *
 *   만들려고 · 살려고 · 놀려고 · 팔려고   ← 만들다·살다·놀다·팔다 (옳다)
 *   할려고 · 볼려고 · 시킬려고            ← 하다·보다·시키다 (틀렸다)
 *
 * 분석기는 이 둘을 어미 표기로 갈라 준다 — 옳은 쪽은 `려고/EC`, 틀린 쪽은 `ㄹ려고/EC`다.
 *
 * ## 그래도 남는 애매함
 *
 * `갈려고`는 `가다`로도 `갈다`로도 읽힌다. 분석기는 문맥과 무관하게 늘 `가다`를 고르므로
 * (`숫돌에 칼을 갈려고`도 `가/VV`로 읽는다) 그 판단만 믿으면 없던 오류를 만든다.
 * 그래서 **ㄹ받침 꼴이 실제 용언인지 되물어본다** — `갈다`를 분석해 `갈/VV`가 나오면
 * 두 갈래가 다 살아 있는 자리라 손대지 않는다. `할다`는 `하/VV + ㄹ/ETM`으로 나와
 * 그런 용언이 없음이 드러난다.
 *
 * 그 대가로 `학교 갈려고·물건 살려고`는 놓친다. 흔한 오류지만 `칼을 갈려고·목숨을 살려고`와
 * 글자가 같아서, 잡으려면 오탐을 감수해야 한다. 정밀도를 먼저 지킨다.
 */

const VERBAL = new Set(['VV', 'VA', 'VX'])

/** `ㄹ려고·ㄹ려면·을려고…` 처럼 어미 앞에 ㄹ이 덧붙은 표기인가. */
const WRONG_L_EOMI = /^(ㄹ|을)(려|랴)/

export const morphLyeogo: MorphRule = {
  id: 'morph-lyeogo',
  autoFixSafe: true,
  category: 'ending',
  severity: 'error',
  confidence: 0.92,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const raw of ctx.words) {
      if (!isPlainHangulWord(raw.text)) continue
      const morphemes = reanalyze(ctx, raw)
      const trimmed = trimTail(raw.text)

      for (const m of morphemes) {
        if (m.pos !== 'EC' || !WRONG_L_EOMI.test(m.text)) continue

        // `ㄹ려고`는 겉으로 `려고`만 보인다 — ㄹ은 앞 음절의 받침으로 들어가 있다.
        // `을려고`는 통째로 겉에 드러난다.
        const surfaceTail = m.text.startsWith('ㄹ') ? m.text.slice(1) : m.text
        if (!trimmed.endsWith(surfaceTail)) break
        const head = trimmed.slice(0, trimmed.length - surfaceTail.length)
        if (head.length === 0) break

        const last = head[head.length - 1]!
        let fixedHead: string | null = null

        if (m.text.startsWith('ㄹ')) {
          if (finalOf(last) !== 'ㄹ') break
          // ㄹ받침을 떼면 원래 어간이 나온다 — `시킬` → `시키`.
          const bare = stripFinal(last)
          if (bare == null) break
          // 그 ㄹ받침 꼴이 실제 용언이면(`갈다`) 두 갈래가 다 살아 있는 자리다.
          const probe = groupWords(head + '다', ctx.analyze(head + '다'))
          const first = probe[0]?.morphemes[0]
          if (first && first.text === head && VERBAL.has(first.pos)) break
          fixedHead = head.slice(0, -1) + bare
        } else {
          // `먹을려고` → `먹으려고`. 받침 있는 어간 뒤 매개모음은 `으`다.
          if (last !== '을') break
          if (head.length < 2 || !hasFinal(head[head.length - 2]!)) break
          fixedHead = `${head.slice(0, -1)}으`
        }

        if (fixedHead == null) break
        found.push({
          start: raw.start,
          end: raw.start + trimmed.length,
          suggestions: [fixedHead + surfaceTail],
          message: "어미는 '-려고'입니다. 'ㄹ'을 덧붙여 적지 않습니다.",
          explain:
            "의도를 나타내는 어미는 '-려고'이고, 받침 있는 어간 뒤에서는 '-으려고'가 됩니다(먹으려고). 'ㄹ'을 하나 더 얹은 '-ㄹ려고'는 소리 나는 대로 적은 것입니다. 'ㄹ'받침 어간은 원래 이 꼴이 맞습니다(만들려고·살려고).",
          refs: ['한글 맞춤법 제19항'],
        })
        break
      }
    }

    return found
  },
  examples: [
    { wrong: '밥을 시킬려고 했는데 자리가 없었다.', right: '밥을 시키려고 했는데 자리가 없었다.' },
    { wrong: '이걸 어떻게 할려고 그래?', right: '이걸 어떻게 하려고 그래?' },
    { wrong: '영화를 볼려고 예매했다.', right: '영화를 보려고 예매했다.' },
    { wrong: '동생이 밥을 먹을려고 앉았다.', right: '동생이 밥을 먹으려고 앉았다.' },
  ],
  counterExamples: [
    '케이크를 만들려고 재료를 샀다.',
    '이 동네에서 오래 살려고 한다.',
    '동생을 놀려고 부르는 게 아니다.',
    '집을 팔려고 내놓았다.',
    '숫돌에 칼을 갈려고 꺼냈다.',
    '아침에 일찍 일어나려고 알람을 맞췄다.',
  ],
}

/* ────────────────── `-ㄴ지` — 어미인가 의존명사인가 ────────────────── */

/**
 * `주문한지 30분이 → 주문한 지 30분이`.
 *
 * 글자가 같은 두 가지가 있다.
 *
 *   집에 갈지 말지 모르겠다      ← 어미 `-ㄹ지`. 막연한 의문. 붙여 쓴다
 *   밥을 먹은 지 세 시간이 됐다   ← 의존명사 `지`. 지나온 시간. 띄어 쓴다
 *
 * 뜻으로는 또렷이 갈리는데 글자로는 안 갈린다. 그래서 두 가지를 함께 본다.
 *
 * **앞** — 분석기가 `ㄴ지`를 어미로 읽었고, 그 앞이 **용언**이어야 한다.
 * 이 한 가지로 `누군지`(누구/NP + 이/VCP)와 `몇 살인지`(살/NNB + 이/VCP)가 떨어져 나간다.
 * 서술격 조사 뒤의 `-ㄴ지`는 언제나 어미다.
 *
 * **뒤** — 지나온 시간을 재는 말이 이어져야 한다. 다음 어절이 수·기간이고,
 * 그 근처에 `되다·넘다·지나다·만에·밖에·째`가 있어야 한다.
 * 의존명사 `지`는 이 꼴로만 쓰인다 — 뒤에 시간의 길이와 그 길이를 재는 말이 온다.
 */

/** 다음 어절이 지나온 시간의 길이인가. */
const ELAPSED_AMOUNT =
  /^(?:\d|[한두세네]|다섯|여섯|일곱|여덟|아홉|열|스무|몇|얼마|오래|한참|하루|이틀|사흘|나흘|닷새|엿새|보름|며칠|반년|[일이삼사오육칠팔구십])/

/** 그 길이를 재는 말. `되다`의 활용형은 글자가 갈라져 따로 적는다. */
const ELAPSED_MEASURE = /(?:되|된|됐|돼|넘|지나|지났|흐르|흘렀|만에|밖에|째)/

/** 어미 `-ㄴ지`. `-ㄹ지`는 [eomi-lji](../rules/attached.ts)가 맡는다. */
const NJI = new Set(['ㄴ지', '은지'])

/** 용언 어간으로 볼 수 있는 태그. 서술격 조사(VCP)와 부정 지정사(VCN)는 뺀다. */
const VERB_STEM = new Set(['VV', 'VA', 'VX', 'XSV', 'XSA'])

export const morphJiElapsed: MorphRule = {
  id: 'morph-ji-elapsed',
  autoFixSafe: true,
  category: 'spacing',
  severity: 'error',
  confidence: 0.9,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const raw of ctx.words) {
      if (!isPlainHangulWord(raw.text)) continue
      const trimmed = trimTail(raw.text)
      if (!trimmed.endsWith('지') || trimmed.length < 3) continue

      // 문장 안에서는 `시행한지`를 `시행/NNG + 한지/NNG`로 읽어 놓고,
      // 떼어 놓고 물으면 `시행/NNG + 하/XSA + ㄴ지/EF`로 제대로 가른다.
      // 그래서 어미가 안 보이면 한 번 더 물어본다.
      let morphemes = raw.morphemes
      let at = morphemes.findIndex((m) => (m.pos === 'EC' || m.pos === 'EF') && NJI.has(m.text))
      if (at < 1) {
        const solo = groupWords(trimmed, ctx.analyze(trimmed))
        if (solo.length !== 1) continue
        morphemes = solo[0]!.morphemes
        at = morphemes.findIndex((m) => (m.pos === 'EC' || m.pos === 'EF') && NJI.has(m.text))
      }
      if (at < 1) continue
      const word = { ...raw, morphemes: [...morphemes] }
      // 높임 선어말어미는 건너뛴다 — `오신지`는 `오/VV + 시/EP + ㄴ지/EF`다.
      let stem = at - 1
      while (stem > 0 && word.morphemes[stem]!.pos === 'EP') stem -= 1
      if (!VERB_STEM.has(word.morphemes[stem]!.pos)) continue

      const after = ctx.text.slice(word.start + trimmed.length)
      const next = /^[\s,]+(\S+)/.exec(after)?.[1]
      if (!next || !ELAPSED_AMOUNT.test(next)) continue
      if (!ELAPSED_MEASURE.test(after.slice(0, 32))) continue

      found.push({
        start: word.start,
        end: word.start + trimmed.length,
        suggestions: [`${trimmed.slice(0, -1)} 지`],
        message: "지나온 시간을 뜻하는 '지'는 의존명사라 띄어 씁니다.",
        explain:
          "'어떤 일이 있었던 때로부터 지금까지의 동안'을 뜻하는 '지'는 의존명사입니다. 막연한 의문을 나타내는 어미 '-ㄴ지·-ㄹ지'(올지 모르겠다)와 달리 앞말과 띄어 씁니다.",
        refs: ['한글 맞춤법 제42항'],
      })
    }

    return found
  },
  examples: [
    { wrong: '주문한지 30분이 넘었는데 아직도 안 나왔다.', right: '주문한 지 30분이 넘었는데 아직도 안 나왔다.' },
    { wrong: '밥을 먹은지 세 시간이 지났다.', right: '밥을 먹은 지 세 시간이 지났다.' },
    { wrong: '설문을 시행한지 사흘만에 자료를 정리했다.', right: '설문을 시행한 지 사흘 만에 자료를 정리했다.' },
    { wrong: '병원에 갔다 오신지 얼마 안 지났거든.', right: '병원에 갔다 오신 지 얼마 안 지났거든.' },
  ],
  counterExamples: [
    '그게 누군지 한참 지나서 알았다.',
    '몇 살인지 얼마 안 되어 알았다.',
    '내일 비가 올지 안 올지 모르겠다.',
    '이걸 어떻게 설명해야 할지 막막하다.',
    '어디로 갔는지 아무도 모른다.',
    '무엇이 문제인지 두 시간 넘게 따져 봤다.',
  ],
}

/* ────────────────── `-이였다` — 서술격 조사를 겹쳐 적은 것 ────────────────── */

/**
 * `일이였다 → 일이었다`.
 *
 * 서술격 조사 `이다`의 과거형은 `이었다`다. `였-`은 그것이 **모음 뒤에서 줄어든 꼴**이라
 * (학교였다) 받침 있는 말 뒤에는 쓰지 않는다.
 *
 * ## 왜 품사가 필요한가
 *
 * 글자만 보면 `이였`은 두 가지다.
 *
 *   느낌이였다 → 느낌 + 이(조사) + 였  ← 틀렸다. `느낌이었다`
 *   민준이였다 → 민준이(이름) + 였      ← 옳다. 사람 이름에 붙는 `-이`다
 *   종이였다   → 종이 + 였              ← 옳다. `이`가 명사의 끝 음절이다
 *
 * 1층의 [iyeotda-copula](../rules/pyogi.ts)는 아는 명사 목록 뒤에서만 발화해 이 함정을
 * 피했다. 안전하지만 목록에 없는 말은 영영 못 잡는다 — `느낌이였다`가 그랬다.
 *
 * 분석기는 셋을 갈라 준다. 앞말을 `느낌/NNG`·`민준/NNP`으로 나누고,
 * `종이였다`에서는 어미를 아예 `었/EP`으로 읽는다(줄어들기 전 꼴이 `이었`이 아니므로).
 * 그래서 **일반명사 + `이/VCP` + `였/EP`** 라는 세 겹이 맞을 때만 고친다.
 */
export const morphIyeot: MorphRule = {
  id: 'morph-iyeot',
  autoFixSafe: true,
  category: 'ending',
  severity: 'error',
  confidence: 0.93,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const word of ctx.words) {
      if (!isPlainHangulWord(word.text)) continue
      const trimmed = trimTail(word.text)

      for (let i = 1; i < word.morphemes.length - 1; i += 1) {
        const host = word.morphemes[i - 1]!
        const copula = word.morphemes[i]!
        const past = word.morphemes[i + 1]!
        // 고유명사는 뺀다 — 사람 이름 뒤의 `-이`는 조사가 아니라 접미사다.
        if (host.pos !== 'NNG') continue
        if (copula.pos !== 'VCP' || copula.text !== '이') continue
        if (past.pos !== 'EP' || past.text !== '였') continue

        const at = trimmed.lastIndexOf('이였')
        if (at < 1) continue
        // 받침이 없으면 `였`으로 줄어드는 것이 맞다.
        if (!hasFinal(trimmed[at - 1]!)) continue

        found.push({
          start: word.start + at,
          end: word.start + at + '이였'.length,
          suggestions: ['이었'],
          message: "받침 있는 말 뒤에서는 '이었-'으로 적습니다.",
          explain:
            "서술격 조사 '이다'의 과거형은 '이었다'입니다. '였-'은 '이었-'이 모음 뒤에서 줄어든 꼴이라(학교였다) 받침 있는 말 뒤에는 쓰지 않습니다.",
          refs: ['한글 맞춤법 제36항'],
        })
        break
      }
    }

    return found
  },
  examples: [
    { wrong: '오늘 하루가 완전히 망해 버린 느낌이였다.', right: '오늘 하루가 완전히 망해 버린 느낌이었다.' },
    { wrong: '가장 어려운 일이였다.', right: '가장 어려운 일이었다.' },
    { wrong: '그때는 학생이였어요.', right: '그때는 학생이었어요.' },
  ],
  counterExamples: [
    '그 애 이름이 민준이였다.',
    '책상 위에 있던 건 종이였다.',
    '그때만 해도 나는 어린아이였다.',
    '우리는 오래 알고 지낸 사이였다.',
    '내 짝은 지민이였어.',
    '오늘은 아르바이트 첫날이었다.',
  ],
}
