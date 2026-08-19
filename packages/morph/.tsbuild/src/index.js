import { Garu, splitSentences } from 'garu-ko';
/** topN 옵션을 쓰면 배열이 온다. 우리는 최적해 하나만 쓴다. */
function tokensOf(result) {
    const best = Array.isArray(result) ? result[0] : result;
    return best?.tokens ?? [];
}
/** 분석기 하나를 만든다. WASM 초기화 때문에 비동기다 (실측 70~110ms). */
export async function createAnalyzer(options = {}) {
    const garu = await Garu.load(options);
    return {
        analyze(text) {
            if (!text)
                return [];
            // 문장 단위로 나눠 분석한다. 긴 글을 통째로 넣으면 격자가 커져
            // 시간이 초선형으로 늘어난다 (실측: 4,000자 612ms → 문장 분할 후 4ms).
            const morphemes = [];
            for (const segment of splitSentences(text)) {
                for (const token of tokensOf(garu.analyze(segment.text))) {
                    morphemes.push({
                        text: token.text,
                        pos: token.pos,
                        start: token.start + segment.offset,
                        end: token.end + segment.offset,
                    });
                }
            }
            return morphemes;
        },
        score(text) {
            if (!text)
                return 0;
            const result = garu.analyze(text);
            const best = Array.isArray(result) ? result[0] : result;
            return best?.score ?? 0;
        },
        destroy() {
            garu.destroy();
        },
        info() {
            return garu.modelInfo();
        },
    };
}
//# sourceMappingURL=index.js.map