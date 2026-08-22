import { check, mergeDiagnostics, type Diagnostic } from '@gochim/core'
import { offsetOf, toEditable, type EditableTarget } from './editable.js'
import { createPopover } from './popover.js'
import { createMorphClient, type MorphClient } from './morph-client.js'
import { createUnderlineLayer, type UnderlineLayer } from './underline.js'
import { toast } from './toast.js'
import { loadSettings, onSettingsChanged, type Settings } from '../shared/settings.js'
import { openIgnoreStore, type IgnoreStore } from '@gochim/store'

/**
 * 콘텐츠 스크립트.
 *
 * 남의 페이지 안에서 도는 코드라 지켜야 할 선이 뚜렷하다.
 *  - 호스트 DOM을 건드리지 않는다 (밑줄은 Highlight API나 겹친 레이어로)
 *  - 사용자가 입력칸을 만지기 전에는 아무것도 하지 않는다
 *  - 네트워크를 쓰지 않는다 (manifest에 권한 자체가 없다)
 *  - 타이핑을 막지 않는다 (디바운스 + 한 번에 검사하는 길이 제한)
 */

const DEBOUNCE_MS = 300
/** 아주 긴 글에서 한 번에 검사할 최대 길이. 넘어가면 커서 주변만 본다. */
const WINDOW_SIZE = 4000

let settings: Settings | null = null
let ignoreStore: IgnoreStore | null = null

interface Session {
  target: EditableTarget
  layer: UnderlineLayer
  /** 문자열 규칙(1층) 결과. 즉시 나온다. */
  base: Diagnostic[]
  /** 형태소 층(3층) 결과. 워커에서 조금 늦게 도착한다. */
  morph: Diagnostic[]
  /** 화면에 그려진 것 — 위 둘을 합친 결과. */
  diagnostics: Diagnostic[]
  timer: number
  /** 손대기 전의 `spellcheck` 속성. 뗄 때 그대로 돌려놓는다. */
  spellcheckWas: string | null
  /** 저절로 띄운 카드가 가리키는 진단. 커서가 벗어나면 닫는다. */
  suggested: Diagnostic | null
  /**
   * Esc로 물린 진단의 자리(`시작:끝`).
   *
   * 숨기기만 해서는 부족하다. 다시 그릴 일이 생기면(형태소 결과가 늦게 도착하거나
   * 재검사가 돌면) 커서가 그대로이므로 같은 카드가 그 자리에서 또 뜬다.
   * 그래서 물렸다는 사실을 남겨 두고, 커서가 그 진단을 벗어날 때 푼다.
   */
  dismissed: string | null
  /**
   * 한글 조합(IME)이 진행 중인가.
   *
   * 한글은 자모를 모아 한 글자를 만드는 동안 브라우저가 **조합 상태**로 잡아 둔다.
   * 그 사이에 다른 자리를 고치면 조합이 깨져 치던 글자가 통째로 날아간다.
   * 조합이 끝날 때까지 자동 고침은 손을 대지 않는다.
   */
  composing: boolean
  /** 마지막으로 글자가 들어온 시각. 자동 고침이 타이핑을 앞지르지 않게 하는 데 쓴다. */
  lastInput: number
  /**
   * 글 전체를 훑은 결과. 창(4,000자) 밖까지 포함한다.
   *
   * 글이 바뀔 때마다 비우고, '모두 고치기'를 보여 주거나 누를 때만 채운다.
   * 타자마다 전체를 훑지 않으려는 것이다.
   */
  whole: Diagnostic[] | null
}

/**
 * 형태소 워커. **켠 사람에게만, 처음 필요한 순간에** 만든다.
 * 확장이 설치돼 있다는 이유만으로 모든 탭이 1.6MB를 지고 시작하지는 않는다.
 */
let morphClient: MorphClient | null = null

function workerUrl(): string | null {
  const override = (globalThis as { __gochimWorkerUrl?: string }).__gochimWorkerUrl
  if (override) return override
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) return chrome.runtime.getURL('garu/morph-worker.js')
  return null
}

