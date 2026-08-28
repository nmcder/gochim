# @gochim/core

Korean spelling and spacing checker that runs entirely on the device.

No network calls. No API key. No text ever leaves the page. **128 kB gzipped**, zero runtime dependencies.

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
//     start: 6, end: 8,
//     text: '되요',
//     suggestions: ['돼요'],
//     message: "'되요'는 '돼요'의 잘못된 표기입니다.",
//     explain: "'돼'는 '되어'의 준말입니다. '하/해'를 넣어보면 '하요(X)·해요(O)'이므로 '돼요'가 맞습니다.",
//     refs: ['한글 맞춤법 제35항 [붙임 2]'],
//     severity: 'error',
//     confidence: 0.97,
//     autoFixSafe: false,
//   },
// ]

fix('몇일 뒤에 할수있어.')
// '며칠 뒤에 할 수 있어.'
```

`autoFixSafe: false` on a rule this confident is not a mistake — see
[Applying corrections](#applying-corrections). `되` is also a unit of grain
(`쌀 두 되요`), so this entry carries a context guard, and anything that leans on a
guard loses the right to change text without a human looking.

## Why this exists

Korean proofreading tools send your text to a server. That is fine for a blog post and not fine for a cover
letter, a medical note, or an unpublished draft. `@gochim/core` is a pure function — same input, same output,
no side effects, no I/O.

It is also **precision-first**. Recall is deliberately traded away: a checker that underlines correct writing
gets uninstalled, while a checker that stays quiet just waits for the next rule. Every rule ships with
`counterExamples` — sentences it must never touch — and those are enforced by the test suite.

## Requirements

ESM only, Node ≥ 20.19 (or any modern browser/bundler). There is no CommonJS build; `require('@gochim/core')`
works on Node 20.19+/22.12+ through `require(esm)`, since the package has no top-level `await`.

## API

### `check(text, options?): Diagnostic[]`

Returns non-overlapping diagnostics sorted by position. `text.slice(d.start, d.end) === d.text` always holds.

| option | type | meaning |
| --- | --- | --- |
| `ignore` | `Iterable<string>` | keys from `ignoreKey(d)` to skip — back this with your own storage |
| `minConfidence` | `number` | drop rules that are less sure than this |
| `categories` | `Category[]` | `'spelling' \| 'spacing' \| 'confusable' \| 'ending' \| 'redundancy'` |
| `severity` | `Severity[]` | `['error']` keeps only outright mistakes; warnings are "the rule prefers this" |
| `limit` | `number` | cap the number of diagnostics on long documents |
| `analyzer` | `Analyzer` | opt into part-of-speech rules — see [`@gochim/morph`](https://www.npmjs.com/package/@gochim/morph) |
| `rules` | `Rule[]` | **replaces** the built-in rule set — see [Writing your own rules](#writing-your-own-rules) |
| `morphRules` | `MorphRule[]` | likewise replaces the built-in part-of-speech rules |

Narrowing never reveals anything: `check(t, { severity: ['error'] })` is always a subset of `check(t)`. That
holds because filters run *after* overlap resolution — filtering first would pull a warning off a span and let a
more aggressive rule surface underneath it.

`check` does not throw. A rule that throws is skipped, an analyzer that throws drops the whole layer, and a
`pattern` missing its `g` flag is compiled with one rather than looping forever.

### `fix(text, options?): string`

Applies the top suggestion for **every** diagnostic, repeating until nothing changes. Idempotent:
`fix(fix(t)) === fix(t)`, enforced across the whole sample set in the test suite.

### `applyFixes(text, diagnostics, pick?): string`

Same, but you choose which suggestion (or `null` to skip) per diagnostic.

Diagnostics carry positions from the moment they were produced. `applyFixes` re-checks that `text` still reads
`d.text` at `d.start` and silently skips the ones that no longer match, so a stale or foreign diagnostic can
never splice into unrelated prose.

### Applying corrections

**`severity` is not the auto-apply criterion. `d.autoFixSafe` is.**

`severity` is a question about Korean — *is this wrong?* `autoFixSafe` is a question about engineering — *can
this rule be trusted with nobody watching?* They are different axes, and conflating them is what once corrupted
users' writing: a rule can be entirely right about the language and still wreck a correct sentence whenever its
context guard is thin. 87 of the 209 `error`-severity rules do not qualify.

```ts
// While someone is typing:
applyFixes(text, check(text).filter((d) => d.autoFixSafe))

// When someone asked for a corrected string:
fix(text)
```

`fix()` deliberately ignores the flag — a caller who asks for corrected text wants the whole correction, not the
subset that is safe to apply behind their back. Rules earn the flag by a rule in
[CONTRIBUTING](../../CONTRIBUTING.md#4-묻지-않고-고쳐도-되는-규칙인가), checked by `npm run guard`. Everything
still gets underlined either way; only the silent application is withheld.

### `ignoreKey(diagnostic): string`

A stable key for "never tell me about this again". Scoped to `(rule, surface form)`, so ignoring `삼가하다`
does not silence the rest of the dictionary. [`@gochim/store`](https://www.npmjs.com/package/@gochim/store)
persists these in IndexedDB.

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

`rules` **replaces** the built-in set rather than extending it. Pass only your own and you get only your own —
all 232 built-in rules go quiet. Spread `allRules` to keep them:

```ts
import { allRules, check, defineLexicon } from '@gochim/core'

const houseStyle = defineLexicon({
  id: 'house-style',
  category: 'spelling',
  entries: [{ wrong: '깃허브', right: 'GitHub', explain: '제품명은 원어 표기를 따릅니다.' }],
})

check('깃허브에 올렸어요.', { rules: [...allRules, houseStyle] })
```

`defineLexicon` compiles every entry into a single alternation, so a dictionary of hundreds of terms still
costs one pass over the text. It also adds the `g` flag for you, and marks any entry carrying a `when` guard as
not auto-applicable.

## Numbers

Measured against the golden test set in this repo (`npm run golden:report`, `npm run bench`, `npm run size`):

| | |
| --- | --- |
| Precision | **1.000** — zero false positives across 553 correct sentences, 326 of which are traps written specifically to break naive rules |
| Recall | 0.957 (0.961 with the morphological layer) |
| Rules | 232 string + 9 part-of-speech, carrying 929 examples and 1,388 counter-examples — all enforced by the gates |
| Tests | 3,573 |
| Throughput | 0.66 ms per 1,000 characters (4,000 chars: 2.7 ms median, 3.1 ms p95) |
| Size | 588 kB minified, **128 kB gzipped** |

Those recall figures are against a golden set written in this repo. On writing it had never seen — 15 pieces of
real Korean across messenger, email, cover letters, comments, reviews, reports, diaries — recall is **0.955**
with the morphological layer and 0.786 without. That gap is the honest one; see the
[root README](https://github.com/nmcder/gochim#갈래가-다른-실문-성적표).

## What it does not do

Grammar checking, style rewriting, AI paraphrasing. It also skips any error that cannot be decided from the
string alone — `-ㄴ 지` vs `-ㄴ지`, `안되다` vs `안 되다`, `한번` vs `한 번`. Those need part-of-speech
information; install [`@gochim/morph`](https://www.npmjs.com/package/@gochim/morph) and pass it as `analyzer`.

URLs, emails, code spans, HTML tags, mentions, and file paths are never touched.

## License

MIT
