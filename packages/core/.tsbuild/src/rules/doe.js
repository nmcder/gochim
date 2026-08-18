import { defineLexicon, defineRule } from './define.js';
/**
 * `되`는 곡식을 되는 단위 명사이기도 하다 — "쌀 두 되요, 팥 서 되다".
 * 수관형사가 앞에 오면 맞춤법 오류가 아니라 단위 명사다.
 */
const NUMERAL_BEFORE = /(?:^|\s)(한|두|세|서|석|네|너|넉|다섯|여섯|일곱|여덟|아홉|열|몇|여러)\s*$/;
const notAfterNumeral = (ctx) => !NUMERAL_BEFORE.test(ctx.text.slice(Math.max(0, ctx.index - 8), ctx.index));
/**
 * 되/돼 — 한국어에서 가장 많이 틀리는 표기.
 *
 * 규칙은 하나뿐이다. **`돼`는 `되어`의 준말이다.**
 * 그래서 `되` 자리에는 어미가 더 붙을 수 있지만, `돼`는 이미 어미(`-어`)를
 * 머금고 있어서 뒤에 어미가 또 붙지 못한다.
 *
 * 사용자에게는 `하/해` 대입법으로 설명한다 — `되`는 `하`, `돼`는 `해`에 대응한다.
 * `하요(X)/해요(O)` 이므로 `되요(X)/돼요(O)`.
 */
export const doeDwae = defineLexicon({
    id: 'doe-dwae',
    category: 'spelling',
    confidence: 0.97,
    entries: [
        {
            wrong: '되요',
            right: '돼요',
            display: { wrong: '되요', right: '돼요' },
            when: notAfterNumeral,
            explain: "'돼'는 '되어'의 준말입니다. '하/해'를 넣어보면 '하요(X)·해요(O)'이므로 '돼요'가 맞습니다.",
            refs: ['한글 맞춤법 제35항 [붙임 2]'],
            examples: [{ wrong: '그렇게 하면 안 되요.', right: '그렇게 하면 안 돼요.' }],
            counterExamples: ['이것은 쌀 두 되요, 저것은 팥 서 되다.'],
        },
        {
            wrong: '되서',
            right: '돼서',
            // 연결어미 '-되' 뒤에 '서로/서서히'를 붙여 쓴 오타를 건드리지 않는다.
            when: (ctx) => !'로서히'.includes(ctx.after),
            explain: "'되어서'의 준말은 '돼서'입니다. '하서(X)·해서(O)'와 같은 자리입니다.",
            examples: [{ wrong: '늦게 되서 미안해.', right: '늦게 돼서 미안해.' }],
        },
        {
            wrong: '되야',
            right: '돼야',
            explain: "'되어야'의 준말은 '돼야'입니다. '하야(X)·해야(O)'와 같은 자리입니다.",
            examples: [{ wrong: '이 정도는 되야 한다.', right: '이 정도는 돼야 한다.' }],
        },
        {
            wrong: '됬',
            right: '됐',
            explain: "'됐'은 '되었'의 준말입니다. '됬'이라는 표기는 국어에 없습니다.",
            refs: ['한글 맞춤법 제35항 [붙임 2]'],
            examples: [{ wrong: '벌써 다 됬어?', right: '벌써 다 됐어?' }],
            counterExamples: ['드디어 다 됐어.', '그렇게 됐습니다.'],
        },
        // 반대 방향 — `돼` 뒤에 어미가 또 붙은 경우
        {
            wrong: '돼고',
            right: '되고',
            explain: "'돼'는 이미 어미 '-어'를 머금은 형태라 뒤에 어미가 또 붙지 못합니다. '해고(X)'와 같습니다.",
        },
        { wrong: '돼면', right: '되면', explain: "'해면(X)'이 안 되듯 '돼면'도 안 됩니다. '되면'이 맞습니다." },
        { wrong: '돼는', right: '되는', explain: "'해는(X)'이 안 되듯 '돼는'도 안 됩니다. '되는'이 맞습니다." },
        { wrong: '돼니', right: '되니', explain: "'해니(X)'가 안 되듯 '돼니'도 안 됩니다. '되니'가 맞습니다." },
        { wrong: '돼겠', right: '되겠', explain: "'해겠(X)'이 안 되듯 '돼겠'도 안 됩니다. '되겠'이 맞습니다." },
        { wrong: '돼며', right: '되며', explain: "'해며(X)'가 안 되듯 '돼며'도 안 됩니다. '되며'가 맞습니다." },
        { wrong: '돼려', right: '되려', explain: "'해려(X)'가 안 되듯 '돼려'도 안 됩니다. '되려고·되려면'이 맞습니다." },
        { wrong: '돼므로', right: '되므로', explain: "'해므로(X)'가 안 되듯 '돼므로'도 안 됩니다." },
        { wrong: '돼세요', right: '되세요', explain: "'해세요(X)'가 안 되듯 '돼세요'도 안 됩니다. '부자 되세요'가 맞습니다." },
        { wrong: '됌', right: '됨', explain: "'되다'의 명사형은 '됨'입니다. '됌'이라는 표기는 없습니다." },
        // 같은 원리가 적용되는 뵈/봬 (뵈어 → 봬)
        {
            wrong: '뵈요',
            right: '봬요',
            explain: "'봬'는 '뵈어'의 준말입니다. '되요/돼요'와 완전히 같은 구조입니다.",
            examples: [{ wrong: '내일 뵈요.', right: '내일 봬요.' }],
        },
        { wrong: '뵈서', right: '봬서', explain: "'뵈어서'의 준말은 '봬서'입니다." },
        { wrong: '뵜', right: '뵀', explain: "'뵀'은 '뵈었'의 준말입니다. '뵜'이라는 표기는 없습니다." },
        // 과교정 — '봬'가 맞는 자리를 배운 뒤 아닌 자리까지 바꿔 쓰는 경우
        { wrong: '봬러', right: '뵈러', explain: "'봬'는 '뵈어'의 준말이라 뒤에 어미가 또 붙지 못합니다. '뵈러 갑니다'가 맞습니다." },
        { wrong: '봴', right: '뵐', explain: "'봬'는 '뵈어'의 준말입니다. 관형사형은 '뵐'입니다. ('내일 뵐게요')" },
    ],
});
/**
 * `돼지 않다` — 명사 `돼지`와 문자열이 같아 사전으로는 못 잡는다.
 * 다만 뒤에 `않-`이 오면 부정 보조용언 구문이므로 동물일 수 없다.
 */