function ensureMorphClient(): MorphClient | null {
  if (morphClient) return morphClient
  const url = workerUrl()
  if (!url) return null
  morphClient = createMorphClient({
    workerUrl: url,
    onResult(diagnostics) {
      if (!session) return
      session.morph = diagnostics
      paint()
    },
    onError() {
      // 분석기를 못 불러와도 1층은 그대로 돈다. 조용히 끈다.
      morphClient?.terminate()
      morphClient = null
    },
  })
  return morphClient
}

/**
 * 두 층의 결과를 합쳐 다시 그린다. 같은 자리에 밑줄이 두 번 그어지지 않도록 엔진 규칙으로 정리한다.
 *
 * 자동 고침이 켜져 있으면 **아무것도 그리지 않는다.** 어차피 알아서 고쳐지는 것에
 * 밑줄을 긋고 카드를 띄우면 고칠 것도 없는 자리에 손이 가게 만든다.
 * 진단 자체는 그대로 들고 있어야 [autoFix]가 쓸 수 있다.
 */
function paint(): void {
  if (!session) return
  session.diagnostics = session.morph.length > 0 ? mergeDiagnostics(session.base, session.morph) : session.base
  if (settings?.autoFix === true) {
    session.layer.render([])
    if (session.suggested) {
      session.suggested = null
      popover.hide()
    }
    return
  }
  session.layer.render(session.diagnostics)
  suggestAtCaret()
}

/** 진단 한 건을 가리키는 자리 열쇠. 글이 바뀌면 오프셋이 달라져 저절로 무효가 된다. */
function keyOf(d: Diagnostic): string {
  return `${d.start}:${d.end}`
}

/** 커서가 걸쳐 있는 진단. 방금 친 낱말을 고르기 위해 끝점까지 포함해서 본다. */
function diagnosticAtCaret(caret: number): Diagnostic | null {
  if (!session) return null
  return session.diagnostics.find((d) => d.start <= caret && caret <= d.end) ?? null
}

/**
 * 타이핑을 멈춘 자리에서 바로 고칠 수 있게 카드를 띄운다.
 *
 * 손이 마우스로 가지 않는 것이 요점이다. 밑줄을 클릭하러 되돌아가야 한다면
 * 대부분은 그냥 틀린 채로 두고 만다.
 */
function suggestAtCaret(): void {
  if (!session || !settings?.inlineSuggest) return
  // 사용자가 직접 연 카드는 건드리지 않는다.
  if (popover.isOpen && !session.suggested) return

  const hit = diagnosticAtCaret(caretOf(session.target))
  if (!hit) {
    if (session.suggested) {
      session.suggested = null
      popover.hide()
    }
    return
  }
  // 사용자가 Esc로 물린 자리면 커서가 벗어나기 전까지 다시 띄우지 않는다.
  if (session.dismissed === keyOf(hit)) return
  if (session.suggested && session.suggested.start === hit.start && session.suggested.end === hit.end) return

  const rect = session.layer.rectOf(hit)
  if (!rect) return
  session.suggested = hit
  popover.show(hit, rect, { compact: true, acceptKey: settings.acceptKey, total: wholeDiagnostics().length })
}

/**
 * 타이핑을 앞지르지 않기 위해 기다리는 시간.
 *
 * 검사 자체는 300ms 뒤에 돌지만 고치는 것은 더 뜸을 들인다. 빨리 치는 사람은
 * 낱말 사이에서도 손이 멈추지 않아서, 검사 주기에 맞춰 고치면 커서를 계속 뺏는다.
 */
const AUTOFIX_IDLE_MS = 700

