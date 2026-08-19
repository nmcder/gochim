import { compose, decompose, isSyllable } from '../hangul.js';
/**
 * 2층 — 형태소 이상 탐지로 오타를 잡는다.
 *
 * 1층 사전은 우리가 적어 넣은 표기만 안다. 사전에 없는 오타는 영영 못 잡는다.
 * 여기서는 **사전 없이** 잡는다.
 *
 * 원리는 잡음 채널 모형이다.
 *  1. 어절 하나가 수상한지 본다 (분석 비용이 높다 = 억지로 쪼개졌다)
 *  2. 한국인이 실제로 자주 혼동하는 **자모 한 개**를 바꾼 후보들을 만든다
 *  3. 후보를 분석해 본다. 비용이 **눈에 띄게 낮아지면** 그게 원래 쓰려던 말이다
 *
 * ```
 * 어의없다  59.1  어/NNG + 의/JKG + 없/VA + 다/EF     ← 억지로 4조각
 * 어이없다  41.1  어이없/VA + 다/EF                    ← 2조각, 비용 18 낮음
 * ```
 *
 * **점수의 절대값은 쓰지 않는다.** 사람 이름 `김민수가`(44.6)와 오타 `역활을`(44.8)의
 * 범위가 겹치기 때문이다. 오직 후보와의 **차이**만 본다.
 */
/** 이 값보다 비용이 낮은 어절은 아예 후보를 만들지 않는다. 정상 활용형은 대부분 이 아래다. */
const SUSPICION_FLOOR = 42;
/** 후보가 이만큼은 좋아져야 제안한다. 실측에서 오타는 9~20, 실재하는 다른 말은 0~4였다. */
const IMPROVEMENT = 8;
/** 너무 긴 어절은 후보가 폭발하고, 너무 짧으면 근거가 약하다. */
const MIN_LENGTH = 2;
const MAX_LENGTH = 8;
/**
 * 한국인이 실제로 헷갈리는 자모 쌍.
 *
 * 임의의 편집 거리를 쓰지 않는 이유는 분명하다 — 후보가 수백 개로 불어나면
 * 그중 하나는 우연히 점수가 좋아지고, 그게 곧 오탐이다.
 * "소리가 같아서 헷갈리는" 자리만 연다.
 */
const VOWEL_PAIRS = [
    ['ㅐ', 'ㅔ'],
    ['ㅒ', 'ㅖ'],
    ['ㅚ', 'ㅙ'],
    ['ㅙ', 'ㅞ'],
    ['ㅚ', 'ㅞ'],
    ['ㅢ', 'ㅣ'],
    ['ㅢ', 'ㅡ'],
    ['ㅗ', 'ㅜ'],
];
/** 된소리·거센소리 혼동. 소리 나는 대로 적으면서 생긴다. */
const LEAD_PAIRS = [
    ['ㄱ', 'ㄲ'],
    ['ㄷ', 'ㄸ'],
    ['ㅂ', 'ㅃ'],
    ['ㅅ', 'ㅆ'],
    ['ㅈ', 'ㅉ'],
    ['ㄱ', 'ㅋ'],
    ['ㄷ', 'ㅌ'],
    ['ㅂ', 'ㅍ'],
    ['ㅈ', 'ㅊ'],
];
/** 받침은 소리가 뭉개져 특히 자주 틀린다. */
const TAIL_PAIRS = [
    ['', 'ㅅ'],
    ['ㅅ', 'ㅆ'],
    ['ㄷ', 'ㅅ'],
    ['ㅈ', 'ㅅ'],
    ['ㅊ', 'ㅅ'],
    ['ㄱ', 'ㄲ'],
    ['ㅎ', ''],
    ['ㄴ', 'ㄶ'],
    ['ㄹ', 'ㅀ'],
];
function swaps(pairs, value) {
    const out = [];
    for (const [a, b] of pairs) {
        if (value === a)
            out.push(b);
        else if (value === b)
            out.push(a);
    }
    return out;
}
/** 자모 하나만 바꾼 후보들. 한 글자에서 보통 2~5개가 나온다. */
export function candidatesOf(word) {
    const found = new Set();
    for (let i = 0; i < word.length; i += 1) {
        const syllable = word[i];
        const jamo = decompose(syllable);
        if (!jamo)
            continue;
        const variants = [
            ...swaps(LEAD_PAIRS, jamo.lead).map((lead) => compose(lead, jamo.vowel, jamo.tail)),
            ...swaps(VOWEL_PAIRS, jamo.vowel).map((vowel) => compose(jamo.lead, vowel, jamo.tail)),
            ...swaps(TAIL_PAIRS, jamo.tail).map((tail) => compose(jamo.lead, jamo.vowel, tail)),
        ];
        for (const variant of variants) {
            if (variant && variant !== syllable)
                found.add(word.slice(0, i) + variant + word.slice(i + 1));
        }
    }
    return [...found];
}
export const morphTypo = {
    id: 'morph-typo',
    category: 'spelling',
    severity: 'warning',
    confidence: 0.85,
    run(ctx) {
        const score = ctx.score;
        if (!score)
            return [];
        const found = [];
        for (const word of ctx.words) {
            const text = word.text;
            if (text.length < MIN_LENGTH || text.length > MAX_LENGTH)
                continue;
            // 한글만 있는 어절만 본다. 숫자·영문이 섞이면 자모 치환이 의미가 없다.
            if (![...text].every(isSyllable))
                continue;
            const base = score(text);
            if (base < SUSPICION_FLOOR)
                continue;
            let best = null;
            for (const candidate of candidatesOf(text)) {
                const gain = base - score(candidate);
                if (gain < IMPROVEMENT)
                    continue;
                const morphemes = ctx.analyze(candidate).length;
                // 더 그럴듯해졌다면 보통 덜 쪼개진다. 더 잘게 쪼개졌다면 우연이다.
                if (morphemes > word.morphemes.length)
                    continue;
                if (!best || gain > best.gain)
                    best = { text: candidate, gain, morphemes };
            }
            if (!best)
                continue;
            found.push({
                start: word.start,
                end: word.end,
                suggestions: [best.text],
                message: `'${text}'보다 '${best.text}'가 자연스럽습니다.`,
                explain: '사전에 없는 표기는 형태소 분석에서 억지로 잘게 쪼개집니다. 자모 하나를 바꾼 표기가 훨씬 자연스럽게 분석되어 제안합니다.',
                // 개선 폭이 클수록 확신한다. 18 이상이면 사실상 확정이다.
                confidence: Math.min(0.95, 0.8 + (best.gain - IMPROVEMENT) / 40),
            });
        }
        return found;
    },
    examples: [
        { wrong: '진짜 어의없다.', right: '진짜 어이없다.' },
        { wrong: '정말 희안하다.', right: '정말 희한하다.' },
    ],
    counterExamples: [
        '김민수가 먼저 도착했다.',
        '스타벅스에서 만나기로 했다.',
        '넷플릭스를 보다가 잠들었다.',
        '어제는 늦게까지 공부했습니다.',
        '그렇습니다, 제 생각도 같습니다.',
    ],
};
//# sourceMappingURL=typo.js.map