export const dwaeJiAnh = defineRule({
    id: 'doe-ji-anh',
    category: 'spelling',
    confidence: 0.96,
    pattern: /돼지(?=\s*않)/g,
    resolve() {
        return {
            suggestions: ['되지'],
            message: "'-지 않다' 앞에서는 '되지'가 맞습니다.",
            explain: "'돼'는 '되어'의 준말이라 뒤에 어미 '-지'가 붙지 못합니다. ('해지 않다'가 안 되는 것과 같습니다)",
        };
    },
    examples: [{ wrong: '아무리 해도 로그인이 돼지 않습니다.', right: '아무리 해도 로그인이 되지 않습니다.' }],
    counterExamples: ['돼지고기를 구워 먹었다.', '아기 돼지 삼 형제 이야기를 읽었다.'],
});
/**
 * 문장을 `되`로 끝맺은 경우. 종결형은 `되어 → 돼`라야 한다.
 * 단위 명사 `되`(곡식을 되는 그릇)와 겹치므로 수관형사 뒤는 건드리지 않는다.
 */
export const doeSentenceFinal = defineRule({
    id: 'doe-final',
    category: 'spelling',
    confidence: 0.93,
    // 어절 전체가 '되'이고 물음표·느낌표로 끝나는 자리만 본다.
    // 마침표까지 열면 "제사에 쓸 쌀은 딱 한 되."가 깨지므로 재현율을 포기한다.
    pattern: /(?<![가-힣])되(?=[?!])/g,
    resolve(ctx) {
        if (!notAfterNumeral(ctx))
            return null;
        // '되-' 앞에 조사가 오면 명사다. "쌀 한 되." 같은 경우는 위에서 걸러지고,
        // "그것도 되"처럼 어간만 남은 자리만 남는다.
        return {
            suggestions: ['돼'],
            message: "문장을 끝맺는 자리에서는 '돼'가 맞습니다.",
            explain: "종결형은 '되어'가 줄어든 '돼'입니다. '하'가 아니라 '해'가 들어갈 자리입니다.",
            refs: ['한글 맞춤법 제35항 [붙임 2]'],
        };
    },
    examples: [{ wrong: '이거 내가 먼저 먹어도 되?', right: '이거 내가 먼저 먹어도 돼?' }],
    counterExamples: ['쌀은 다 해서 몇 되?'],
});
//# sourceMappingURL=doe.js.map