/**
 * 이미 지나간 어절의 시작 위치.
 *
 * 커서가 놓인 낱말은 아직 쓰는 중이므로 손대면 안 된다. 그래서 **커서 앞의 마지막
 * 공백**을 경계로 삼고, 그 앞에서 끝나는 진단만 고친다.
 * 공백이 아니라 문장부호를 경계로 쓰면 `않됬네요.`처럼 마침표가 붙은 자리를 놓친다.
 *
 * ## 왜 지금 치는 낱말은 건드리면 안 되는가
 *
 * 다 못 친 낱말은 **거의 언제나 틀린 말처럼 보인다.** 정상 문장 900개를 한 글자씩
 * 쳐 나가며 세어 보니, 아직 진행 중인 어절에 진단이 붙는 자리가 24가지 나왔다.
 *
 *   후들거   → `후들 거`   (치던 말은 `후들거린다`)
 *   시큰거   → `시큰 거`   (치던 말은 `시큰거려요`)
 *   성실할뿐 → `성실할 뿐` (치던 말은 `성실할뿐더러`)
 *   안간     → `안 간`     (치던 말은 `안간힘`)
 *   않       → `안`        (치던 말은 `않았다`)
 *
 * 손이 잠깐 멈췄다고 고쳐 버리면 이것들이 전부 사고가 된다.
 * 그래서 마지막 어절은 **낱말이 끝났다는 신호**가 올 때까지 기다린다 —
 * 뒤에 공백이나 문장부호가 오거나, 입력칸에서 손을 뗄 때다.
 */
function settledBefore(text: string, caret: number): number {
  let at = Math.min(caret, text.length)
  while (at > 0 && !/\s/.test(text[at - 1] ?? '')) at -= 1
  return at
}

/** 방금 낱말 하나가 끝났는가. 끝났으면 기다릴 이유가 없다. */
function justEndedWord(text: string, caret: number): boolean {
  return /[\s.,!?…;:)\]}"']/.test(text[caret - 1] ?? '')
}

/**
 * 묻지 않고 알아서 고친다.
 *
 * ## 커서를 돌려놓는다
 *
 * 이 함수의 사고 대부분이 여기서 났다. `replaceRange`는 갈아 끼운 글 뒤에 커서를
 * 두고 가는데, 그때 사용자는 이미 다음 낱말을 치고 있다. 커서가 앞으로 끌려가면
 * 그다음 글자들이 엉뚱한 자리에 박힌다 —
 * `안녕하세요 참 않됬네요 화이팅`이 `안녕하세요 참 않 화이팅됬네요`가 되는 식이다.
 * 그래서 고친 길이 차이만큼 커서를 밀어 원래 자리에 돌려놓는다.
 *
 * ## 조합 중에는 손대지 않는다
 *
 * 한글은 자모를 모으는 동안 브라우저가 조합 상태로 잡아 둔다.
 * 그 사이에 DOM을 건드리면 조합이 깨져 치던 글자가 날아간다.
 *
 * ## 경고는 고치지 않는다
 *
 * 경고는 "규정이 이쪽도 허용한다"는 안내다(`좀더`, `둘다`).
 * 묻지 않고 바꿔 버리면 글쓴이가 고른 표기를 빼앗는 셈이 된다.
 */
function autoFix(final = false): boolean {
  if (!session || settings?.autoFix !== true) return false
  if (session.composing) return false
  // 손을 댄 적 없는 칸은 건드리지 않는다. 남이 써 둔 댓글을 고치려고 눌렀을 뿐인데
  // 클릭만으로 글이 바뀌면 놀란다. 이미 써 둔 글은 Alt+Shift+F가 맡는다.
  if (session.lastInput === 0) return false

  const text = session.target.getText()
  const caret = caretOf(session.target)

  // 낱말이 방금 끝났으면 기다릴 이유가 없다. 커서가 어절 경계에 있어 끌려갈 일도 없다.
  // 이 길이 없으면 공백을 친 뒤로도 1초 가까이 아무 일이 없어 고장난 것처럼 보인다.
  if (!final && !justEndedWord(text, caret) && Date.now() - session.lastInput < AUTOFIX_IDLE_MS) {
    scheduleCheck(AUTOFIX_IDLE_MS)
    return false
  }

  // 손을 뗄 때는 마지막 어절까지 본다. 그때는 다 쓴 것이 확실하다.
  const boundary = final ? text.length + 1 : settledBefore(text, caret)

  const plan = session.diagnostics
    .filter((d) => d.severity !== 'warning' && d.end < boundary && d.suggestions[0] != null)
    .filter((d) => text.slice(d.start, d.end) === d.text)
    .sort((a, b) => b.start - a.start)
  if (plan.length === 0) return false

  let moved = caret
  let earliest = Number.POSITIVE_INFINITY
  let fixed = 0
  for (const d of plan) {
    // 뒤에서 앞으로 가므로 겹치는 것은 이미 고른 뒤엣것만 남긴다.
    if (d.end > earliest) continue
    const replacement = d.suggestions[0] ?? ''
    // 손을 뗀 뒤에는 초점을 건드리지 않고 쓴다. 안 그러면 옮겨 간 자리에서 초점을 도로 끌어온다.
    session.target.replaceRange(d.start, d.end, replacement, final)
    moved += replacement.length - (d.end - d.start)
    earliest = d.start
    fixed += 1
  }
  if (fixed === 0) return false

  // 손을 뗀 뒤라면 커서를 되돌릴 것이 없다. 오히려 초점을 다시 끌어올 수 있다.
  if (!final) session.target.setCaret(moved)
  return true
}

