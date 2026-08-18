/**
 * 남의 페이지에 있는 입력칸을 다루기 위한 얇은 추상화.
 *
 * 브라우저의 편집 가능한 자리는 두 종류이고, 둘은 다루는 법이 완전히 다르다.
 *  - `<textarea>` / `<input>` — 값이 문자열 하나다. DOM에 글자가 없다.
 *  - `contenteditable`        — 값이 DOM 트리다. 텍스트 노드가 흩어져 있다.
 *
 * 밑줄을 긋는 방법도 여기서 갈린다([underline.ts](./underline.ts) 참고).
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
    getText: () => element.innerText,
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

/**
 * 글자 오프셋을 DOM Range로 옮긴다.
 *
 * `innerText`는 줄바꿈을 만들어 내므로 텍스트 노드를 이어 붙인 것과 길이가 어긋날 수 있다.
 * 그래서 `<br>`과 블록 경계에서 줄바꿈 한 글자를 세어 맞춘다.
 */
export function rangeFor(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const range = document.createRange()
  let offset = 0
  let started = false

  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName === 'BR') offset += 1
      node = walker.nextNode()
      continue
    }

    const length = node.textContent?.length ?? 0
    if (!started && offset + length >= start) {
      range.setStart(node, start - offset)
      started = true
    }
    if (started && offset + length >= end) {
      range.setEnd(node, end - offset)
      return range
    }
    offset += length
    node = walker.nextNode()
  }

  return started ? range : null
}
