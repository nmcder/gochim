import type { Diagnostic } from '@gochim/core'
import { rangeFor, type EditableTarget } from './editable.js'

/**
 * 밑줄 그리기.
 *
 * 남의 페이지에서 지켜야 할 규칙이 하나 있다 — **호스트 DOM을 건드리지 않는다.**
 * 리액트나 ProseMirror가 관리하는 트리에 `<span>`을 끼워 넣으면 그 편집기가 깨진다.
 *
 * 그래서 두 가지 방법만 쓴다.
 *  - contenteditable → **CSS Custom Highlight API**. Range만 등록하면 브라우저가 칠해 준다. DOM 변화 0.
 *  - textarea/input  → 같은 자리에 겹쳐 놓은 **거울 레이어**. 원본은 손대지 않는다.
 */

const HIGHLIGHT_ERROR = 'gochim-error'
const HIGHLIGHT_WARNING = 'gochim-warning'

const supportsHighlightApi = typeof CSS !== 'undefined' && 'highlights' in CSS

export interface UnderlineLayer {
  render(diagnostics: readonly Diagnostic[]): void
  /** 화면 좌표 기준으로 해당 진단이 그려진 사각형. 팝오버를 붙일 자리를 찾는 데 쓴다. */
  rectOf(diagnostic: Diagnostic): DOMRect | null
  /** 클릭 지점에 걸린 진단을 찾는다. */
  hitTest(x: number, y: number, diagnostics: readonly Diagnostic[]): Diagnostic | null
  destroy(): void
}

export function createUnderlineLayer(target: EditableTarget): UnderlineLayer {
  return target.kind === 'rich' && supportsHighlightApi ? highlightLayer(target) : mirrorLayer(target)
}

/* ── contenteditable: CSS Custom Highlight API ─────────────────── */

function highlightLayer(target: EditableTarget): UnderlineLayer {
  const ranges = new Map<Diagnostic, Range>()

  const push = (): void => {
    const error = new Highlight()
    const warning = new Highlight()
    for (const [diagnostic, range] of ranges) {
      ;(diagnostic.severity === 'warning' ? warning : error).add(range)
    }
    CSS.highlights.set(HIGHLIGHT_ERROR, error)
    CSS.highlights.set(HIGHLIGHT_WARNING, warning)
  }

  return {
    render(diagnostics) {
      ranges.clear()
      for (const diagnostic of diagnostics) {
        const range = rangeFor(target.element, diagnostic.start, diagnostic.end)
        if (range) ranges.set(diagnostic, range)
      }
      push()
    },
    rectOf(diagnostic) {
      const rects = ranges.get(diagnostic)?.getClientRects()
      return rects && rects.length > 0 ? rects[0]! : null
    },
    hitTest(x, y, diagnostics) {
      for (const diagnostic of diagnostics) {
        const rects = ranges.get(diagnostic)?.getClientRects()
        if (!rects) continue
        for (const rect of rects) {
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return diagnostic
        }
      }
      return null
    },
    destroy() {
      ranges.clear()
      CSS.highlights.delete(HIGHLIGHT_ERROR)
      CSS.highlights.delete(HIGHLIGHT_WARNING)
    },
  }
}

/* ── textarea/input: 겹쳐 놓은 거울 레이어 ─────────────────────── */

/** 거울과 원본의 글자가 한 픽셀도 어긋나면 안 되는 속성들. */
const MIRRORED_STYLES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'textIndent',
  'textAlign',
  'wordSpacing',
  'whiteSpace',
  'wordBreak',
  'overflowWrap',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'boxSizing',
  'direction',
  'tabSize',
] as const

function mirrorLayer(target: EditableTarget): UnderlineLayer {
  const field = target.element as HTMLTextAreaElement | HTMLInputElement
  const mirror = document.createElement('div')
  mirror.className = 'gochim-mirror'
  mirror.setAttribute('aria-hidden', 'true')
  document.body.append(mirror)

  const marks = new Map<Diagnostic, HTMLElement>()
  let current: readonly Diagnostic[] = []

  const syncGeometry = (): void => {
    const rect = field.getBoundingClientRect()
    const style = getComputedStyle(field)
    for (const property of MIRRORED_STYLES) mirror.style[property] = style[property]
    mirror.style.left = `${rect.left}px`
    mirror.style.top = `${rect.top}px`

    // 여기서 rect.width를 쓰면 안 된다.
    //
    // getBoundingClientRect는 **세로 스크롤바까지 포함한** 너비를 준다. 거울은
    // overflow:hidden이라 스크롤바가 없으므로, 그대로 베끼면 거울의 글줄이 원본보다
    // 스크롤바 너비(약 15px)만큼 넓어진다. 그러면 줄바꿈이 원본보다 늦게 일어나서,
    // 원본에서는 다음 줄로 넘어간 낱말이 거울에서는 앞 줄 끝에 남는다.
    // 붙여 넣은 긴 글에서 밑줄이 스크롤바 자리에 그어지던 것이 이 때문이었다.
    //
    // clientWidth는 스크롤바를 뺀 안쪽(패딩+콘텐츠) 너비다. 여기에 테두리만 더하고
    // box-sizing을 border-box로 못 박으면 거울의 글줄 너비가 원본과 정확히 같아진다.
    const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    const borderY = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
    mirror.style.boxSizing = 'border-box'
    mirror.style.width = `${field.clientWidth + borderX}px`
    mirror.style.height = `${field.clientHeight + borderY}px`

    // input은 한 줄이라 줄바꿈을 막아야 자리가 맞는다.
    if (field instanceof HTMLInputElement) mirror.style.whiteSpace = 'pre'
    mirror.scrollTop = field.scrollTop
    mirror.scrollLeft = field.scrollLeft
  }

  const paint = (): void => {
    const text = target.getText()
    marks.clear()
    mirror.replaceChildren()
    let cursor = 0
    for (const diagnostic of current) {
      mirror.append(document.createTextNode(text.slice(cursor, diagnostic.start)))
      const mark = document.createElement('span')
      mark.className = diagnostic.severity === 'warning' ? 'gochim-mark gochim-mark--warning' : 'gochim-mark'
      mark.textContent = text.slice(diagnostic.start, diagnostic.end)
      mirror.append(mark)
      marks.set(diagnostic, mark)
      cursor = diagnostic.end
    }
    // 마지막 줄바꿈이 접히지 않도록 한 칸 덧댄다.
    mirror.append(document.createTextNode(`${text.slice(cursor)}\n`))
    syncGeometry()
  }

  const onScroll = (): void => {
    mirror.scrollTop = field.scrollTop
    mirror.scrollLeft = field.scrollLeft
  }
  const onReflow = (): void => syncGeometry()

  field.addEventListener('scroll', onScroll)
  window.addEventListener('scroll', onReflow, true)
  window.addEventListener('resize', onReflow)
  const observer = new ResizeObserver(onReflow)
  observer.observe(field)

  return {
    render(diagnostics) {
      current = diagnostics
      paint()
    },
    rectOf(diagnostic) {
      return marks.get(diagnostic)?.getBoundingClientRect() ?? null
    },
    hitTest(x, y, diagnostics) {
      for (const diagnostic of diagnostics) {
        const mark = marks.get(diagnostic)
        if (!mark) continue
        for (const rect of mark.getClientRects()) {
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return diagnostic
        }
      }
      return null
    },
    destroy() {
      field.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
      observer.disconnect()
      mirror.remove()
      marks.clear()
    },
  }
}