/**
 * 글 전체의 오류. 평소 검사는 커서 주변 4,000자만 보지만 여기서는 끝까지 본다.
 *
 * 자동 고침은 **커서가 지나간 자리만** 손대므로 이미 써 둔 글에는 아무 일도 하지 않는다.
 * 옛날에 쓴 글을 통째로 고치고 싶을 때 쓰는 것이 이쪽이다.
 */
function wholeDiagnostics(): Diagnostic[] {
  if (!session || !settings?.enabled || !ignoreStore) return []
  if (session.whole) return session.whole
  const text = session.target.getText()
  // 창 안에 다 들어오는 글이면 이미 검사해 둔 결과가 곧 전체다. 형태소 층까지 합쳐져 있다.
  if (text.length <= WINDOW_SIZE) return (session.whole = session.diagnostics)
  return (session.whole = check(text, {
    ignore: ignoreStore.keys(),
    minConfidence: settings.minConfidence,
    ...(settings.categories.length > 0 ? { categories: settings.categories } : {}),
  }))
}

/**
 * 겹치지 않는 진단만 **뒤에서 앞으로** 골라낸다.
 *
 * 앞부터 고치면 첫 교정에서 길이가 달라지는 순간 뒤쪽 오프셋이 전부 밀린다.
 * 뒤에서부터 고치면 아직 안 건드린 앞쪽 구간의 위치는 그대로다.
 */
function fixPlan(found: Diagnostic[], text: string): Diagnostic[] {
  const plan: Diagnostic[] = []
  let earliest = Number.POSITIVE_INFINITY
  for (const d of [...found].sort((a, b) => b.start - a.start)) {
    if (d.suggestions[0] == null) continue
    if (d.end > earliest) continue // 앞 진단과 겹친다 — 뒤엣것을 이미 골랐으므로 버린다
    // 진단을 만든 뒤 글이 바뀌었을 수 있다. 다른 자리를 고치는 사고를 막는다.
    if (text.slice(d.start, d.end) !== d.text) continue
    plan.push(d)
    earliest = d.start
  }
  return plan
}

/**
 * '모두 고치기'가 실제로 고친 건수. 0이면 아무것도 하지 않았다.
 *
 * **여러 번 훑는다.** 한 어절에 오류가 둘 겹쳐 있으면 엔진이 확신도가 높은 하나만 남긴다
 * (`먹을껄`은 띄어쓰기와 표기가 함께 틀렸다). 한 번만 고치면 `먹을 껄`에서 멈추므로,
 * 고친 결과를 다시 검사해 남은 것을 마저 고친다.
 *
 * 두 번째 회부터는 1층(문자열 규칙)만 쓴다. 형태소 층은 워커에 있어 결과가 늦게 오는데,
 * 겹침에 밀려 남는 쪽은 거의 언제나 1층이라 이것으로 충분하다.
 */
const MAX_FIX_PASSES = 3

function fixAll(): number {
  if (!session) return 0
  let fixed = 0
  // 첫 회만 미리 받아 둔 진단(형태소 층 포함)을 쓴다.
  let ready: Diagnostic[] | null = wholeDiagnostics()

  for (let pass = 0; pass < MAX_FIX_PASSES; pass += 1) {
    const text = session.target.getText()
    const plan = fixPlan(ready ?? layerOneDiagnostics(text), text)
    if (plan.length === 0) break
    applyPlan(plan, text)
    fixed += plan.length
    ready = null
  }

  scheduleCheck(0)
  return fixed
}

