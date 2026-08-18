import { defineLexicon, defineRule } from './define.js';
/**
 * 안 / 않.
 *
 * `안`은 부사(아니)라 홀로 서고 뒤 말과 띄어 쓴다.
 * `않-`은 용언 '아니하다'의 준말 어간이라 반드시 어미가 붙는다.
 * 그래서 `않되`처럼 어미 없이 다른 용언이 붙는 형태는 언제나 틀린다.
 */
export const anAnh = defineLexicon({
    id: 'an-anh',
    category: 'spelling',
    confidence: 0.96,
    entries: [
        {
            wrong: '않되요',
            right: '안 돼요',
            explain: "부정의 '안'은 부사라 띄어 씁니다. 그리고 '되어요'의 준말은 '돼요'입니다.",
            examples: [{ wrong: '지금은 않되요.', right: '지금은 안 돼요.' }],
        },
        { wrong: '않돼요', right: '안 돼요', explain: "'않-'은 어미가 붙어야 하는 어간입니다. 부정의 부사는 '안'입니다." },
        { wrong: '않되서', right: '안 돼서', explain: "'되어서'의 준말 '돼서' 앞에 부정 부사 '안'을 띄어 씁니다." },
        { wrong: '않됩', right: '안 됩', explain: "부정의 '안'은 부사라 뒤 말과 띄어 씁니다." },
        { wrong: '않됐', right: '안 됐', explain: "부정의 '안'은 부사라 뒤 말과 띄어 씁니다." },
        { wrong: '않됬', right: '안 됐', explain: "'됐'은 '되었'의 준말이고, 부정의 '안'은 띄어 씁니다." },
        { wrong: '않돼', right: '안 돼', explain: "'않-'은 홀로 쓰이지 못하는 어간입니다. 부정 부사는 '안'입니다." },
        { wrong: '않되', right: '안 되', explain: "'않-'은 홀로 쓰이지 못하는 어간입니다. 부정 부사는 '안'입니다." },
        {
            wrong: '안하',
            right: '안 하',
            display: { wrong: '안하다', right: '안 하다' },
            atWordStart: true,
            when: (ctx) => ctx.after !== '무', // 안하무인
            explain: "부정의 '안'은 부사입니다. 부사는 뒤 말과 띄어 씁니다.",
            refs: ['한글 맞춤법 제2항'],
            examples: [{ wrong: '숙제를 안하고 놀았다.', right: '숙제를 안 하고 놀았다.' }],
            counterExamples: ['마음이 편안하다.', '조금 불안하지만 해보자.', '정말 미안합니다.', '안하무인으로 굴었다.'],
        },
        {
            wrong: '안해',
            right: '안 해',
            atWordStart: true,
            explain: "부정의 '안'은 부사라 띄어 씁니다.",
            counterExamples: ['그건 좀 미안해.', '많이 불안해 보였다.'],
        },
        {
            wrong: '안했',
            right: '안 했',
            atWordStart: true,
            explain: "부정의 '안'은 부사라 띄어 씁니다.",
            counterExamples: ['정말 미안했어.', '마음이 편안했다.'],
        },
        { wrong: '않할', right: '안 할', explain: "'않-'은 어미가 붙어야 하는 어간입니다. 부정 부사는 '안'이고 띄어 씁니다." },
        { wrong: '않해', right: '안 해', explain: "부정 부사는 '안'이고 뒤 말과 띄어 씁니다." },
        { wrong: '않했', right: '안 했', explain: "부정 부사는 '안'이고 뒤 말과 띄어 씁니다." },
        { wrong: '그렇치', right: '그렇지', explain: "'그렇다'의 어간 '그렇-'에 어미 '-지'가 붙은 형태입니다." },
        { wrong: '않그래도', right: '안 그래도', explain: "부정의 부사 '안'을 띄어 씁니다." },
    ],
});
/**
 * 홀로 선 `않`.
 *
 * `않-`은 '아니하-'의 준말 **어간**이라 어미 없이는 설 수 없다.
 * 뒤에 공백이나 문장부호가 오면 무조건 부사 `안`을 써야 하는 자리다.
 */
