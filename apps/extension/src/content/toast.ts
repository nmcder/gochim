/**
 * 한 줄짜리 알림.
 *
 * '모두 고치기'는 화면 여러 곳을 한꺼번에 바꾼다. 눌렀는데 아무 말이 없으면
 * 무엇이 얼마나 바뀌었는지 알 수 없어 되돌려야 하나 망설이게 된다.
 * 몇 곳을 고쳤는지 숫자로 알려 주는 것만으로 그 망설임이 사라진다.
 *
 * 팝오버와 같은 이유로 Shadow DOM에 넣는다 — 호스트 CSS에 무너지지 않게.
 */

const STYLE = `
:host { all: initial; }
.toast {
  display: flex;
  align-items: center;
  gap: 7px;
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 2147483647;
  padding: 9px 16px;
  border-radius: 999px;
  background: #16150f;
  color: #f2efe6;
  font: 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', system-ui, sans-serif;
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease;
}
.toast--on { opacity: 1; }
/* 이 알림도 사이트가 아니라 고침이 띄운 것임을 밝힌다. */
.toast svg { display: block; flex: none; opacity: 0.75; }
@media (prefers-color-scheme: dark) {
  .toast { background: #f2efe6; color: #16150f; }
}
@media (prefers-reduced-motion: reduce) {
  .toast { transition: none; }
}
`

const VISIBLE_MS = 2200

let host: HTMLDivElement | null = null
let bubble: HTMLDivElement | null = null
let timer = 0

function ensure(): HTMLDivElement {
  if (bubble) return bubble
  host = document.createElement('div')
  host.style.setProperty('all', 'initial')
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLE
  bubble = document.createElement('div')
  bubble.className = 'toast'
  // 화면 낭독기가 읽되 초점을 빼앗지는 않게 한다.
  bubble.setAttribute('role', 'status')
  shadow.append(style, bubble)
  document.body.append(host)
  return bubble
}

/** 팝오버와 같은 표시. 두 UI가 한 식구임을 눈으로 잇는다. */
const BRAND_MARK =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
  '<path d="M3 4.2h10M3 7.2h6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
  '<path d="M2.6 11.6q1.2-1.7 2.4 0t2.4 0 2.4 0 2.4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
  '</svg>'

export function toast(message: string): void {
  const element = ensure()
  // SVG는 우리가 쓴 상수다. 메시지는 textContent로 따로 넣어 사용자 글이 마크업이 되지 않게 한다.
  element.innerHTML = BRAND_MARK
  const label = document.createElement('span')
  label.textContent = message
  element.append(label)
  // 이전 알림이 떠 있으면 시간을 다시 센다. 두 개가 겹쳐 뜨지 않는다.
  window.clearTimeout(timer)
  requestAnimationFrame(() => element.classList.add('toast--on'))
  timer = window.setTimeout(() => element.classList.remove('toast--on'), VISIBLE_MS)
}

export function destroyToast(): void {
  window.clearTimeout(timer)
  host?.remove()
  host = null
  bubble = null
}
