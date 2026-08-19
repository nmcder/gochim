# 규칙을 추가하는 방법

이 저장소에서 규칙을 하나 더하는 일은 "정규식을 하나 쓰는 일"이 아닙니다.
**정밀도 1.000을 유지한 채 재현율을 올리는 일**입니다. 순서가 정해져 있습니다.

## 0. 먼저 물어야 할 것

> 이 오류는 **문자열만 보고** 판정할 수 있는가?

같은 글자가 품사에 따라 정반대로 갈리는 경우가 한국어에는 아주 많습니다.

```
할 만큼 했다   ← 의존명사 (띄어 씀)
너만큼 했다    ← 조사     (붙여 씀)
```

문자열만으로 확정할 수 없다면 1층 규칙을 만들지 마세요. 두 갈래가 있습니다.

- **형태소 층(3층)에서 풀리는가** → `packages/core/src/morph/rules.ts`
- **아직 아무 층도 못 푸는가** → 골든셋에 `case`로 넣어 두고 규칙은 만들지 않습니다.
  `npm run golden:report`의 "아직 못 잡는 오류" 목록이 다음 할 일을 알려 줍니다.

## 1. 골든 테스트셋에 먼저 넣는다

규칙보다 데이터가 먼저입니다. `data/golden/golden.json`에 두 종류를 넣습니다.

```jsonc
{
  "wrong": "누구나 할수있는 일이야.",
  "right": "누구나 할 수 있는 일이야.",
  "spans": [{ "wrong": "할수있", "right": "할 수 있", "ruleHint": "nnb-su" }]
}
```

그리고 **반드시** 함께 넣어야 하는 것이 있습니다 — `negatives`, 즉
**순진한 규칙이 오탐할 정상 문장**입니다.

```jsonc
{ "text": "이번에는 큰 실수 없이 발표를 마쳤다.", "trap": "'ㄹ받침+수+없'만 보면 '실 수 없이'로 깨진다" }
```

오류 문장을 모으는 건 쉽고, 함정 문장을 모으는 건 어렵습니다. 그리고 정밀도를 지키는 건 후자입니다.
`spans`를 순서대로 치환하면 `wrong`이 `right`와 **문자 단위로 정확히** 같아야 하며,
이 불변식은 `scripts/build-golden.mjs`가 강제합니다.

## 2. 규칙을 쓴다

### 사전형 — 어떤 문맥에서도 틀린 표기

```ts
// packages/core/src/rules/lexicon.ts
{
  wrong: '역활',
  right: '역할',
  explain: '役割. 나눌 할(割) 자를 씁니다.',
  refs: ['한글 맞춤법 제30항'],
}
```

항목이 수백 개가 되어도 정규식은 하나입니다(`defineLexicon`이 교차로 합칩니다).

### 패턴형 — 조건이 필요한 규칙

```ts
// packages/core/src/rules/spacing.ts
export const nnbSu = defineRule({
  id: 'nnb-su',
  category: 'spacing',
  confidence: 0.96,
  pattern: /([가-힣])( ?)수( ?)(있|없)/g,
  resolve(ctx) {
    const [, prev = '', sp1 = '', sp2 = '', tail = ''] = ctx.match
    if (sp1 && sp2) return null          // 이미 올바름
    if (!hasL(prev)) return null          // 관형사형 어미 -ㄹ 뒤에서만
    if (NOUN_SU.has(prev + '수')) return null  // 실수·별수 같은 명사 제외
    return { suggestions: [`${prev} 수 ${tail}`], message: '…', explain: '…' }
  },
  examples: [{ wrong: '누구나 할수있는 동작이에요.', right: '누구나 할 수 있는 동작이에요.' }],
  counterExamples: ['이번에는 큰 실수 없이 발표를 마쳤다.'],
})
```

**`examples`와 `counterExamples`는 선택이 아닙니다.** 테스트가 자동으로 두 가지를 강제합니다.

- 모든 `examples`는 잡혀야 하고, 고친 결과가 `right`와 정확히 같아야 한다
- 모든 `counterExamples`는 **어떤 규칙도** 건드리면 안 된다

규칙을 좁힐 때마다 그 근거가 된 문장을 `counterExamples`에 남기세요.
그게 다음 사람이 같은 함정에 다시 빠지지 않게 하는 유일한 방법입니다.

### 받침으로 푸는 규칙

사전에 단어를 하나씩 넣는 대신 규정을 코드로 적을 수 있는지 먼저 보세요.

```ts
// 두음법칙 — 모음이나 ㄴ 받침 뒤에서는 '율', 그 밖에는 '률'
const tail = finalOf(prev)
if (tail === '' || tail === 'ㄴ') return null
return { suggestions: ['률'], ... }
```

`경쟁률·합격률·성공률`을 표제어로 모을 필요가 없어집니다.

## 3. 재고 나서 판단한다

```bash
npm test                          # 예시·반례·골든셋 정밀도
npm run golden:report             # 분류별 검출률 · 오탐 · 미검출 목록
npm run golden:report -- --morph  # 형태소 층까지 켜고
```

합격선은 하나뿐입니다.

| | |
| --- | --- |
| **정밀도** | **≥ 0.98** (현재 1.000). 미만이면 테스트가 깨집니다 |
| 재현율 | 합격선 없음. 못 잡는 건 나중에 회복할 수 있습니다 |

오탐이 하나라도 늘었다면 규칙을 넓힌 게 아니라 **망가뜨린** 것입니다.
[ADR 0002](docs/decisions/0002-precision-first.md)에 왜 이렇게 정했는지 적혀 있습니다.

## 4. 문서는 코드에서 나온다

```bash
npm run rules:doc   # docs/rules.md 재생성
```

`docs/rules.md`를 직접 고치지 마세요. 규칙이 이미 예시·반례·근거를 들고 다니므로
문서를 따로 쓰면 반드시 어긋납니다.

## 안 되는 것을 확인했다면 그것도 남긴다

[ADR 0006](docs/decisions/0006-rejected-score-based-typo-detection.md)이 그 예입니다.
형태소 분석 점수로 오타를 잡으려다 정밀도가 1.000에서 0.892로 떨어졌고,
임계값을 만지는 대신 분포를 재서 **분리가 불가능하다**는 것을 확인하고 기각했습니다.

"해 봤는데 안 되더라"는 말 대신 `tools/experiments/`에 **다시 잴 수 있는 스크립트**를 남겨 주세요.

## 코드 스타일

- 주석은 **왜**를 씁니다. 무엇을 하는지는 코드가 말합니다.
- 규칙을 좁힌 자리에는 그 이유가 된 실제 문장을 적습니다.
- `@gochim/core`는 `document`·`chrome`·`window`를 참조하지 않습니다. 순수 함수 하나가 전부입니다.
