import { decompose, hasFinal } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 어미와 활용.
 *
 * 같은 소리를 내는 두 어미가 뜻만 다른 자리가 많다 — `-던지/-든지`, `-데/-대`.
 * 문자열만 보면 어느 쪽인지 알 수 없으니, 여기 규칙들은 전부
 * **문맥이 한쪽으로 확정되는 좁은 자리**만 고른다.
 *
 *   그러던지 말던지   ← 같은 어미가 나란히 오면 선택이다
 *   얼마나 춥던지     ← 감탄이 앞에 오면 회상이다. 손대지 않는다
 *
 * 활용 쪽은 반대로 **어간이 홀로 설 수 없다**는 사실이 근거다.
 * `않-`은 '아니하-'의 준말 어간이라 어미가 붙어야 하고(부사는 `안`),
 * `되-`도 어미 없이 문장을 끝맺지 못한다(종결형은 `되어`가 줄어든 `돼`).
 */

/* ─────────────────────────── -던지 / -든지 ─────────────────────────── */

export const deunjiChoice = defineRule({
  id: 'deunji-choice',
  autoFixSafe: true,
  category: 'ending',
  confidence: 0.92,
  // 어미 자리의 `-던지`만 본다. 뒤에 음절이 이어지면 '창던지기·던지다'다.
  pattern: /([가-힣])던지(?![가-힣])/g,
  resolve(ctx) {
    const end = ctx.index + ctx.match[0].length
    const before = ctx.text.slice(Math.max(0, ctx.index - 30), ctx.index)
    const after = ctx.text.slice(end, end + 30)

    // 감탄의 '얼마나 -던지'는 회상이다.
    if (/(?:얼마나|어찌나|어쩌면|얼마|하도)[^.!?\n]{0,12}$/.test(before)) return null
    // 회상을 확정 짓는 말이 뒤따르면 넘어간다 — '뭘 먹었던지 기억이 안 난다'.
    if (/(?:기억|모르|몰라|생각|궁금|알 수 없|안 나|떠오르)/.test(after)) return null
    if (/(?:기억|생각|궁금)[^.!?\n]{0,8}$/.test(before)) return null

    // 선택의 나열 — 같은 어미가 앞이나 뒤에 한 번 더 온다.
    const pairAfter = /^[,\s]+(?:[가-힣]+\s+){0,2}[가-힣]{1,7}[던든]지(?![가-힣])/.test(after)
    const pairBefore = /[가-힣]{1,7}[던든]지[,\s]+(?:[가-힣]+\s+){0,2}$/.test(before)
    // '-든지 하다' — 선택지 하나를 고르라는 굳은 구성.
    const withHada = /^\s+(?:하자|하지|하렴|하세요|합시다|해라|하든지|하든가|말자|말든지|말든가)(?![가-힣])/.test(after)
    // 부정 관형사 뒤 — '어떤 업무를 맡든지'.
    const indefinite = /(?:^|[^가-힣])(?:어떤|무슨|아무런)\s+(?:[가-힣]+\s+){0,2}$/.test(before)

    if (!pairAfter && !pairBefore && !withHada && !indefinite) return null
    return {
      suggestions: ['든'],
      offset: 1,
      length: 1,
      message: "선택을 나타내는 어미는 '-든지'입니다.",
      explain:
        "'-든지'는 여럿 가운데 어느 것이어도 상관없다는 뜻이고, '-던지'는 지난 일을 회상하는 어미입니다. 여기서는 선택지가 나열되어 있으므로 '-든지'가 맞습니다.",
      refs: ['한글 맞춤법 제56항'],
    }
  },
  examples: [
    { wrong: '그러던지 말던지 나는 이제 안 갈래.', right: '그러든지 말든지 나는 이제 안 갈래.' },
    { wrong: '끝나고 밥 먹던지 하자.', right: '끝나고 밥 먹든지 하자.' },
    { wrong: '어떤 업무를 맡던지 노력한 만큼 돌아온다고 믿습니다.', right: '어떤 업무를 맡든지 노력한 만큼 돌아온다고 믿습니다.' },
    { wrong: '점심은 김밥을 먹던지 라면을 먹던지 나는 상관없어.', right: '점심은 김밥을 먹든지 라면을 먹든지 나는 상관없어.' },
  ],
  counterExamples: [
    '그날은 얼마나 춥던지 귀가 떨어져 나갈 것 같았다.',
    '발표 때 얼마나 떨렸던지 목소리가 다 갈라졌다.',
    '걔가 그때 왜 그런 말을 했던지 지금도 모르겠다.',
    '그때 뭘 먹었던지 기억이 안 난다.',
    '어디서 봤던지 생각이 나지 않는다.',
    '네가 뭘 하든지 나는 응원할게.',
    '가격이 얼마나 오르든지 간에 나는 그 책을 살 거야.',
    '아이가 얼마나 서럽게 울던지 나까지 눈물이 났다.',
    '창던지기 선수가 결승에 올랐다.',
  ],
})

