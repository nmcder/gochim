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
        let fixed: string | null = null

        if (m.text.startsWith('ㄹ')) {
          if (finalOf(last) !== 'ㄹ') break
          // ㄹ받침을 떼면 원래 어간이 나온다 — `시킬` → `시키`.
          const bare = stripFinal(last)
          if (bare == null) break
          // 그 ㄹ받침 꼴이 실제 용언이면(`갈다`) 두 갈래가 다 살아 있는 자리다.
          const probe = groupWords(head + '다', ctx.analyze(head + '다'))
          const first = probe[0]?.morphemes[0]
          if (first && first.text === head && VERBAL.has(first.pos)) break
          fixed = head.slice(0, -1) + bare + surfaceTail
        } else {
          // `먹을려고` → `먹으려고`. 받침 있는 어간 뒤 매개모음은 `으`다.
          //
          // **이 가지는 오래 죽어 있었다.** `을`은 바로 위에서 `surfaceTail`로 떼어 냈는데
          // 여기서 `head`의 마지막 글자가 `을`인지를 물었다. 이미 없는 글자를 찾으니
          // 언제나 빠져나갔고, 그래서 `입을려고·않을려고·읽을려고·앉을려고`는
          // 영영 걸리지 않았다 — 목록에 든 `먹을려고` 하나만 1층이 잡고 있었다.
          // 조용한 고장이라 예시가 통과하는 것만 보고는 알 수 없다.
          if (!hasFinal(last)) break
          fixed = `${head}으${surfaceTail.slice(1)}`
        }

        if (fixed == null) break
        found.push({
          start: raw.start,
          end: raw.start + trimmed.length,
          suggestions: [fixed],
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
    // 아래 넷은 `을려고` 가지가 죽어 있는 동안 어느 층도 잡지 못했다.
    { wrong: '옷을 입을려고 꺼냈다.', right: '옷을 입으려고 꺼냈다.' },
    { wrong: '가지 않을려고 버텼다.', right: '가지 않으려고 버텼다.' },
    { wrong: '책을 읽을려고 폈다.', right: '책을 읽으려고 폈다.' },
    { wrong: '앉을려고 자리를 봤다.', right: '앉으려고 자리를 봤다.' },
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

/* ────────────────── `-구요` — 연결어미 `-고`가 흐려진 것 ────────────────── */

/**
 * `먹었구요 → 먹었고요`.
 *
 * 연결어미는 `-고`다. 뒤에 높임의 보조사 `요`가 붙어도 그대로 `-고요`로 적는다.
 * 말할 때 `-구요`로 흐려지는 것을 그대로 옮겨 적는 일이 아주 잦다.
 *
 * ## 왜 목록이 닫히지 않았나
 *
 * 1층은 두 갈래로 나눠 막고 있었다 — [eomi-guyo](../rules/endings.ts)는 앞 음절이
 * **ㅆ받침일 때만**(`났구요·했구요`), [lexicon](../rules/lexicon.ts)은 어간 다섯 개를
 * 손으로 적어(`하구요·되구요·있구요·없구요·좋구요`). 둘 다 좁힐 수밖에 없었던 이유는 같다.
 *
 *   저건 제 친구요 · 이건 청소 도구요 · 거실에 둘 가구요 · 여기가 대구요
 *
 * `구요`로 끝나는 어절은 **명사 + 보조사 `요`**인 자리가 오히려 더 많다.
 * 어간을 적어 나가는 방식으로는 `아프구요·춥구요·바쁘구요·학생이구요`가 영영 안 걸린다.
 *
 * ## 품사로는 한 줄이다
 *
 * 분석기가 `구`를 **연결어미(EC)**로 읽었는가만 보면 된다.
 *
 *   먹었구요  → 먹/VV + 었/EP + 구/EC + 요/JX     ← 어미다. 고친다
 *   학생이구요 → 학생/NNG + 이/VCP + 구/EC + 요/JX  ← 어미다. 고친다
 *   친구요    → 친구/NNG + 요/JX                   ← `구`가 명사의 끝 음절이다
 *   가구요    → 가구/NNG + 요/JX                   ← 같다
 *   대구요    → 대구/NNP + 이/VCP + 요/EF          ← 같다
 *
 * 반례 넷이 조건 하나로 함께 떨어져 나간다. 목록을 채울 자리가 없다.
 */
export const morphGuyo: MorphRule = {
  id: 'morph-guyo',
  autoFixSafe: true,
  category: 'ending',
  severity: 'error',
  confidence: 0.93,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const word of ctx.words) {
      if (!isPlainHangulWord(word.text)) continue
      const trimmed = trimTail(word.text)
      // 어미가 흐려진 것이라 겉으로도 반드시 `구요`로 끝난다. 줄어들지 않는다.
      if (!trimmed.endsWith('구요') || trimmed.length < 3) continue

      const ms = word.morphemes
      const at = ms.findIndex(
        (m, i) => m.pos === 'EC' && m.text === '구' && ms[i + 1]?.pos === 'JX' && ms[i + 1]?.text === '요',
      )
      // 앞에 어간이 있어야 한다. 어절이 어미로 시작할 수는 없다.
      if (at < 1) continue

      found.push({
        start: word.start + trimmed.length - 2,
        end: word.start + trimmed.length,
        suggestions: ['고요'],
        message: "연결어미는 '-고'라서 '-고요'로 적습니다.",
        explain:
          "연결어미 '-고'에 높임의 보조사 '요'가 붙은 말입니다. '-구요'는 말할 때 소리가 흐려진 것이라 적을 때는 '-고요'로 씁니다.",
        refs: ['한글 맞춤법 제34항'],
      })
    }

    return found
  },
  examples: [
    { wrong: '밥은 먹었구요?', right: '밥은 먹었고요?' },
    { wrong: '날씨도 좋구요.', right: '날씨도 좋고요.' },
    { wrong: '저는 학생이구요, 동생은 중학생이에요.', right: '저는 학생이고요, 동생은 중학생이에요.' },
    { wrong: '요즘 많이 바쁘구요.', right: '요즘 많이 바쁘고요.' },
    { wrong: '방이 좀 춥구요.', right: '방이 좀 춥고요.' },
  ],
  counterExamples: [
    '저건 제 친구요.',
    '이건 청소 도구요.',
    '거실에 둘 가구요.',
    '여기가 대구요.',
    '그건 낡은 공구요.',
    // '만두구요'는 반례가 아니라 오류다 — 서술격 조사가 줄어든 '만두(이)구요'라
    // '만두고요'가 맞다. 반례를 지으려다 규칙이 그것을 잡아내 알았다.
    '아버지가 물려주신 낡은 기구요.',
  ],
}

