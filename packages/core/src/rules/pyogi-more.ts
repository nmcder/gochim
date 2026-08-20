import { defineLexicon } from './define.js'
import type { Rule } from '../types.js'

/**
 * 표기 사전 — 소리 나는 대로 적어 굳어 버린 말들.
 *
 * 전부 **문맥이 필요 없는 문자열 교체**다. 어느 문장에 나오든 표준 표기가 하나뿐이라
 * 가드가 필요 없고, 그래서 이 갈래가 가장 값싸고 안전하다.
 *
 * 위험은 딱 하나 — **다른 낱말 안에 우연히 들어가는 것**이다.
 * `같애`는 `같애다`라는 말이 없어 안전하지만, `바래`처럼 실재하는 말과 겹치는 것은
 * 여기 넣지 않고 문맥을 보는 [confusable](./lexicon.ts)에 둔다.
 * 겹칠 여지가 있는 항목에는 `atWordEnd`를 붙여 뒤에 한글이 더 붙으면 물러나게 했다.
 */
export const pyogiLexicon = defineLexicon({
  id: 'pyogi',
  category: 'spelling',
  confidence: 0.95,
  entries: [
    {
      wrong: '해맸',
      right: '헤맸',
      display: { wrong: '해매다', right: '헤매다' },
      explain: "표준어는 '헤매다'입니다. '해매다'는 사전에 없는 말입니다.",
      examples: [{ wrong: '길을 몰라 한참 해맸다.', right: '길을 몰라 한참 헤맸다.' }],
    },
    {
      wrong: '해매',
      right: '헤매',
      atWordStart: true,
      display: { wrong: '해매다', right: '헤매다' },
      explain: "표준어는 '헤매다'입니다.",
      examples: [{ wrong: '아직도 해매고 있어?', right: '아직도 헤매고 있어?' }],
      counterExamples: ['오해매듭을 풀었다.'],
    },
    {
      wrong: '머리속',
      right: '머릿속',
      explain:
        "순우리말 합성어에서 앞말이 모음으로 끝나고 뒷말 첫소리가 된소리로 나면 사이시옷을 받쳐 적습니다(제30항). '머리 + 속 → 머릿속'입니다.",
      refs: ['한글 맞춤법 제30항'],
      examples: [{ wrong: '머리속으로 그려 보았다.', right: '머릿속으로 그려 보았다.' }],
    },
    {
      wrong: '나무잎',
      right: '나뭇잎',
      explain: '사이시옷을 받쳐 적습니다(제30항).',
      refs: ['한글 맞춤법 제30항'],
      examples: [{ wrong: '나무잎이 다 떨어졌다.', right: '나뭇잎이 다 떨어졌다.' }],
    },
    {
      wrong: '최대값',
      right: '최댓값',
      explain: '사이시옷을 받쳐 적습니다(제30항). 최솟값·근삿값·꼭짓점도 같습니다.',
      refs: ['한글 맞춤법 제30항'],
      examples: [{ wrong: '최대값을 구했다.', right: '최댓값을 구했다.' }],
    },
    {
      wrong: '최소값',
      right: '최솟값',
      explain: '사이시옷을 받쳐 적습니다(제30항).',
      refs: ['한글 맞춤법 제30항'],
      examples: [{ wrong: '최소값이 얼마인가?', right: '최솟값이 얼마인가?' }],
    },
    {
      wrong: '있짜나',
      right: '있잖아',
      explain: "'-지 않아'가 줄어든 말은 '-잖아'로 적습니다(제39항). 소리 나는 대로 '짜나'로 적지 않습니다.",
      refs: ['한글 맞춤법 제39항'],
      examples: [{ wrong: '야 있짜나, 내일 시간 돼?', right: '야 있잖아, 내일 시간 돼?' }],
    },
    {
      wrong: '짜나',
      right: '잖아',
      // '있짜나'만으로는 '그렇짜나·맞짜나'를 놓친다. 뒤에 한글이 더 붙는 낱말이 없어 통째로 받는다.
      atWordEnd: true,
      explain: "'-지 않아'가 줄어든 말은 '-잖아'로 적습니다(제39항).",
      refs: ['한글 맞춤법 제39항'],
      examples: [{ wrong: '그렇짜나.', right: '그렇잖아.' }],
      counterExamples: ['짜나가는 소리가 났다.'],
    },
    {
      wrong: '같애',
      right: '같아',
      atWordEnd: true,
      explain: "'같다'의 어간 '같-'에 어미 '-아'가 붙어 '같아'가 됩니다. '같애'는 구어 발음일 뿐 표준 활용형이 아닙니다.",
      examples: [{ wrong: '내가 잘못한 것 같애.', right: '내가 잘못한 것 같아.' }],
    },
    {
      wrong: '봽겠',
      right: '뵙겠',
      display: { wrong: '봽다', right: '뵙다' },
      explain: "표준어는 '뵙다'입니다. '봽다'는 사전에 없는 말입니다.",
      examples: [{ wrong: '다음 주에 봽겠습니다.', right: '다음 주에 뵙겠습니다.' }],
    },
    {
      wrong: '봽고',
      right: '뵙고',
      explain: "표준어는 '뵙다'입니다.",
      examples: [{ wrong: '내일 봽고 말씀드리겠습니다.', right: '내일 뵙고 말씀드리겠습니다.' }],
    },
    {
      wrong: '니가',
      right: '네가',
      atWordStart: true,
      atWordEnd: true,
      explain:
        "2인칭 대명사 '너'에 주격 조사 '가'가 붙은 표준형은 '네가'입니다. '니가'는 '내가'와 소리로 구별하려는 구어 표기입니다.",
      examples: [{ wrong: '니가 빌려준 우산 잘 썼어.', right: '네가 빌려준 우산 잘 썼어.' }],
      counterExamples: ['어머니가 오셨다.', '언니가 먼저 갔다.', '할머니가 부르신다.'],
    },
    {
      wrong: '설레임',
      right: '설렘',
      // '설레임'은 아이스크림 상표이기도 하다 — "편의점에서 설레임 하나 사 먹었다".
      // 조사가 바로 붙어 추상명사로 쓰인 자리만 잡는다.
      when: (ctx) => '을를이가은는도에과와으'.includes(ctx.after),
      explain: "기본형이 '설레다'라 명사형은 '설렘'입니다. '설레이다'라는 말은 없습니다.",
      examples: [{ wrong: '늘 설레임을 느꼈습니다.', right: '늘 설렘을 느꼈습니다.' }],
      counterExamples: ['편의점에서 설레임 하나 사 먹었다.'],
    },
    {
      wrong: '역활',
      right: '역할',
      explain: "'역할(役割)'입니다. '활'로 적는 것은 소리에 이끌린 표기입니다.",
      examples: [{ wrong: '사람 사이를 잇는 역활에 관심이 많았습니다.', right: '사람 사이를 잇는 역할에 관심이 많았습니다.' }],
    },
    {
      wrong: '어떻해',
      right: '어떡해',
      explain: "'어떡해'는 '어떻게 해'가 줄어든 말입니다. '어떻해'라는 형태는 없습니다.",
      examples: [{ wrong: '이제 어떻해?', right: '이제 어떡해?' }],
    },
    {
      wrong: '금새',
      right: '금세',
      atWordStart: true,
      atWordEnd: true,
      explain: "'금세'는 '금시(今時)에'가 줄어든 부사입니다. '요새·밤새'와 달리 어원이 '시(時)'라 '세'로 적습니다.",
      examples: [{ wrong: '사진이 금새 잘 나왔다.', right: '사진이 금세 잘 나왔다.' }],
    },
  ],
})

export const pyogiMoreRules: Rule[] = [pyogiLexicon]