export const anhAlone = defineRule({
    id: 'anh-alone',
    category: 'spelling',
    confidence: 0.95,
    pattern: /(?<![가-힣])않(?=[\s,.!?]|$)/g,
    resolve() {
        return {
            suggestions: ['안'],
            message: "홀로 쓰는 부정은 부사 '안'입니다.",
            explain: "'않-'은 '아니하-'의 준말 어간이라 어미가 반드시 붙습니다(않고, 않으면). 홀로 설 수 있는 건 부사 '안'입니다.",
            refs: ['한글 맞춤법 제39항'],
        };
    },
    examples: [{ wrong: '요즘 입맛이 없어서 밥을 잘 않 먹어.', right: '요즘 입맛이 없어서 밥을 잘 안 먹어.' }],
    counterExamples: ['그렇게 하지 않고 다른 방법을 찾았다.', '별로 좋지 않아.'],
});
/** `-지 않다`의 보조용언 띄어쓰기. `듣지않았다` → `듣지 않았다` */
/** `-지않-` 앞이 이 음절이면 한 단어다. 못지않다 / 머지않다 / 마지않다 */
const ONE_WORD_JI_ANH = new Set(['못', '머', '마']);
export const bojoJiAnh = defineRule({
    id: 'bojo-ji-anh',
    category: 'spacing',
    confidence: 0.94,
    pattern: /([가-힣])지않(?=[아았어었은는게])/g,
    resolve(ctx) {
        // '못지않다·머지않다·마지않다'는 사전에 오른 한 단어라 붙여 쓴다.
        if (ONE_WORD_JI_ANH.has(ctx.match[1] ?? ''))
            return null;
        return {
            suggestions: ['지 않'],
            offset: 1,
            length: 2,
            message: "보조용언 '않다'는 앞말과 띄어 씁니다.",
            explain: "'-지 않다'는 본용언과 보조용언이 이어진 구성이라 띄어 씁니다.",
            refs: ['한글 맞춤법 제47항'],
        };
    },
    examples: [{ wrong: '그는 내 말을 끝까지 듣지않았다.', right: '그는 내 말을 끝까지 듣지 않았다.' }],
    counterExamples: ['그는 내 말을 끝까지 듣지 않았다.', '그 신인의 수비는 프로 선수 못지않았다.', '머지않아 좋은 소식이 올 것이다.'],
});
/** '-지 안다' 계열. `-지 않다`가 맞다. */
const NOUN_JI = new Set(['강아지', '망아지', '송아지', '바지', '휴지', '단지', '편지', '반지', '가지', '아지']);
export const jiAnh = defineRule({
    id: 'ji-anh',
    category: 'spelling',
    confidence: 0.88,
    // '-지' 뒤의 '안'이 '았/는'으로 이어지면 부정 보조용언 '않-'이어야 한다.
    pattern: /지\s?안(?=[았는])/g,
    resolve(ctx) {
        // '강아지 안았다'처럼 앞말이 '-지'로 끝나는 명사면 부정이 아니다.
        const head = ctx.text.slice(Math.max(0, ctx.index - 2), ctx.index + 1);
        if (NOUN_JI.has(head))
            return null;
        return {
            suggestions: ['지 않'],
            message: "부정의 보조용언은 '않-'입니다.",
            explain: "'-지 아니하다'가 줄어든 형태가 '-지 않다'입니다. 홀로 쓰는 부사 '안'과 달리 어간이므로 어미가 바로 붙습니다.",
            offset: 0,
            length: ctx.match[0].length,
        };
    },
    examples: [
        { wrong: '별로 좋지 안았다.', right: '별로 좋지 않았다.' },
        { wrong: '그렇게 하지안는다.', right: '그렇게 하지 않는다.' },
    ],
    counterExamples: ['강아지 안았어.', '아기를 안았다.'],
});
//# sourceMappingURL=an.js.map