/** 형태소 워커를 기다리지 않는 즉시 검사. '모두 고치기'의 두 번째 회부터 쓴다. */
function layerOneDiagnostics(text: string): Diagnostic[] {
  if (!session || !settings?.enabled || !ignoreStore) return []
  return check(text, {
    ignore: ignoreStore.keys(),
    minConfidence: settings.minConfidence,
    ...(settings.categories.length > 0 ? { categories: settings.categories } : {}),
  })
}

function applyPlan(plan: Diagnostic[], text: string): void {
  if (!session) return
  if (session.target.kind === 'field') {
    // textarea·input은 값이 문자열 하나다. 한 번에 갈아 끼우면 되돌리기도 한 번에 된다.
    // 열 곳을 고치고 Ctrl+Z를 열 번 눌러야 한다면 되돌린다는 느낌이 들지 않는다.
    let next = text
    let caret = caretOf(session.target)
    for (const d of plan) {
      const replacement = d.suggestions[0] ?? ''
      next = next.slice(0, d.start) + replacement + next.slice(d.end)
      // 커서 앞쪽이 짧아지거나 길어진 만큼 커서도 따라 움직여야 제자리에 남는다.
      if (d.end <= caret) caret += replacement.length - (d.end - d.start)
    }
    session.target.replaceRange(0, text.length, next)
    const field = session.target.element as HTMLTextAreaElement | HTMLInputElement
    const clamped = Math.max(0, Math.min(caret, next.length))
    field.setSelectionRange(clamped, clamped)
  } else {
    // contenteditable은 값이 DOM 트리다. 통째로 갈아 끼우면 굵은 글씨도 링크도 다 날아간다.
    // 한 곳씩 바꿔서 주변 마크업을 살린다.
    for (const d of plan) session.target.replaceRange(d.start, d.end, d.suggestions[0] ?? '')
  }
}

let session: Session | null = null

const popover = createPopover({
  onApply(diagnostic) {
    const replacement = diagnostic.suggestions[0]
    if (!session || replacement == null) return
    session.target.replaceRange(diagnostic.start, diagnostic.end, replacement)
    scheduleCheck(0)
  },
  async onIgnore(diagnostic) {
    await ignoreStore?.add(diagnostic)
    scheduleCheck(0)
    // 되돌리려면 설정 화면까지 가야 하는 일이다. 무엇이 조용해졌고 어디서 되돌리는지
    // 그 자리에서 말해 준다. 나중에 "왜 이건 안 잡히지"를 겪지 않게 하는 것이 요점이다.
    toast(`'${diagnostic.text}'는 앞으로 지적하지 않습니다 · 설정 > 무시한 항목에서 되돌리기`)
  },
  onApplyAll() {
    const fixed = fixAll()
    if (fixed > 0) toast(`${fixed}곳을 고쳤습니다`)
  },
})

/**
 * 커서 주변만 잘라 검사한다.
 *
 * 원고 하나가 통째로 들어오는 자리(구글 문서 초안, 긴 블로그 글)에서도
 * 타이핑이 끊기지 않아야 한다. 잘린 자리에서 오류를 놓치는 건 감수한다.
 */
function windowOf(text: string, caret: number): { slice: string; offset: number } {
  if (text.length <= WINDOW_SIZE) return { slice: text, offset: 0 }
  const half = Math.floor(WINDOW_SIZE / 2)
  let start = Math.max(0, caret - half)
  let end = Math.min(text.length, start + WINDOW_SIZE)
  start = Math.max(0, end - WINDOW_SIZE)
  // 어절 중간에서 자르면 없는 오류가 생긴다. 공백까지 물러난다.
  while (start > 0 && !/\s/.test(text[start - 1] ?? '')) start -= 1
  while (end < text.length && !/\s/.test(text[end] ?? '')) end += 1
  return { slice: text.slice(start, end), offset: start }
}

function caretOf(target: EditableTarget): number {
  if (target.kind === 'field') {
    const field = target.element as HTMLTextAreaElement | HTMLInputElement
    return field.selectionStart ?? 0
  }
  // anchorOffset은 그 텍스트 노드 안에서의 위치다. 전체 기준으로 환산해야
  // 긴 글에서 커서 주변을 제대로 잘라낼 수 있다.
  const selection = window.getSelection()
  const anchor = selection?.anchorNode
  if (!anchor || !target.element.contains(anchor)) return 0
  return offsetOf(target.element, anchor, selection.anchorOffset)
}

