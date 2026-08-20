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
/*
 * 어느 카드가 누구 것인지 밝히는 이름표.
 *
 * 확장을 깔면 남의 사이트 위에 우리 UI가 뜬다. 사이트가 원래 해 주는 기능인지
 * 확장이 하는 일인지 구별할 방법이 없으면, 안 되는 걸 사이트 탓으로 돌리거나
 * 반대로 사이트 기능을 우리가 망친 줄 안다. 이름을 달아 두면 그 혼동이 사라진다.
 *
 * 처음에는 머리글로 한 줄 얹었는데, 표시 하나 때문에 카드가 세로로 길어졌다.
 * 타이핑 중에 뜨는 카드는 글을 가리므로 한 줄이 아깝다.
 * 그래서 교정 표시 줄의 **남는 오른쪽 자리**에 얹는다. 높이가 늘지 않는다.
 *
 * 조용해야 한다 — 고칠 말보다 눈에 띄면 안 된다. 그래서 10.5px에 투명도를 준다.
 */
.brand {
  display: flex; align-items: center; gap: 4px;
  margin-left: auto; padding-left: 10px;
  font-size: 10.5px; letter-spacing: 0.02em; font-weight: 600;
  color: #16150f; opacity: 0.38;
  /* 고칠 말이 길면 줄바꿈에 밀리되, 이름표 자체는 쪼그라들지 않게 한다. */
  flex: none;
}
.brand svg { display: block; flex: none; }
.swap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; font-size: 15px; }
.from { color: #c2402d; text-decoration: line-through; }
.to { font-weight: 700; }
.arrow { opacity: 0.45; font-size: 11px; }
.msg { margin: 0; font-size: 13px; opacity: 0.8; }
.why { margin: 8px 0 0; padding: 8px 10px; border-radius: 6px; background: rgba(0, 0, 0, 0.04); font-size: 12.5px; opacity: 0.85; }
.refs { margin-top: 6px; font-size: 11px; opacity: 0.5; }
/*
 * 단추가 셋이면 카드 최대폭(340px)을 넘는다. 줄바꿈을 허용하지 않으면 글자가
 * 단추 상자 밖으로 흘러나와 옆 단추의 흰 바탕과 겹쳐 읽을 수 없게 된다.
 * 넘치면 다음 줄로 내린다.
 */
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.btn {
  appearance: none; font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 7px; cursor: pointer;
  white-space: nowrap; border: 1px solid rgba(0, 0, 0, 0.14); background: #fff; color: #16150f;
}
.btn--primary { background: #16150f; border-color: #16150f; color: #fff; font-weight: 600; }
.btn--quiet { background: transparent; border-color: transparent; color: #16150f; opacity: 0.65; }
/*
 * 한 번에 여러 곳을 바꾸므로 주 단추와 구별되어야 한다. 채우지 않고 테두리만 준다.
 * 색은 물려받지 않고 못 박는다 — 물려받게 두면 호스트나 테마에 따라 흰 글자가 흰 바탕에 얹힌다.
 */
.btn--all { font-weight: 600; background: transparent; color: #16150f; border-color: rgba(0, 0, 0, 0.38); }
/*
 * 어두운 테마는 **맨 마지막**에 둔다.
 * 앞에 두면 뒤따르는 밝은색 규칙이 같은 명시도로 덮어써서, 어두운 배경 위에
 * 어두운 글자가 얹힌다. 실제로 '모두 고치기'와 'Esc 닫기'가 그렇게 안 보였다.
 */
@media (prefers-color-scheme: dark) {
  .card { background: #1c1c16; color: #f2efe6; border-color: rgba(255, 255, 255, 0.14); }
  .why { background: rgba(255, 255, 255, 0.06) !important; }
  .btn { background: #2a2a22; color: #f2efe6; border-color: rgba(255, 255, 255, 0.16); }
  .btn--primary { background: #f2efe6; color: #16150f; }
  .btn--quiet { background: transparent; color: #f2efe6; }
  .btn--all { background: transparent; color: #f2efe6; border-color: rgba(255, 255, 255, 0.45); }
  .brand { color: #f2efe6; }
}

`

/**
 * 고침 표시.
 *
 * 물결 밑줄이 이 제품의 얼굴이라 그것을 그대로 그린다 — 글 두 줄과 그 아래 물결.
 * 인라인 SVG라 파일도 요청도 늘지 않는다.
 */
const BRAND_MARK = `<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 4.2h10M3 7.2h6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M2.6 11.6q1.2-1.7 2.4 0t2.4 0 2.4 0 2.4 0" fill="none" stroke="#cc3f33" stroke-width="1.5" stroke-linecap="round"/></svg>`

/** 교정 표시 줄 오른쪽에 붙는 이름표. 이 UI가 사이트가 아니라 고침의 것임을 밝힌다. */
function brandRow(): HTMLElement {
  const row = document.createElement('div')
  row.className = 'brand'
  // SVG는 우리가 쓴 상수라 안전하다. 사용자 입력은 여기 들어오지 않는다.
  row.innerHTML = BRAND_MARK
  const name = document.createElement('span')
  name.textContent = '고침'
  row.append(name)
  return row
}

export interface PopoverActions {
  onApply(diagnostic: Diagnostic): void
  onIgnore(diagnostic: Diagnostic): void
  /** 글 전체의 오류를 한 번에 고친다. */
  onApplyAll(): void
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
  /**
   * 글 전체에 남아 있는 오류 수.
   *
   * 2건 이상일 때만 '모두 고치기'를 띄운다. 하나뿐인데 '모두'라고 적으면
   * 무엇이 더 고쳐지는지 알 수 없어 누르기가 무섭다.
   */
  total?: number
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
      swap.append(from, arrow, to, brandRow())

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
      // 무엇으로 바뀌는지는 바로 위 교정 표시 줄이 이미 보여 준다.
      // 단추에 그 말을 또 적으면 길기만 하고, 대신 단축키를 적으면 다음번엔 손이 먼저 간다.
      applyButton.textContent = `고치기(${options.acceptKey ?? 'Tab'})`
      applyButton.addEventListener('click', () => {
        actions.onApply(diagnostic)
        hide()
      })

      const ignoreButton = document.createElement('button')
      ignoreButton.className = 'btn btn--quiet'
      // '고치기(Tab)'과 같은 꼴로 맞춘다. 두 단추가 다른 문법으로 적히면 눈에 걸린다.
      ignoreButton.textContent = options.compact ? '닫기(Esc)' : '무시'
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

      // 오래 쓴 글에는 오류가 수십 개씩 쌓여 있다. 하나씩 누르게 하면 아무도 끝까지 하지 않는다.
      const total = options.total ?? 0
      if (total > 1) {
        const allButton = document.createElement('button')
        allButton.className = 'btn btn--all'
        allButton.textContent = `모두 고치기 ${total}`
        allButton.title = '글 전체에서 찾은 오류를 한 번에 고칩니다. Ctrl+Z로 되돌릴 수 있습니다.'
        allButton.addEventListener('click', () => {
          hide()
          actions.onApplyAll()
        })
        actionRow.append(allButton)
      }

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
