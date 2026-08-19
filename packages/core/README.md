# @gochim/core

Korean spelling and spacing checker that runs entirely on the device.

No network calls. No API key. No text ever leaves the page. **18.5 kB gzipped**, zero runtime dependencies.

```bash
npm install @gochim/core
```

```ts
import { check, fix } from '@gochim/core'

check('그러면 안 되요.')
// [
//   {
//     ruleId: 'doe-dwae/되요',
//     category: 'spelling',
//     start: 7, end: 9,
//     text: '되요',
//     suggestions: ['돼요'],
//     message: "'되요'는 '돼요'의 잘못된 표기입니다.",
//     explain: "'돼'는 '되어'의 준말입니다. '하/해'를 넣어보면 '하요(X)·해요(O)'이므로 '돼요'가 맞습니다.",
//     refs: ['한글 맞춤법 제35항 [붙임 2]'],
//     severity: 'error',
//     confidence: 0.97,
//   },
// ]

fix('몇일 뒤에 할수있어.')
// '며칠 뒤에 할 수 있어.'
```

## Why this exists

Korean proofreading tools send your text to a server. That is fine for a blog post and not fine for a cover
letter, a medical note, or an unpublished draft. `@gochim/core` is a pure function — same input, same output,
no side effects, no I/O.

It is also **precision-first**. Recall is deliberately traded away: a checker that underlines correct writing
gets uninstalled, while a checker that stays quiet just waits for the next rule. Every rule ships with
`counterExamples` — sentences it must never touch — and those are enforced by the test suite.

## API

### `check(text, options?): Diagnostic[]`

Returns non-overlapping diagnostics sorted by position. `text.slice(d.start, d.end) === d.text` always holds.

| option | type | meaning |
| --- | --- | --- |
| `ignore` | `Iterable<string>` | keys from `ignoreKey(d)` to skip — back this with your own storage |
| `minConfidence` | `number` | drop rules that are less sure than this |
| `categories` | `Category[]` | `'spelling' \| 'spacing' \| 'confusable' \| 'ending'` |
| `limit` | `number` | cap the number of diagnostics on long documents |
| `rules` | `Rule[]` | replace the built-in rule set entirely |

### `fix(text, options?): string`

Applies the top suggestion for every diagnostic. Idempotent: `fix(fix(t)) === fix(t)`.

### `applyFixes(text, diagnostics, pick?): string`

Same, but you choose which suggestion (or `null` to skip) per diagnostic.

### `ignoreKey(diagnostic): string`

A stable key for "never tell me about this again". Scoped to `(rule, surface form)`, so ignoring `삼가하다`
does not silence the rest of the dictionary.

### Hangul utilities

The rules are not a plain lookup table — they compute over jamo. Those helpers are exported because they are
useful on their own:

```ts
import { decompose, compose, finalOf, josa } from '@gochim/core'

decompose('할')      // { lead: 'ㅎ', vowel: 'ㅏ', tail: 'ㄹ' }
finalOf('하')        // ''
josa('책', '은/는')  // '은'
josa('사과', '은/는') // '는'
```

`compose` and `decompose` round-trip across all 11,172 Hangul syllables (verified in the test suite).

## Writing your own rules

```ts
import { check, defineLexicon } from '@gochim/core'

const myTerms = defineLexicon({
  id: 'house-style',
  category: 'spelling',
  entries: [{ wrong: '깃허브', right: 'GitHub', explain: '제품명은 원어 표기를 따릅니다.' }],
})

check('깃허브에 올렸어요.', { rules: [myTerms] })
```

`defineLexicon` compiles every entry into a single alternation, so a dictionary of hundreds of terms still
costs one pass over the text.

## Numbers

Measured against the golden test set in this repo (`npm run golden:report`):

| | |
| --- | --- |
| Precision | **1.000** — zero false positives across 553 correct sentences, 326 of which are traps written specifically to break naive rules |
| Recall | 0.939 (0.952 with the morphological layer) |
| Rules | 96, carrying 287 examples and 189 counter-examples — all enforced by the test suite |
| Throughput | 0.1 ms per 1,000 characters |

## What it does not do

Grammar checking, style rewriting, AI paraphrasing. It also skips any error that cannot be decided from the
string alone — `-ㄴ 지` vs `-ㄴ지`, `안되다` vs `안 되다`, `한번` vs `한 번`. Those need part-of-speech
information and are handled in a later layer.

URLs, emails, code spans, HTML tags, mentions, and file paths are never touched.

## License

MIT
