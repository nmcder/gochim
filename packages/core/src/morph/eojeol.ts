import type { Morpheme, MorphFinding, MorphRule, MorphRuleContext, Word } from '../types.js'
import { groupWords, morphemeOffset } from './words.js'

/**
 * 어절 안쪽 띄어쓰기 (3층).
 *
 * 표본을 13편으로 늘리자 못 잡는 오류 107건이 거의 한 갈래로 몰렸다.
 *
 *   물이끓으면 · 기름을두르고 · 눈물이났습니다 · 가게에오시면   조사 + 용언
 *   남은재료는 · 힘든날에는 · 지참하신분은 · 오시는길에         관형사형 어미 + 자립명사
 *   볶고나서 · 먹고나니 · 쓰고나니                              보조용언 `-고 나다`
 *
 * 1층에서는 짝 목록으로밖에 못 잡았다 — `화가나-`, `집에가-`를 하나하나 적는 식이다.
 * 그런 조합은 사실상 무한하다. `물이끓으면`을 잡으려면 `물이`가 명사+조사이고
 * `끓으면`이 용언 활용형임을 알아야 하는데, 그건 품사를 보는 일이다.
 *
 * ## 왜 이 규칙이 안전한가
 *
 * 한 낱말로 굳은 말은 분석기가 **통째로 한 형태소**로 내놓는다. 조사·어미 태그가 아예 안 나온다.
 *
 *   맛있다 → 맛있/VA        (맛/NNG + 있/VA 가 아니다)
 *   화나다 → 화나/VV        (화/NNG + 나/VV 가 아니다)
 *   큰일   → 큰일/NNG       (크/VA + ㄴ/ETM + 일/NNG 이 아니다)
 *   어린이 → 어린이/NNG
 *
 * 그래서 "조사 태그 뒤에 용언 태그가 온다"는 조건 자체가 이미 강한 가드다.
 * 1층에서 블록리스트로 막아야 했던 것들이 여기서는 저절로 걸러진다.
 *
 * ## 부사는 뺐다
 *
 * `살짝볶아·오래끓이면`도 같은 갈래지만 부사만은 사정이 다르다.
 * 분석기가 한 낱말인 `안되다·잘하다·더하다`를 `안/MAG + 되/VV`처럼 쪼갠다.
 * 이쪽은 [busa.ts](../rules/busa.ts)처럼 낱개로 잡는 편이 안전하다.
 */

/** 조사. J로 시작하면 전부 조사다. */
const isJosa = (pos: string) => pos.startsWith('J')

/**
 * 용언. 동사·형용사·보조용언까지만이다.
 *
 * 서술격 조사 `이다`(VCP)와 `아니다`(VCN)는 **넣지 않는다.** 이름은 지정사지만
 * 조사라서 앞말에 붙는다. 넣었다가 `그때뿐이에요`를 `그때뿐 이에요`로 갈랐다.
 */
const VERBAL = new Set(['VV', 'VA', 'VX'])

/**
 * 자립명사. 의존명사(NNB)는 [morph-nnb-spacing](./rules.ts)이 따로 맡는다.
 *
 * 고유명사(NNP)는 뺐다. 사전에 없는 이름은 분석기가 짐작으로 쪼개는데,
 * 그 짐작을 믿고 어절을 가르면 없던 오류가 생긴다.
 * `한내동`을 `하/VX + ㄴ/ETM + 내동/NNP`로 읽고 `한 내동`으로 갈랐던 자리다.
 */
const FREE_NOUN = new Set(['NNG'])

/**
 * 이 어절은 건드리지 않는다.
 *
 * 분석기가 한 낱말을 조사 + 용언으로 쪼개는 자리. 실측으로 찾은 것만 적는다.
 */
const KEEP_JOINED = new Set([
  '이라도', '이라서', '이라며', '이라는', '이란', '이나마', '이야말로',
  '그리하여', '그러하여', '아니라', '아니면', '아니고', '아니어서',
])

/**
 * `-고 나다`의 `나`인가.
 *
 * 보조용언 `나다`는 앞 동작이 끝났음을 나타낸다. 제47항이 붙여쓰기를 허용하는
 * `-아/-어` 뒤가 아니라 `-고` 뒤라서 반드시 띄어 쓴다.
 * `일어나다·태어나다·자라나다`는 한 낱말이라 분석기가 쪼개지 않으므로 여기 오지 않는다.
 */