/* ─────────────────────── '-지 안-' → '-지 않-' ─────────────────────── */

/** `-지`로 끝나는 명사. 뒤의 `안`은 부정이 아니라 '속'이거나 '안다(품다)'이다. */
const NOUN_JI = new Set([
  '강아지', '망아지', '송아지', '바지', '휴지', '단지', '편지', '반지', '가지', '아지', '돼지',
  '봉지', '잡지', '종지', '무지', '이미지', '메시지', '페이지', '표지', '아버지', '소지', '토지',
  '대지', '부지', '현지', '처지', '취지', '폐지', '유지', '오지', '요지', '산지', '습지', '고지',
])
/** `-지` 앞에 오는 용언 어간의 끝 음절. 명사 `-지`와 갈라놓는 관문이다. */
const STEM_BEFORE_JI = new Set([
  '하', '되', '좋', '많', '같', '쉽', '렵', '싸', '늦', '맞', '크', '작', '길', '짧', '옳',
  '밝', '넓', '높', '낮', '깊', '있', '없', '낫', '깝', '흔', '급', '얇', '껍', '겁', '볍',
  '갑', '럽', '맵', '춥', '덥', '쁘', '흐',
])
/** `않-`이 확실한 자리. 여기서는 `안`이 명사·동사로 읽힐 여지가 없다. */
const SAFE_AFTER = /^(?:도록|으[려면니시]|겠|습니|던)/
/** 명사 `안`(속)과 겹치는 자리. 앞 어간까지 확인해야 한다. */
const GUARDED_AFTER = /^(?:은(?![가-힣])|을(?![가-힣])|아(?![가-힣])|어(?![가-힣])|게(?![가-힣]))/

export const jiAnEomi = defineRule({
  id: 'ji-an-eomi',
  autoFixSafe: true,
  category: 'spelling',
  confidence: 0.93,
  pattern:
    /([가-힣])지( ?)안(?=도록|으[려면니시]|겠|습니|던|은(?![가-힣])|을(?![가-힣])|아(?![가-힣])|어(?![가-힣])|게(?![가-힣]))/g,
  resolve(ctx) {
    const stem = ctx.match[1] ?? ''
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length)

    // '지'로 끝나는 명사 뒤라면 부정이 아니다 — '강아지 안으면', '봉지 안은'.
    let head = ctx.index + 1
    while (head > 0 && /[가-힣]/.test(ctx.text[head - 1] ?? '')) head -= 1
    if (NOUN_JI.has(ctx.text.slice(head, ctx.index + 2))) return null

    if (!SAFE_AFTER.test(rest)) {
      if (!GUARDED_AFTER.test(rest)) return null
      if (!STEM_BEFORE_JI.has(stem)) return null
    }
    return {
      suggestions: ['지 않'],
      offset: 1,
      length: ctx.match[0].length - 1,
      message: "부정의 보조용언은 '않-'입니다.",
      explain:
        "'-지 아니하다'가 줄어든 형태가 '-지 않다'입니다. '않-'은 어미가 바로 붙는 어간이고, 홀로 쓰이는 부사 '안'과는 다릅니다.",
      refs: ['한글 맞춤법 제39항'],
    }
  },
  examples: [
    { wrong: '늦지 안도록 저도 힘쓰겠습니다.', right: '늦지 않도록 저도 힘쓰겠습니다.' },
    { wrong: '분석이 충분하지 안은 점은 한계로 남는다.', right: '분석이 충분하지 않은 점은 한계로 남는다.' },
    { wrong: '실수하지 안으려고 할수록 손이 더 떨렸다.', right: '실수하지 않으려고 할수록 손이 더 떨렸다.' },
    { wrong: '그렇게 하지안으면 안 됩니다.', right: '그렇게 하지 않으면 안 됩니다.' },
  ],
  counterExamples: [
    '겁먹은 강아지 안으면 금세 얌전해진다.',
    '정육점에서 돼지 안심을 500그램 샀다.',
    '내일 비가 올지 안 올지 모르겠다.',
    '봉지 안은 텅 비어 있었다.',
    '바지 안으로 셔츠를 넣어 입었다.',
    '편지 안에 사진이 들어 있었다.',
    '별로 좋지 않았다.',
    '늦지 않도록 서둘렀다.',
  ],
})

