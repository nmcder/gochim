# @gochim/morph

Morphological analysis for [`@gochim/core`](https://www.npmjs.com/package/@gochim/core) — part-of-speech aware Korean
spacing rules, still fully on-device.

```bash
npm install @gochim/core @gochim/morph
```

```ts
import { check, fix } from '@gochim/core'
import { createAnalyzer } from '@gochim/morph'

const analyzer = await createAnalyzer()

fix('반찬은 네가 먹을만큼만 덜어서 가져가.', { analyzer })
// '반찬은 네가 먹을 만큼만 덜어서 가져가.'

fix('나도 너 만큼 잘할 수 있어.', { analyzer })
// '나도 너만큼 잘할 수 있어.'
```

## Why this is a separate package

`@gochim/core` is 18.5 kB gzipped and has no runtime dependencies. This package adds an analyzer that is
**1.6 MB** (403 kB WASM + 1,217 kB model). Most callers do not need it, and the ones who do should pay for it
knowingly — so the boundary is a package boundary, not a flag.

The core never imports this. It declares an `Analyzer` interface and you inject an implementation:

```ts
interface Analyzer {
  analyze(text: string): readonly Morpheme[]
  score?(text: string): number
}
```

## What it buys you

Korean spacing depends on part of speech, and the same characters flip between the two:

```
할 만큼 했다   ← 의존명사 (spaced)
너만큼 했다    ← 조사     (attached)
```

String rules cannot tell these apart, so `@gochim/core` alone deliberately skips them. With an analyzer, the tags
do the work:

| sentence | without analyzer | with analyzer |
| --- | --- | --- |
| `먹을만큼만 덜어` | not detected | `먹을 만큼만 덜어` |
| `하늘만큼 땅만큼` | untouched | untouched (`만큼/JKB`) |
| `실수 없이` | untouched (hard-coded exception) | untouched (`실수/NNG`) |
| `할수있는` | detected | detected (`수/NNB`) |

Measured on the project's golden test set: recall 0.907 → 0.921, precision stays at **1.000**.

## Loading

`createAnalyzer()` resolves the WASM and model relative to the package by default. In a bundler-heavy environment
(Chrome extension, worker, CDN) pass explicit locations:

```ts
const analyzer = await createAnalyzer({
  modelUrl: new URL('base.gmdl', import.meta.url).href,
})
```

Initialization is around **100 ms** (measured in Chrome), and each sentence analyzes in 0.1–0.6 ms.
Call `analyzer.destroy()` when you are done to free the WASM instance.

## Version pin

`garu-ko` is pinned to **exactly 0.9.14**, not `^0.9.14`. Version 0.9.15 is built with the
`wasm-compact-imports` proposal enabled and fails to compile in stock Chrome:

```
CompileError: WebAssembly.instantiateStreaming(): Invalid import kind 127
```

Do not bump it without verifying in a real browser first.

## License

MIT
