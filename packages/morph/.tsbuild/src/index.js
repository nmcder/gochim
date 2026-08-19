import { Garu } from 'garu-ko';
/** 분석기 하나를 만든다. WASM 초기화 때문에 비동기다 (실측 70~110ms). */
export async function createAnalyzer(options = {}) {
    const garu = await Garu.load(options);
    return {
        analyze(text) {
            if (!text)
                return [];
            const result = garu.analyze(text);
            // topN 옵션을 쓰면 배열이 온다. 우리는 최적해 하나만 쓴다.
            const best = Array.isArray(result) ? result[0] : result;
            if (!best)
                return [];
            return best.tokens.map((t) => ({ text: t.text, pos: t.pos, start: t.start, end: t.end }));
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