function isGoNada(word: Word, i: number): boolean {
  const prev = word.morphemes[i - 1]
  const cur = word.morphemes[i]
  return prev?.pos === 'EC' && prev.text === '고' && cur?.pos === 'VX' && cur.text.startsWith('나')
}

/**
 * 어절을 다시 분석해 본다.
 *
 * 분석기는 **문장 안에서** 모르는 어절을 만나면 통째로 미등록 명사 하나로 처리한다.
 *
 *   문장 안: `물이끓으면` → 물이끓으면/NNG            (안이 안 보인다)
 *   따로:    `물이끓으면` → 물/NNG + 이/JKS + 끓/VV + 으면/EC
 *
 * 붙여 쓴 어절이 바로 그 "모르는 말"이라, 문장 분석만 믿으면 정작 고쳐야 할 자리를
 * 통째로 놓친다. 그래서 한 덩어리로 나온 긴 어절은 떼어 내 한 번 더 물어본다.
 */
function reanalyze(ctx: MorphRuleContext, word: Word): readonly Morpheme[] {
  // 이미 여러 형태소로 갈렸으면 그 결과를 믿는다.
  if (word.morphemes.length > 1) return word.morphemes
  const trimmed = word.text.replace(/[\s.,!?…"')\]}]+$/, '')
  // 짧은 말은 미등록이어도 가를 것이 없다.
  if (trimmed.length < 4) return word.morphemes
  const solo = groupWords(trimmed, ctx.analyze(trimmed))
  // 떼어 놓고도 한 덩어리면 진짜 한 낱말이다.
  if (solo.length !== 1) return word.morphemes
  return solo[0]!.morphemes
}

/**
 * 가를 자리를 찾는다.
 *
 * [morphemeOffset](./words.ts)은 앞에서부터 자모를 맞춰 나가다가 불규칙 활용을 만나면
 * 포기한다. `힘들 + ㄴ = 힘든`처럼 어간의 받침이 바뀌면 정렬이 어긋나기 때문이다.
 *
 * 그럴 때는 **뒤에서부터** 센다. 가를 자리 뒤의 형태소를 이어 붙인 것이 어절의 꼬리와
 * 정확히 같으면 그 길이만큼 물러난 자리가 답이다. 정확히 같을 때만 쓰므로
 * 앞쪽이 어떻게 바뀌었든 상관이 없다.
 */
function splitPoint(word: Word, i: number, trimmed: string): number | null {
  const byJamo = morphemeOffset(word, i)
  if (byJamo != null) return byJamo
  const tail = word.morphemes.slice(i).map((m) => m.text).join('')
  if (tail.length === 0 || !trimmed.endsWith(tail)) return null
  return trimmed.length - tail.length
}

/** 어절을 두 조각으로 가르는 진단. 뒤따르는 문장부호는 밑줄에서 뺀다. */
function splitAt(word: Word, at: number, message: string, explain: string): MorphFinding | null {
  const trimmed = word.text.replace(/[\s.,!?…"')\]}]+$/, '')
  if (at <= 0 || at >= trimmed.length) return null
  return {
    start: word.start,
    end: word.start + trimmed.length,
    suggestions: [`${trimmed.slice(0, at)} ${trimmed.slice(at)}`],
    message,
    explain,
    refs: ['한글 맞춤법 제2항'],
  }
}

export const morphEojeolSplit: MorphRule = {
  id: 'morph-eojeol-split',
  category: 'spacing',
  severity: 'error',
  confidence: 0.9,
  run(ctx: MorphRuleContext): MorphFinding[] {
    const found: MorphFinding[] = []

    for (const raw of ctx.words) {
      if (KEEP_JOINED.has(raw.text)) continue
      // 숫자·영문이 섞인 어절은 분석기가 자주 흔들린다.
      if (!/^[가-힣]+[\s.,!?…"')\]}]*$/.test(raw.text)) continue

      const morphemes = reanalyze(ctx, raw)
      if (morphemes.length < 3) continue
      // 다시 분석한 결과를 쓰려면 위치 계산도 그 결과로 해야 한다.
      const word: Word = { ...raw, morphemes: [...morphemes] }

      for (let i = 1; i < word.morphemes.length; i += 1) {
        const prev = word.morphemes[i - 1]!
        const cur = word.morphemes[i]!

        let message = ''
        let explain = ''

        if (isJosa(prev.pos) && VERBAL.has(cur.pos)) {
          message = '조사 뒤의 용언은 띄어 씁니다.'
          explain =
            "형태소 분석 결과 앞말이 '체언 + 조사'이고 뒤가 용언입니다. 조사는 앞말에 붙지만 뒤따르는 용언은 별개의 단어라 띄어 씁니다. ('맛있다·화나다'처럼 한 낱말로 굳은 말은 조사가 없어 여기 걸리지 않습니다)"
        } else if (prev.pos === 'ETM' && FREE_NOUN.has(cur.pos)) {
          message = '관형사형 뒤의 명사는 띄어 씁니다.'
          explain =
            "형태소 분석 결과 앞말이 관형사형 어미(-는/-ㄴ/-ㄹ/-던)로 끝나고 뒤가 자립명사입니다. 둘은 별개의 단어라 띄어 씁니다. ('큰일·어린이'처럼 한 낱말로 굳은 말은 통째로 하나의 명사라 여기 걸리지 않습니다)"
        } else if (isGoNada(word, i)) {
          message = "보조용언 '나다'는 앞말과 띄어 씁니다."
          explain =
            "'-고 나다'는 앞 동작이 끝났음을 나타내는 보조용언 구성입니다. 제47항이 붙여쓰기를 허용하는 것은 '-아/-어' 뒤뿐이라 '-고' 뒤에서는 띄어 씁니다."
        } else {
          continue
        }

        const trimmed = word.text.replace(/[\s.,!?…"')\]}]+$/, '')
        const at = splitPoint(word, i, trimmed)
        if (at == null) continue

        // 뒤 조각이 한 글자면 분석기의 오분석일 공산이 크다.
        // `앞에서`를 `앞/NNG + 에/JKB + 서/VV`로 읽어 `앞에 서`로 가른 자리다.
        // 진짜 용언은 어미가 붙어 두 글자를 넘는다.
        if (trimmed.length - at < 2) continue

        const finding = splitAt(word, at, message, explain)
        if (finding) {
          found.push(finding)
          // 한 어절에서 한 곳만 고친다. 다시 검사하면 남은 자리가 잡힌다.
          break
        }
      }
    }

    return found
  },
  examples: [
    { wrong: '냄비에 물이끓으면 면을 넣는다.', right: '냄비에 물이 끓으면 면을 넣는다.' },
    { wrong: '팬에 기름을두르고 볶는다.', right: '팬에 기름을 두르고 볶는다.' },
    { wrong: '편지를 읽다가 눈물이났습니다.', right: '편지를 읽다가 눈물이 났습니다.' },
    { wrong: '가게에오시면 안내해 드리겠습니다.', right: '가게에 오시면 안내해 드리겠습니다.' },
    { wrong: '남은재료는 냉동실에 넣었다.', right: '남은 재료는 냉동실에 넣었다.' },
    { wrong: '힘든날에는 음악을 듣는다.', right: '힘든 날에는 음악을 듣는다.' },
    { wrong: '재료를 볶고나서 물을 붓는다.', right: '재료를 볶고 나서 물을 붓는다.' },
  ],
  counterExamples: [
    '이번 국이 참 맛있다.',
    '요즘은 재미없다고 느낀다.',
    '혼자 하기에는 힘들다.',
    '아이 얼굴이 빛나다.',
    '그 말에 화나서 자리를 떴다.',
    '큰일을 앞두고 잠이 안 왔다.',
    '어린이 도서관에 다녀왔다.',
    '작은아버지께서 오셨다.',
    '된장을 담갔다.',
    '아침에 일어나기가 힘들다.',
    '동생이 부쩍 자라났다.',
    '이곳에서 태어났다.',
    '학생이라도 예외는 없다.',
    '그게 아니라 이거야.',
    '사랑스러운 아이였다.',
    '생각하기에 따라 다르다.',
    '오래 기다린 보람이 있다.',
  ],
}
