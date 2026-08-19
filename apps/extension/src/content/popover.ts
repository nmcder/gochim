import type { Diagnostic } from '@gochim/core'

/**
 * 제안 팝오버.
 *
 * 남의 페이지 위에 뜨므로 **Shadow DOM**에 넣는다.
 * 그러지 않으면 호스트 사이트의 CSS 한 줄에 레이아웃이 무너진다.
 */

const STYLE = `
:host { all: initial; }
.card {
  position: fixed;
  z-index: 2147483647;
  min-width: 240px;
  max-width: 340px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: #fff;
  color: #16150f;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.16);
  font: 14px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', system-ui, sans-serif;
  word-break: keep-all;
}
@media (prefers-color-scheme: dark) {
  .card { background: #1c1c16; color: #f2efe6; border-color: rgba(255, 255, 255, 0.14); }
  .why { background: rgba(255, 255, 255, 0.06) !important; }
  .btn { background: #2a2a22; color: #f2efe6; border-color: rgba(255, 255, 255, 0.16); }
  .btn--primary { background: #f2efe6; color: #16150f; }
}
.swap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; font-size: 15px; }
.from { color: #c2402d; text-decoration: line-through; }
.to { font-weight: 700; }
.arrow { opacity: 0.45; font-size: 11px; }
.msg { margin: 0; font-size: 13px; opacity: 0.8; }
.why { margin: 8px 0 0; padding: 8px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.04); font-size: 12.5px; opacity: 0.85; }
.refs { margin-top: 6px; font-size: 11px; opacity: 0.5; }
.actions { display: flex; gap: 6px; margin-top: 10px; }
.btn {
  appearance: none; font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 7px; cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.14); background: #fff; color: inherit;
}
.btn--primary { background: #16150f; border-color: #16150f; color: #fff; font-weight: 600; }
.btn--quiet { background: transparent; border-color: transparent; opacity: 0.65; }
`

export interface PopoverActions {
  onApply(diagnostic: Diagnostic): void
  onIgnore(diagnostic: Diagnostic): void
}

export interface ShowOptions {
  /**
   * 타이핑 중에 저절로 뜬 카드인가.
   *
   * 저절로 뜬 카드는 글을 가리면 안 되므로 설명과 근거를 접고 한 줄로 보여 준다.
   * 사용자가 밑줄을 직접 클릭했을 때는 전부 편다.
   */
  compact?: boolean
  /** 제안을 받아들이는 키. 카드에 안내로 적는다. */
  acceptKey?: string
}

export interface Popover {
  show(diagnostic: Diagnostic, anchor: DOMRect, options?: ShowOptions): void
  hide(): void
  readonly isOpen: boolean
  /** 지금 열려 있는 진단. 단축키로 적용할 때 쓴다. */
  readonly current: Diagnostic | null
  /** 열려 있는 카드의 제안을 적용한다. */
  accept(): void
  contains(node: Node): boolean
  destroy(): void
}

export function createPopover(actions: PopoverActions): Popover {
  const host = document.createElement('div')
  host.style.setProperty('all', 'initial')
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  const card = document.createElement('div')
  card.className = 'card'
  card.hidden = true
  shadow.append(style, card)
  document.body.append(host)

  let open = false
  let current: Diagnostic | null = null

  const hide = (): void => {
    open = false
    current = null
    card.hidden = true
    card.replaceChildren()
  }

  const accept = (): void => {
    if (!current) return
    const diagnostic = current
    hide()
    actions.onApply(diagnostic)
  }

  return {
    get isOpen() {
      return open
    },
    get current() {
      return current
    },
    accept,
    contains: (node) => host.contains(node) || shadow.contains(node),
    show(diagnostic, anchor, options = {}) {
      card.replaceChildren()
      current = diagnostic

      const swap = document.createElement('div')
      swap.className = 'swap'
      const from = document.createElement('span')
      from.className = 'from'
      from.textContent = diagnostic.text
      const arrow = document.createElement('span')
      arrow.className = 'arrow'
      arrow.textContent = '▸'
      const to = document.createElement('span')
      to.className = 'to'
      to.textContent = diagnostic.suggestions[0] ?? ''
      swap.append(from, arrow, to)

      card.append(swap)

      // 저절로 뜬 카드는 글 위를 덮는다. 한 줄로 줄이고 단축키만 알려 준다.
      if (!options.compact) {
        const message = document.createElement('p')
        message.className = 'msg'
        message.textContent = diagnostic.message
        card.append(message)

        if (diagnostic.explain) {
          const why = document.createElement('p')
          why.className = 'why'
          why.textContent = diagnostic.explain
          card.append(why)
        }
        if (diagnostic.refs?.length) {
          const refs = document.createElement('div')
          refs.className = 'refs'
          refs.textContent = diagnostic.refs.join(' · ')
          card.append(refs)
        }
      }

      const applyButton = document.createElement('button')
      applyButton.className = 'btn btn--primary'
      applyButton.textContent = options.compact
        ? `${options.acceptKey ?? 'Tab'} 고치기`
        : `'${diagnostic.suggestions[0] ?? ''}'로 고치기`
      applyButton.addEventListener('click', () => {
        actions.onApply(diagnostic)
        hide()
      })

      const ignoreButton = document.createElement('button')
      ignoreButton.className = 'btn btn--quiet'
      ignoreButton.textContent = options.compact ? 'Esc 닫기' : '무시'
      ignoreButton.addEventListener('click', () => {
        if (options.compact) hide()
        else {
          actions.onIgnore(diagnostic)
          hide()
        }
      })

      const actionRow = document.createElement('div')
      actionRow.className = 'actions'
      actionRow.append(applyButton, ignoreButton)
      card.append(actionRow)

      card.hidden = false
      open = true

      // 화면 밖으로 나가지 않게 자리를 잡는다.
      const { width, height } = card.getBoundingClientRect()
      const left = Math.min(Math.max(8, anchor.left), window.innerWidth - width - 8)
      const below = anchor.bottom + 8
      const top = below + height > window.innerHeight ? Math.max(8, anchor.top - height - 8) : below
      card.style.left = `${left}px`
      card.style.top = `${top}px`
    },
    hide,
    destroy() {
      host.remove()
    },
  }
}
