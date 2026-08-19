# @gochim/store

An IndexedDB-backed ignore dictionary for [`@gochim/core`](https://www.npmjs.com/package/@gochim/core).

```bash
npm install @gochim/core @gochim/store
```

```ts
import { check } from '@gochim/core'
import { openIgnoreStore } from '@gochim/store'

const store = await openIgnoreStore()

// The key set is synchronous — checking runs while the user types.
check(text, { ignore: store.keys() })

// "I meant to write it that way."
await store.add(diagnostic)
```

## Why a checker needs this

A proofreader that cannot remember "I meant that" makes you dismiss the same underline every single time. That
fatigue is what gets the tool turned off. Remembering is not a nice-to-have — it is the feature that decides
whether anyone comes back tomorrow.

## Design notes

- **Scoped to (rule, surface form).** Ignoring `삼가하다` does not silence the rest of the dictionary. The key
  comes from `ignoreKey()` in the core, never re-derived here — a second implementation would drift eventually.
- **Everything is loaded into memory on open.** An ignore list is tens to hundreds of entries, and `check()` has
  to run synchronously on every keystroke. Asking IndexedDB per check would be the wrong trade.
- **Degrades quietly.** Private browsing, blocked storage, or Node (no `indexedDB` at all) fall back to memory.
  `store.persistent` tells you which mode you are in; nothing throws.
- **Local only.** No `chrome.storage.sync`, no server. The point of the project is that text stays on the device;
  the ignore list is text too.

## API

| | |
| --- | --- |
| `openIgnoreStore(options?)` | Opens the store. `{ name, now }` |
| `keys()` | `ReadonlySet<string>` — pass straight to `check` |
| `list()` | Entries, most recently ignored first — for a management UI |
| `add(diagnostic)` | Remembers `(ruleId, text)` |
| `remove(key)` / `clear()` | Undo |
| `persistent` | `false` when running memory-only |

## License

MIT