/* ────────────────── `-이여서` — 서술격 조사를 줄이면 안 되는 자리 ────────────────── */

/**
 * `학생이여도 → 학생이어도`.
 *
 * 위 [morphIyeot](#morphIyeot)과 **같은 하나의 규칙**이 다른 어미에서 드러난 것이다.
 * 서술격 조사 `이다`의 활용에서 `여-`는 `이어-`가 **모음 뒤에서 줄어든 꼴**이라
 * (학교여서·바다여도) 받침 있는 말 뒤에는 쓰지 않는다.
 *
 * ## 겉모양이 같은 두 가지
 *
 *   학생이여도 → 학생 + 이(조사) + 여도   ← 틀렸다. `학생이어도`
 *   종이여서   → 종이 + (이) + 여서       ← 옳다. 조사가 줄어든 것이다
 *
 * 겉으로는 둘 다 `…이여…`인데, 뒤엣것의 `이`는 **명사의 끝 음절**이고 조사는 줄어들어
 * 보이지 않는다. 그래서 **겉에서 `이여`의 앞 글자를 보면 안 된다** — `종`에도 받침이 있어
 * 그대로 재면 맞는 글을 고친다.
 *
 * 봐야 할 것은 **앞 형태소 자신의 끝 음절**이다. `종이/NNG`의 끝은 `이`라 받침이 없고,
 * `학생/NNG`의 끝은 `생`이라 받침이 있다. 분석기가 명사를 통째로 주므로 이건 그냥 읽으면 된다.
 *
 * 고유명사는 뺀다 — 사람 이름 뒤의 `-이`는 조사가 아니라 접미사다(`민준이여서`).
 */

/** 서술격 조사가 붙을 수 있는 앞말. 고유명사(NNP)는 일부러 뺀다. */
const COPULA_HOST = new Set(['NNG', 'NNB', 'XSN', 'NR'])