function runCheck(): void {
  // 설정과 무시 사전을 읽기 전에는 아무것도 하지 않는다.
  if (!session || !settings?.enabled || !ignoreStore) return
  const text = session.target.getText()
  const { slice, offset } = windowOf(text, caretOf(session.target))

  const found = check(slice, {
    ignore: ignoreStore.keys(),
    minConfidence: settings.minConfidence,
    ...(settings.categories.length > 0 ? { categories: settings.categories } : {}),
  })

  const shifted = offset === 0 ? found : found.map((d) => ({ ...d, start: d.start + offset, end: d.end + offset }))
  session.base = shifted
  // 글이 바뀌었으니 이전 형태소 결과는 위치가 어긋난다. 새 결과가 올 때까지 비워 둔다.
  session.morph = []
  session.whole = null
  paint()

  if (autoFix()) {
    scheduleCheck(0)
    return
  }

  if (settings.morph) ensureMorphClient()?.request(text, [...ignoreStore.keys()])
}

function scheduleCheck(delay = DEBOUNCE_MS): void {
  if (!session) return
  window.clearTimeout(session.timer)
  session.timer = window.setTimeout(runCheck, delay)
}

function detach(): void {
  if (!session) return
  window.clearTimeout(session.timer)
  // 빌린 것은 돌려놓는다.
  if (session.spellcheckWas === null) session.target.element.removeAttribute('spellcheck')
  else session.target.element.setAttribute('spellcheck', session.spellcheckWas)
  session.layer.destroy()
  session = null
  popover.hide()
}

function attach(target: EditableTarget): void {
  if (session?.target.element === target.element) return
  detach()

  // 크롬이 그리는 빨간 물결과 고침의 밑줄이 겹치면 두 줄로 보인다.
  // 호스트 DOM을 건드리지 않는다는 원칙의 유일한 예외 — 속성 하나이고, 뗄 때 되돌린다.
  const spellcheckWas = target.element.getAttribute('spellcheck')
  if (settings?.suppressNativeSpellcheck !== false) target.element.setAttribute('spellcheck', 'false')

  session = {
    target,
    layer: createUnderlineLayer(target),
    base: [],
    morph: [],
    diagnostics: [],
    timer: 0,
    spellcheckWas,
    suggested: null,
    dismissed: null,
    composing: false,
    lastInput: 0,
    whole: null,
  }
  scheduleCheck(0)
}

document.addEventListener('focusin', (event) => {
  const target = toEditable(event.target)
  if (target) attach(target)
})

// 한글은 자모를 모으는 동안 조합 상태로 잡혀 있다. 그 사이에 다른 자리를 고치면
// 조합이 깨져 치던 글자가 통째로 날아간다. 조합이 끝난 뒤에 다시 본다.
// 입력칸에서 손을 떼는 순간이 "다 썼다"는 가장 확실한 신호다.
// 마지막 어절은 이때 고친다 — 치는 도중에는 다 못 친 낱말과 구별할 방법이 없다.
document.addEventListener('focusout', (event) => {
  if (!session || event.target !== session.target.element) return
  autoFix(true)
})

document.addEventListener('compositionstart', (event) => {
  if (session && event.target === session.target.element) session.composing = true
})
document.addEventListener('compositionend', (event) => {
  if (!session || event.target !== session.target.element) return
  session.composing = false
  session.lastInput = Date.now()
  scheduleCheck()
})

document.addEventListener('input', (event) => {
  if (session && event.target === session.target.element) {
    session.lastInput = Date.now()
    scheduleCheck()
    return
  }
  // 우리보다 먼저 포커스가 간 입력칸. 아래 attachActive의 설명 참고.
  // 붙는 순간을 놓쳐도 첫 글자를 치면 여기서 붙잡는다.
  const target = toEditable(event.target)
  if (target) attach(target)
})

