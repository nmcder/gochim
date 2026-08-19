/**
 * 남의 페이지에 있는 입력칸을 다루기 위한 얇은 추상화.
 *
 * 브라우저의 편집 가능한 자리는 두 종류이고, 둘은 다루는 법이 완전히 다르다.
 *  - `<textarea>` / `<input>` — 값이 문자열 하나다. DOM에 글자가 없다.
 *  - `contenteditable`        — 값이 DOM 트리다. 텍스트 노드가 흩어져 있다.
 *
 * 밑줄을 긋는 방법도 여기서 갈린다([underline.ts](./underline.ts) 참고).
 *
 * ## contenteditable의 오프셋은 한 곳에서만 만든다
 *
 * 예전에는 검사할 글을 `innerText`로 읽고, 오프셋→DOM 변환은 텍스트 노드를 세어서 했다.
 * 이 둘은 **줄바꿈을 세는 방식이 달랐다.** `innerText`는 블록 경계마다 줄바꿈을 만들어
 * 내는데 노드 순회는 `<br>`만 셌다. 그래서 문단이 하나 지날 때마다 오프셋이 한 글자씩
 * 밀렸고, 문단 일곱 개짜리 글에서는 밑줄이 열 글자 넘게 어긋난 자리에 그어졌다.
 * 고치기를 누르면 엉뚱한 자리가 바뀌었다.
 *
 * 그래서 지금은 [readText]가 **글과 위치 지도를 한 번에** 만든다.
 * 읽기와 쓰기가 같은 순회를 쓰므로 둘이 어긋날 방법이 없다.
 */

export interface EditableTarget {
  readonly element: HTMLElement
  readonly kind: 'field' | 'rich'
  /** 검사할 전체 텍스트. */
  getText(): string
  /** [start, end) 구간을 갈아 끼운다. 사용자의 되돌리기(Ctrl+Z)를 깨지 않는 방법을 쓴다. */
  replaceRange(start: number, end: number, replacement: string): void
}

const FIELD_TYPES = new Set(['text', 'search', 'url', 'email', ''])

/** 이 요소가 우리가 손댈 수 있는 입력칸인가. */
export function toEditable(node: EventTarget | null): EditableTarget | null {
  if (!(node instanceof HTMLElement)) return null

  if (node instanceof HTMLTextAreaElement) return fieldTarget(node)
  if (node instanceof HTMLInputElement && FIELD_TYPES.has(node.type)) return fieldTarget(node)

  const editableRoot = node.closest<HTMLElement>('[contenteditable=""],[contenteditable="true"]')
  if (editableRoot) return richTarget(editableRoot)

  return null
}

function fieldTarget(element: HTMLTextAreaElement | HTMLInputElement): EditableTarget {
  return {
    element,
    kind: 'field',
    getText: () => element.value,
    replaceRange(start, end, replacement) {
      // execCommand는 낡았지만, 입력칸의 되돌리기 스택을 유지하는 유일한 방법이다.
      // 실패하면 값을 직접 바꾸고 input 이벤트를 흉내 낸다(리액트 같은 프레임워크가 알아채도록).
      element.focus()
      element.setSelectionRange(start, end)
      const inserted = document.execCommand('insertText', false, replacement)
      if (!inserted) {
        const value = element.value
        element.value = value.slice(0, start) + replacement + value.slice(end)
        element.setSelectionRange(start + replacement.length, start + replacement.length)
        element.dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
  }
}

function richTarget(element: HTMLElement): EditableTarget {
  return {
    element,
    kind: 'rich',
    getText: () => readText(element).text,
    replaceRange(start, end, replacement) {
      const range = rangeFor(element, start, end)
      if (!range) return
      const selection = window.getSelection()
      if (!selection) return
      selection.removeAllRanges()
      selection.addRange(range)
      if (!document.execCommand('insertText', false, replacement)) {
        range.deleteContents()
        range.insertNode(document.createTextNode(replacement))
        element.dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
  }
}

/** 줄바꿈을 만들어 내는 요소. 이 경계에서 글이 이어 붙으면 없던 낱말이 생긴다. */
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIELDSET',
  'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HGROUP', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
  'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
])

interface Segment {
  node: Text
  /** 이 텍스트 노드가 전체 글에서 차지하는 구간. */
  start: number
  end: number
}

interface TextMap {
  text: string
  segments: Segment[]
}

/**
 * contenteditable의 글과 위치 지도를 함께 만든다.
 *
 * `innerText`를 쓰지 않는 이유는 그 값이 CSS(줄바꿈, `display`, 가시성)에 따라
 * 달라져서 DOM 순회로 되짚을 수 없기 때문이다. 여기서는 **우리가 정한 규칙**으로
 * 글을 만들고, 그 규칙으로 되짚는다. 정확히 브라우저와 같을 필요는 없고
 * 읽기와 쓰기가 서로 같기만 하면 된다.
 */
export function readText(root: HTMLElement): TextMap {
  let text = ''
  const segments: Segment[] = []

  const breakLine = (): void => {
    if (text.length > 0 && !text.endsWith('\n')) text += '\n'
  }

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.textContent ?? ''
      if (data.length === 0) return
      segments.push({ node: node as Text, start: text.length, end: text.length + data.length })
      text += data
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      text += '\n'
      return
    }

    const isBlock = BLOCK_TAGS.has(node.tagName)
    if (isBlock) breakLine()
    for (const child of node.childNodes) visit(child)
    if (isBlock) breakLine()
  }

  for (const child of root.childNodes) visit(child)
  return { text, segments }
}

/**
 * DOM 위치를 글자 오프셋으로 옮긴다. [rangeFor]의 반대 방향이다.
 *
 * `Selection.anchorOffset`은 **그 텍스트 노드 안에서의** 위치라 문서 전체 기준이 아니다.
 * 긴 글에서 커서 주변만 잘라 검사하려면 전체 기준 위치가 필요하다.
 */
export function offsetOf(root: HTMLElement, node: Node, offsetInNode: number): number {
  const { segments } = readText(root)

  if (node.nodeType === Node.TEXT_NODE) {
    const segment = segments.find((s) => s.node === node)
    if (segment) return segment.start + Math.min(offsetInNode, segment.end - segment.start)
    return 0
  }

  // 커서가 요소에 걸려 있으면 그 앞 자식들까지의 길이로 어림한다.
  const children = [...node.childNodes].slice(0, offsetInNode)
  let last = 0
  for (const child of children) {
    for (const segment of segments) {
      if (segment.node === child || child.contains(segment.node)) last = Math.max(last, segment.end)
    }
  }
  return last
}

/** 글자 오프셋을 DOM Range로 옮긴다. [readText]가 만든 지도를 그대로 쓴다. */
export function rangeFor(root: HTMLElement, start: number, end: number): Range | null {
  const { segments } = readText(root)
  if (segments.length === 0) return null

  const range = document.createRange()
  let opened = false

  for (const segment of segments) {
    if (!opened && start < segment.end) {
      range.setStart(segment.node, Math.max(0, start - segment.start))
      opened = true
    }
    if (opened && end <= segment.end) {
      range.setEnd(segment.node, Math.max(0, end - segment.start))
      return range
    }
  }

  if (!opened) return null
  // 끝점이 글 밖이면 마지막 노드 끝으로 붙인다.
  const last = segments[segments.length - 1]!
  range.setEnd(last.node, last.end - last.start)
  return range
}