export const morphIyeo: MorphRule = {
  id: 'morph-iyeo',
  // 자동 적용은 아직 선언하지 않는다. 표본에서 이 오류를 한 번도 만난 적이 없어
  // "조용해서 안 걸린 것"과 "정말 안전한 것"을 아직 가를 수 없다. 밑줄로는 그대로 보인다.
  category: 'ending',
  severity: 'error',
  confidence: 0.92,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const word of ctx.words) {
      if (!isPlainHangulWord(word.text)) continue
      const trimmed = trimTail(word.text)

      for (let i = 1; i < word.morphemes.length - 1; i += 1) {
        const host = word.morphemes[i - 1]!
        const copula = word.morphemes[i]!
        const tail = word.morphemes[i + 1]!
        if (copula.pos !== 'VCP' || copula.text !== '이') continue
        if (!COPULA_HOST.has(host.pos)) continue
        if (tail.pos !== 'EC' && tail.pos !== 'EF') continue
        if (!tail.text.startsWith('여')) continue

        // **앞 형태소 자신의** 끝 음절을 본다. 겉에서 재면 `종이여서`가 걸린다.
        const hostLast = host.text[host.text.length - 1]
        if (!hostLast || !hasFinal(hostLast)) continue

        // 받침이 있으면 조사가 줄어들 수 없으므로 겉에도 `이여`가 그대로 적혀 있다.
        const at = trimmed.lastIndexOf('이여')
        if (at < 1) continue

        found.push({
          start: word.start + at,
          end: word.start + at + '이여'.length,
          suggestions: ['이어'],
          message: "받침 있는 말 뒤에서는 '이어-'로 적습니다.",
          explain:
            "서술격 조사 '이다'가 활용한 '이어서·이어도'에서 '여-'는 모음 뒤에서 줄어든 꼴이라(학교여서) 받침 있는 말 뒤에는 쓰지 않습니다.",
          refs: ['한글 맞춤법 제36항'],
        })
        break
      }
    }

    return found
  },
  examples: [
    { wrong: '내용이 추상적이여서 어렵다.', right: '내용이 추상적이어서 어렵다.' },
    { wrong: '중요한 일이여서 미뤘다.', right: '중요한 일이어서 미뤘다.' },
    { wrong: '학생이여도 괜찮다.', right: '학생이어도 괜찮다.' },
    { wrong: '처음이여서 그래요.', right: '처음이어서 그래요.' },
  ],
  counterExamples: [
    '그 애 이름이 민준이여서 헷갈렸다.',
    '책상 위에 있던 건 종이여서 찢어졌다.',
    '오늘이 마지막 날이어서 아쉽다.',
    '방학이라 학교여서 아무도 없었다.',
    '우리가 처음 만난 곳은 바다여서 기억에 남는다.',
    '그때는 학생이어서 돈이 없었다.',
  ],
}

/* ────────────────── `-드-` — 회상의 `-더-`가 흐려진 것 ────────────────── */

/**
 * `먹드라 → 먹더라`.
 *
 * 지난 일을 떠올려 말하는 선어말어미는 `-더-`다. `-드-`라는 어미는 국어에 없다.
 * 말할 때 흐려지는 것을 그대로 옮겨 적으면 `먹드라·하드니·오드라도·크드라고`가 된다.
 *
 * 1층에서 이걸 잡으려면 `드라·드니·드라고·드라도·드군…`을 어간마다 곱해 적어야 하는데,
 * 그러면 `드라마·드럼·드리다·드물다`처럼 `드`로 시작하는 멀쩡한 말과 부딪힌다.
 *
 * 분석기는 이 자리를 **어미로 읽었는지**만 알려 주면 된다. 어미로 읽힌 `드…`는
 * 표준 어미 목록에 없는 것이므로 언제나 `더…`가 맞다. 어간이나 명사로 읽힌 `드`는
 * 애초에 이 조건에 들어오지 않는다.
 *
 * `-든지·-든`은 건드리지 않는다. 첫 음절이 `든`이지 `드`가 아니다.
 */
export const morphDeo: MorphRule = {
  id: 'morph-deo',
  // 위와 같다 — 표본에 이 오류가 없다. 정탐 근거가 생기면 그때 올린다.
  category: 'ending',
  severity: 'error',
  confidence: 0.9,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const word of ctx.words) {
      if (!isPlainHangulWord(word.text)) continue
      const trimmed = trimTail(word.text)

      for (let i = 1; i < word.morphemes.length; i += 1) {
        const m = word.morphemes[i]!
        if (m.pos !== 'EC' && m.pos !== 'EF') continue
        if (!m.text.startsWith('드')) continue
        // 앞은 어간이거나 선어말어미여야 한다.
        const prev = word.morphemes[i - 1]!
        if (!VERB_STEM.has(prev.pos) && prev.pos !== 'EP' && prev.pos !== 'VCP') continue

        // 어미는 줄어들지 않아 겉에 그대로 드러난다.
        const at = trimmed.indexOf(m.text, 1)
        if (at < 1) continue

        found.push({
          start: word.start + at,
          end: word.start + at + 1,
          suggestions: ['더'],
          message: "지난 일을 떠올릴 때 쓰는 어미는 '-더-'입니다.",
          explain:
            "겪은 일을 떠올려 말하는 선어말어미는 '-더-'입니다('먹더라·가더니'). '-드-'는 말할 때 소리가 흐려진 것이라 적을 때는 쓰지 않습니다. 선택을 나열하는 '-든지·-든'과는 다른 말입니다.",
          refs: ['한글 맞춤법 제56항'],
        })
        break
      }
    }

    return found
  },
  examples: [
    { wrong: '어제 보니까 잘 먹드라.', right: '어제 보니까 잘 먹더라.' },
    { wrong: '그렇게 하드니 결국 지쳤다.', right: '그렇게 하더니 결국 지쳤다.' },
    { wrong: '비가 오드라도 간다.', right: '비가 오더라도 간다.' },
    { wrong: '키가 많이 크드라고요.', right: '키가 많이 크더라고요.' },
  ],
  counterExamples: [
    '어제 본 드라마가 재미있었다.',
    '동생이 드럼을 배우기 시작했다.',
    '선물을 드리려고 준비했다.',
    '요즘은 그런 일이 드물다.',
    '먹든지 말든지 알아서 해라.',
    '어제 보니까 잘 먹더라.',
  ],
}
