import { insideQuotes } from '../protect.js';
import { defineRule } from './define.js';
/**
 * 한자어 오용.
 *
 * 이 범주는 **원리적으로 1층에서 대부분 불가능하다.** 두 말이 모두 실재하고
 * 무엇이 맞는지는 문맥 의미가 정하기 때문이다.
 *
 *   고객 만족을 지양하다   ← 틀림 (추구 대상이므로 지향)
 *   양적 성장을 지양하다   ← 맞음 (회피 대상)
 *
 * 그래서 여기 남긴 것은 **목적어를 닫힌 목록으로 못박을 수 있는 것들**뿐이다.
 * 목록을 넓히는 순간 반대쪽 정상 문장을 고치기 시작한다.
 * 나머지(유래/유례, 곤혹/곤욕, 실재/실제, 갱신/경신, 부문/부분, 일절/일체,
 * 임대/임차, 출연/출현, 혼돈/혼동)는 형태소 태그로도 갈리지 않아 손대지 않는다.
 */
/** 추구할 수밖에 없는 목표. 이 목적어 뒤의 '지양'은 '지향'의 잘못이다. */
const GOALS = '고객\\s*만족|고객\\s*감동|상생|사회\\s*통합|양성평등|세계\\s*평화|지속\\s*가능|공존|화합|혁신';
/** 회피 대상임을 드러내는 수식어. 이게 붙으면 '지양'이 맞다. */
const AVOIDANCE = /양적|무분별한|과도한|지나친|맹목적|일방적|무리한|소모적|불필요한|극단적/;
export const jihyang = defineRule({
    id: 'hanja-jihyang',
    category: 'confusable',
    confidence: 0.9,
    pattern: new RegExp(`(${GOALS})(?:을|를)\\s*지양(?=[하한할함했])`, 'g'),
    resolve(ctx) {
        if (insideQuotes(ctx.text, ctx.index))
            return null;
        // 앞에 회피를 뜻하는 수식어가 있으면 '지양'이 맞다.
        const before = ctx.text.slice(Math.max(0, ctx.index - 12), ctx.index);
        if (AVOIDANCE.test(before))
            return null;
        return {
            suggestions: ['지향'],
            offset: ctx.match[0].length - 2,
            length: 2,
            message: "추구하는 것은 '지향'입니다.",
            explain: "'지양(止揚)'은 하지 않는 것, '지향(志向)'은 목표로 향하는 것입니다. '고객 만족을 지양한다'면 만족시키지 않겠다는 뜻이 됩니다.",
        };
    },
    examples: [{ wrong: '고객 만족을 지양하는 기업이 되겠습니다.', right: '고객 만족을 지향하는 기업이 되겠습니다.' }],
    counterExamples: [
        '양적 성장을 지양하고 질적 성장을 지향한다.',
        '무분별한 개발을 지양해야 한다.',
    ],
});
/** '제고(提高)'의 대상이 되는 추상 품질 명사. */
const QUALITIES = '생산성|효율성|효율|이미지|위상|경쟁력|신뢰도|만족도|인식|가치|품질|성과';
export const jego = defineRule({
    id: 'hanja-jego',
    category: 'confusable',
    confidence: 0.9,
    pattern: new RegExp(`(${QUALITIES})\\s*재고(?=[를을]\\s*(?:위해|높이|도모|기대)|하[여기고])`, 'g'),
    resolve(ctx) {
        if (insideQuotes(ctx.text, ctx.index))
            return null;
        return {
            suggestions: ['제고'],
            offset: ctx.match[0].length - 2,
            length: 2,
            message: "수준을 높이는 것은 '제고'입니다.",
            explain: "'제고(提高)'는 쳐들어 높임, '재고(再考)'는 다시 생각함, '재고(在庫)'는 창고의 물건입니다. 생산성을 높이는 것은 '제고'입니다.",
        };
    },
    examples: [{ wrong: '생산성 재고를 위해 공정을 개선했다.', right: '생산성 제고를 위해 공정을 개선했다.' }],
    counterExamples: ['합병 결정의 재고를 요구했다.', '창고에 재고가 얼마 남지 않았다.'],
});
/** '타개(打開)'의 대상이 되는 어려운 상황. */
const HARDSHIPS = '위기|난국|난관|국면|정국|불황|교착|위기감|난제|침체';
export const tagae = defineRule({
    id: 'hanja-tagae',
    category: 'confusable',
    confidence: 0.92,
    pattern: new RegExp(`(${HARDSHIPS})(?:을|를)\\s*타계(?=[하한할함했])`, 'g'),
    resolve(ctx) {
        if (insideQuotes(ctx.text, ctx.index))
            return null;
        return {
            suggestions: ['타개'],
            offset: ctx.match[0].length - 2,
            length: 2,
            message: "어려움을 헤쳐 나가는 것은 '타개'입니다.",
            explain: "'타개(打開)'는 헤쳐서 열어 나감, '타계(他界)'는 세상을 떠남입니다. 뜻이 전혀 다릅니다.",
        };
    },
    examples: [{ wrong: '위기를 타계할 방법을 찾고 있다.', right: '위기를 타개할 방법을 찾고 있다.' }],
    counterExamples: ['그 배우는 지난해 타계했다.'],
});
export const hanjaRules = [jihyang, jego, tagae];
//# sourceMappingURL=hanja.js.map