/* ────────────────────── 남의 말을 옮기는 '-대' ────────────────────── */

export const daeQuotativeVerb = defineRule({
  id: 'dae-quotative-verb',
  autoFixSafe: true,
  category: 'ending',
  confidence: 0.88,
  // 동사에는 '-ㄴ데'가 붙지 못한다 — '되는데·오는데'가 맞다.
  // 그래서 문장을 끝맺는 '된데·온데'는 남의 말을 옮기는 '-대'를 잘못 적은 것이다.
  pattern: /(?<![가-힣])(?:안 ?된데|(?:눈|비|태풍|한파|장마|소나기|우박)(?:이|가)\s*온데)(?=[.?!~…]|$)/g,
  resolve(ctx) {
    const doen = ctx.match[0].endsWith('된데')
    return {
      suggestions: doen ? ['된대', '되는데'] : ['온대', '오는데'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "남에게 들은 말을 옮길 때는 '-대'를 씁니다.",
      explain:
        "'-대'는 '-다고 해'가 줄어든 말로 남에게 들은 말을 전할 때 쓰고, '-데'는 말하는 이가 직접 겪은 일을 전할 때 씁니다. 게다가 동사에는 '-ㄴ데'가 붙지 못하므로('되는데·오는데') 이 자리의 '-ㄴ데'는 어느 쪽으로도 성립하지 않습니다.",
      refs: ['표준어 규정 제17항'],
    }
  },
  examples: [
    { wrong: '담임쌤 말씀이 내일은 지각하면 안 된데.', right: '담임쌤 말씀이 내일은 지각하면 안 된대.' },
    { wrong: '여기서는 사진 찍으면 안된데.', right: '여기서는 사진 찍으면 안된대.' },
    { wrong: '뉴스에서 봤는데 내일부터 눈이 온데.', right: '뉴스에서 봤는데 내일부터 눈이 온대.' },
  ],
  counterExamples: [
    '지훈이 말로는 쉽다던데, 어제 직접 풀어 보니 정말 어렵데.',
    '그렇게 하면 안 되는데 어쩌지.',
    '아무리 해도 안 된다.',
    '고장 난 데가 어디인지 모르겠다.',
    '어제 비가 온 데는 여기뿐이다.',
    '내일부터 눈이 온다고 한다.',
  ],
})

/* ───────────────────────────── 병은 낫는다 ───────────────────────────── */

/** `낫다`는 ㅅ 불규칙이라 모음 어미 앞에서 받침이 준다 — 낫+았 → 나았. */
const NAT_FORMS: Record<string, string> = {
  았: '나았', 아: '나아', 으: '나으', 은: '나은', 을: '나을',
  는: '낫는', 고: '낫고', 지: '낫지', 겠: '낫겠', 기: '낫기', 더: '낫더', 도: '낫도',
}

export const natdaIllness = defineRule({
  id: 'natda-illness',
  autoFixSafe: true,
  category: 'confusable',
  confidence: 0.94,
  // 병증 명사가 앞에 붙어 있을 때만 본다. 그래야 출산의 '낳다'를 건드리지 않는다.
  pattern:
    /(?:감기|목감기|몸살감기|몸살|독감|장염|배탈|위염|비염|편도염|병환|병|상처|고열|열|기침|콧물|두통|치통|증상)(?:은|는|이|가|도|를|을)?\s+(?:[가-힣]+\s+){0,2}낳([았아으은을는고지겠기더도])/g,
  resolve(ctx) {
    const right = NAT_FORMS[ctx.match[1] ?? '']
    if (!right) return null
    // 출산을 말하는 자리면 '낳다'가 맞다.
    const window = ctx.text.slice(Math.max(0, ctx.index - 20), ctx.index + ctx.match[0].length + 10)
    if (/아기|애기|아이|딸|아들|쌍둥이|출산|임신|새끼|산모|둘째|셋째|알을/.test(window)) return null
    return {
      suggestions: [right],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "병이 고쳐지는 것은 '낫다'입니다.",
      explain:
        "'낫다'는 병이나 상처가 고쳐지는 것이고 '낳다'는 아이나 알을 몸 밖으로 내놓는 것입니다. '낫다'는 ㅅ 불규칙이라 '낫- + -았-'이 '나았-'이 됩니다.",
      refs: ['한글 맞춤법 제18항'],
    }
  },
  examples: [
    { wrong: '너 감기는 다 낳았어?', right: '너 감기는 다 나았어?' },
    { wrong: '약을 먹었더니 감기가 금방 낳았다.', right: '약을 먹었더니 감기가 금방 나았다.' },
    { wrong: '감기 얼른 낳으세요! 푹 쉬시고요.', right: '감기 얼른 나으세요! 푹 쉬시고요.' },
    { wrong: '상처가 다 낳은 뒤에 다시 운동을 시작했다.', right: '상처가 다 나은 뒤에 다시 운동을 시작했다.' },
  ],
  counterExamples: [
    '우리 집 고양이가 어젯밤에 새끼를 낳았다.',
    '무리한 일정 강행이 결국 대형 사고를 낳았다.',
    '친구가 어젯밤에 건강한 딸을 낳았다.',
    '예쁜 딸 낳으세요, 산모님도 건강하시고요.',
    '이모가 어제 딸을 낳았어',
    '감기 걸린 친구가 어제 아이를 낳았다.',
  ],
})

/* ───────────────────── 비교 대상이 붙은 '틀리다' ───────────────────── */

/** `틀리다`는 규칙 활용, `다르다`는 르 불규칙이라 어간이 통째로 바뀐다. */
const DAREU_FORMS: Record<string, string> = {
  리: '다르', 려: '달라', 렸: '달랐', 린: '다른', 립: '다릅', 림: '다름',
}

export const teulliCompare = defineRule({
  id: 'teulli-compare',
  autoFixSafe: true,
  category: 'confusable',
  confidence: 0.92,
  // 비교 대상이 '~와/과/랑'으로 앞에 붙어 있는 자리만 본다.
  pattern:
    /[가-힣]+(?:이랑|랑|와|과|하고)\s+(?:[가-힣]+(?:이|가|은|는)\s+){0,2}(?:(?:너무|아주|많이|완전히|완전|좀|조금|전혀|하나도|서로|약간|되게|엄청|참|정말|영)\s+)?틀([리려렸린립림])/g,
  resolve(ctx) {
    const right = DAREU_FORMS[ctx.match[1] ?? '']
    if (!right) return null
    const end = ctx.index + ctx.match[0].length
    // 셈이나 답이 그르다는 뜻이면 '틀리다'가 맞다.
    if (/답|정답|오답|계산|셈|맞춤법|철자|표기|표현|문법|채점|점수|풀이|번호|숫자|문제/.test(ctx.text.slice(Math.max(0, ctx.index - 12), end + 12))) return null
    // '틀려먹다'는 사람됨이 글렀다는 뜻의 한 단어다.
    if (ctx.text.slice(end, end + 1) === '먹') return null
    return {
      suggestions: [right],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "두 대상을 견주어 같지 않다는 뜻은 '다르다'입니다.",
      explain:
        "'틀리다'는 셈이나 사실이 그르게 되는 것이고, 비교한 둘이 같지 않다는 뜻은 '다르다'입니다. 앞에 비교 대상이 '~와/과/랑'으로 붙어 있으므로 '다르다'가 맞습니다.",
      refs: ['표준국어대사전'],
    }
  },
  examples: [
    { wrong: '사진이랑 실물이 너무 틀려서 할 말이 없더라.', right: '사진이랑 실물이 너무 달라서 할 말이 없더라.' },
    { wrong: '작년과 올해가 완전히 틀렸다.', right: '작년과 올해가 완전히 달랐다.' },
    { wrong: '형이랑 나는 성격이 틀리다.', right: '형이랑 나는 성격이 다르다.' },
  ],
  counterExamples: [
    '계산이 틀려서 답을 다시 구했다.',
    '그 사람은 성격이 애초에 틀려먹었다는 평을 듣는다.',
    "맞춤법 강의에서 '되요'와 '됬'은 어떤 경우에도 틀린 표기라고 배웠다.",
    '1번과 2번 답이 틀려서 감점을 당했다.',
    '이 문제는 답이 틀려서 다시 풀었다.',
  ],
})

/* ──────────────── 서술격 조사는 앞말에 붙인다 ──────────────── */

export const seosulDetached = defineRule({
  id: 'seosul-detached',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.93,
  // '였-·이었-·입니다'로 시작하는 낱말은 국어에 없다. 앞에 공백이 있으면 갈라 쓴 것이다.
  pattern: /([가-힣0-9])[ \t]+(였|이었|입니다|입니까|이에요)/g,
  resolve(ctx) {
    const prev = ctx.match[1] ?? ''
    const ending = ctx.match[2] ?? ''
    // '이었-'으로 시작하는 낱말이 하나 있다 — ㅅ불규칙 용언 '잇다'의 활용형(잇+었+다).
    // 서술격 조사 '이다'는 체언에 붙으므로 **목적격 조사 뒤에는 절대 오지 못한다.**
    // 그 자리의 '이었다'는 언제나 '잇다'다. 이것은 목록이 아니라 통사 조건이라 뚫리지 않는다.
    // ('뒤를 이었다·가업을 이었다·말을 이었다')
    if (ending === '이었' && (prev === '을' || prev === '를')) return null
    return {
      suggestions: [`${prev}${ending}`],
      subId: ending,
      message: "서술격 조사 '이다'의 활용형은 앞말에 붙여 씁니다.",
      explain:
        "'였-·이었-·입니다'는 서술격 조사 '이다'가 활용한 것입니다. 조사는 앞말에 붙여 쓰며, 이런 꼴로 시작하는 낱말은 국어에 없습니다.",
      refs: ['한글 맞춤법 제41항'],
    }
  },
  examples: [
    { wrong: '표본의 과반수 이상이 20대 였고, 그중 절반은 인근 주민이었다.', right: '표본의 과반수 이상이 20대였고, 그중 절반은 인근 주민이었다.' },
    { wrong: '제가 맡은 일은 회계 였습니다.', right: '제가 맡은 일은 회계였습니다.' },
    { wrong: '저는 신입 사원 입니다.', right: '저는 신입 사원입니다.' },
  ],
  counterExamples: [
    '주말마다 방을 깨끗이 치우는 습관을 들였다.',
    '창문 밖에 눈이 소복하게 쌓였다.',
    '봉사 시간은 졸업까지 총 120시간 정도였습니다.',
    '표본의 과반수 이상이 20대였고, 그중 절반은 인근 주민이었다.',
    '옷을 두껍게 입습니다.',
    '동생이 형의 뒤를 이었다.',
    '삼대째 가업을 이었다.',
    '그는 한참 뒤에야 말을 이었다.',
    '끊어진 줄을 이었다.',
  ],
})

/* ─────────── '이였' — 서술격 조사를 겹쳐 적은 것 ─────────── */

/*
 * `seosul-iyeot`은 여기 없다.
 *
 * `-이였다 → -이었다`는 [pyogi.ts](./pyogi.ts)의 `iyeotda-copula`가 맡는다.
 * 처음에는 이 파일에도 같은 규칙을 두었는데, 그쪽은 `종이·고양이`를 막는 **블록리스트**라
 * 한국 사람 이름을 막지 못했다 — `민준이였다`, `지민이였다`가 걸렸다.
 * 받침 + `이`로 끝나는 이름은 끝없이 만들 수 있어 블록리스트로는 닫히지 않는 집합이다.
 * `iyeotda-copula`는 반대로 **아는 명사 뒤에서만** 발화하는 화이트리스트라 그 문제가 없다.
 */

/* ──────────── '-어야 되' — 어간은 홀로 끝맺지 못한다 ──────────── */

/** 어미 `-아/-어야`가 붙으려면 앞 음절이 받침 없는 ㅏ/ㅐ/ㅓ/ㅕ/ㅘ/ㅙ/ㅝ여야 한다. */
const EOYA_VOWELS = new Set(['ㅏ', 'ㅐ', 'ㅓ', 'ㅕ', 'ㅘ', 'ㅙ', 'ㅝ'])

export const bojoEoyaDwae = defineRule({
  id: 'bojo-eoya-dwae',
  category: 'spacing',
  confidence: 0.93,
  // 어절이 '되'로 끝나는 자리. 뒤에 어미가 이어지는 '되고·된다'는 bojo-eoya-doeda가 맡는다.
  pattern: /([가-힣])야( ?)되(?![가-힣])/g,
  resolve(ctx) {
    const jamo = decompose(ctx.match[1] ?? '')
    if (!jamo || jamo.tail !== '' || !EOYA_VOWELS.has(jamo.vowel)) return null
    if ((ctx.match[2] ?? '') === ' ') {
      return {
        suggestions: ['돼'],
        offset: 3,
        length: 1,
        message: "문장을 끝맺는 자리에서는 '돼'가 맞습니다.",
        explain:
          "'돼'는 '되어'가 줄어든 말입니다. 어간 '되-'는 어미 없이 홀로 설 수 없습니다. '하/해'를 넣어 보면 '해'가 들어갈 자리입니다.",
        refs: ['한글 맞춤법 제35항 [붙임 2]'],
      }
    }
    return {
      suggestions: ['야 돼'],
      offset: 1,
      length: 2,
      message: "보조용언 '되다'는 띄어 쓰고, 끝맺는 자리에서는 '돼'로 적습니다.",
      explain:
        "'-아/-어야 되다'의 '되다'는 보조용언이라 띄어 씁니다. 제47항이 붙여 쓰기를 허용하는 것은 '-아/-어' 뒤뿐입니다. 그리고 어간 '되-'는 홀로 끝맺지 못하므로 '되어'가 줄어든 '돼'로 적습니다.",
      refs: ['한글 맞춤법 제47항', '한글 맞춤법 제35항 [붙임 2]'],
    }
  },
  examples: [
    { wrong: '약은 꼭 챙겨 먹어야되.', right: '약은 꼭 챙겨 먹어야 돼.' },
    { wrong: '이거 지금 해야 되?', right: '이거 지금 해야 돼?' },
    { wrong: '내일까지 다 끝내야되!', right: '내일까지 다 끝내야 돼!' },
  ],
  counterExamples: [
    '평균이 90점은 돼야 한다.',
    '내일까지는 이 일을 끝내야 된다.',
    '지금 출발해야 된다고 재촉했다.',
    '나도 기다려야 되는 건 참는데 서비스가 이러면 안 되지.',
    '분야를 넓혀야 한다.',
    '철수야 학교 가자.',
    '쌀은 다 해서 몇 되?',
  ],
})

export const eomiHwaryongRules: Rule[] = [
  deunjiChoice,
  jiAnEomi,
  daeQuotativeVerb,
  natdaIllness,
  teulliCompare,
  seosulDetached,
  bojoEoyaDwae,
]
