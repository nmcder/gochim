import { check, mergeDiagnostics, type Diagnostic } from '@gochim/core'
import { offsetOf, toEditable, type EditableTarget } from './editable.js'
import { createPopover } from './popover.js'
import { createMorphClient, type MorphClient } from './morph-client.js'
import { createUnderlineLayer, type UnderlineLayer } from './underline.js'
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

/** 두 층의 결과를 합쳐 다시 그린다. 같은 자리에 밑줄이 두 번 그어지지 않도록 엔진 규칙으로 정리한다. */
function paint(): void {
  if (!session) return
  session.diagnostics = session.morph.length > 0 ? mergeDiagnostics(session.base, session.morph) : session.base
  session.layer.render(session.diagnostics)
  suggestAtCaret()
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
  if (session.suggested && session.suggested.start === hit.start && session.suggested.end === hit.end) return

  const rect = session.layer.rectOf(hit)
  if (!rect) return
  session.suggested = hit
  popover.show(hit, rect, { compact: true, acceptKey: settings.acceptKey })
}

/**
 * 확신도가 높은 오류를 묻지 않고 고친다.
 *
 * **커서가 이미 지나간 낱말만** 손댄다. 지금 치고 있는 글자를 바꾸면
 * 글자가 튀어서 입력이 망가진다. 그래서 뒤에 공백이 온 것만 고친다.
 */
function autoFix(): boolean {
  const threshold = settings?.autoFixAbove ?? 0
  if (!session || threshold <= 0) return false
  const caret = caretOf(session.target)
  const text = session.target.getText()
  const done = session.diagnostics
    .filter((d) => d.end < caret && d.confidence >= threshold && /\s/.test(text[d.end] ?? ''))
    .sort((a, b) => b.start - a.start)
  const target = done[0]
  const replacement = target?.suggestions[0]
  if (!target || replacement == null) return false
  session.target.replaceRange(target.start, target.end, replacement)
  return true
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
  }
  scheduleCheck(0)
}

document.addEventListener('focusin', (event) => {
  const target = toEditable(event.target)
  if (target) attach(target)
})

document.addEventListener('input', (event) => {
  if (session && event.target === session.target.element) scheduleCheck()
})

document.addEventListener(
  'click',
  (event) => {
    if (popover.contains(event.target as Node)) return
    if (!session) {
      popover.hide()
      return
    }
    const hit = session.layer.hitTest(event.clientX, event.clientY, session.diagnostics)
    if (!hit) {
      popover.hide()
      return
    }
    const rect = session.layer.rectOf(hit)
    if (rect) popover.show(hit, rect)
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
      if (session) session.suggested = null
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

// 커서가 오류 밖으로 나가면 저절로 띄운 카드는 닫는다.
document.addEventListener('selectionchange', () => {
  if (!session || !session.suggested) return
  const hit = diagnosticAtCaret(caretOf(session.target))
  if (!hit || hit.start !== session.suggested.start) {
    session.suggested = null
    popover.hide()
  }
})

// 편집기가 통째로 사라지는 경우(SPA 이동)에 매달린 레이어를 정리한다.
new MutationObserver(() => {
  if (session && !document.contains(session.target.element)) detach()
}).observe(document.documentElement, { childList: true, subtree: true })

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
}

void boot()