document.addEventListener(
  'click',
  (event) => {
    if (popover.contains(event.target as Node)) return
    if (!session) {
      popover.hide()
      return
    }
    // 자동 고침이 켜져 있으면 밑줄이 없다. 없는 것을 클릭했다고 카드를 띄우면 안 된다.
    if (settings?.autoFix === true) {
      popover.hide()
      return
    }
    const hit = session.layer.hitTest(event.clientX, event.clientY, session.diagnostics)
    if (!hit) {
      popover.hide()
      return
    }
    const rect = session.layer.rectOf(hit)
    if (rect) popover.show(hit, rect, { acceptKey: settings?.acceptKey, total: wholeDiagnostics().length })
  },
  true,
)

/** 눌린 키가 설정된 적용 키인가. */
function isAcceptKey(event: KeyboardEvent): boolean {
  switch (settings?.acceptKey) {
    case 'Enter':
      return event.key === 'Enter' && !event.shiftKey && !event.altKey
    case 'Alt+Enter':
      return event.key === 'Enter' && event.altKey
    default:
      return event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey
  }
}

document.addEventListener(
  'keydown',
  (event) => {
    if (!popover.isOpen) return

    if (event.key === 'Escape') {
      if (session) {
        const shown = popover.current
        session.dismissed = shown ? keyOf(shown) : null
        session.suggested = null
      }
      popover.hide()
      return
    }

    // 카드가 떠 있을 때만 키를 가로챈다. 그렇지 않으면 Tab으로 칸을 옮기지 못한다.
    if (isAcceptKey(event)) {
      event.preventDefault()
      event.stopPropagation()
      if (session) session.suggested = null
      popover.accept()
    }
  },
  true,
)

// 커서가 오류 밖으로 나가면 저절로 띄운 카드는 닫고, 물려 둔 것도 푼다.
document.addEventListener('selectionchange', () => {
  if (!session) return
  const hit = diagnosticAtCaret(caretOf(session.target))

  // 커서가 물린 진단을 벗어났다. 이제 다시 띄워도 성가시지 않다.
  if (session.dismissed && (!hit || session.dismissed !== keyOf(hit))) session.dismissed = null

  if (session.suggested && (!hit || hit.start !== session.suggested.start)) {
    session.suggested = null
    popover.hide()
  }
})

// 밑줄을 클릭하지 않고도 글 전체를 훑을 수 있게 단축키를 하나 둔다.
// Alt를 섞어 두면 편집기가 자체적으로 쓰는 조합과 부딪히지 않는다.
document.addEventListener(
  'keydown',
  (event) => {
    if (!session || !event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'f') return
    event.preventDefault()
    event.stopPropagation()
    const fixed = fixAll()
    toast(fixed > 0 ? `${fixed}곳을 고쳤습니다` : '고칠 것이 없습니다')
  },
  true,
)

// 편집기가 통째로 사라지는 경우(SPA 이동)에 매달린 레이어를 정리한다.
new MutationObserver(() => {
  if (session && !document.contains(session.target.element)) detach()
}).observe(document.documentElement, { childList: true, subtree: true })

/**
 * 이미 포커스가 가 있는 입력칸을 붙잡는다.
 *
 * 콘텐츠 스크립트는 `document_idle`에 돈다. 그런데 구글 검색처럼 **페이지가 뜨자마자
 * 입력칸에 자동으로 포커스를 주는 사이트**에서는 그 포커스가 우리보다 먼저 끝난다.
 * 그러면 `focusin`이 영영 오지 않아서, 사용자가 다른 데를 클릭했다 돌아오기 전까지
 * 아무 일도 일어나지 않는다. 검색창에 바로 타이핑하는 것이 가장 흔한 쓰임인데도 그렇다.
 *
 * 그래서 시작할 때 지금 포커스가 어디 있는지 직접 본다.
 */
function attachActive(): void {
  const target = toEditable(document.activeElement)
  if (target) attach(target)
}

async function boot(): Promise<void> {
  ;[settings, ignoreStore] = await Promise.all([loadSettings(), openIgnoreStore({ name: 'gochim-extension' })])
  onSettingsChanged((next) => {
    settings = next
    if (!next.enabled) {
      session?.layer.render([])
      popover.hide()
    } else {
      scheduleCheck(0)
    }
  })
  if (session) scheduleCheck(0)
  else attachActive()
}

void boot()
