import { allRules, VERSION } from '@gochim/core'
import { openIgnoreStore } from '@gochim/store'
import { loadSettings, saveSettings } from '../shared/settings.js'

/**
 * 툴바 팝업.
 *
 * 여기서 할 일은 두 가지다 — 끄고 켜기, 그리고 **왜 이 확장이 안전한지 보여 주기**.
 * 권한 목록에 네트워크가 없다는 사실은 팝업에서 말해 주지 않으면 아무도 모른다.
 */

const enabledToggle = document.getElementById('enabled') as HTMLInputElement
const status = document.getElementById('status') as HTMLElement
const ignoredCount = document.getElementById('ignored-count') as HTMLElement
const clearIgnored = document.getElementById('clear-ignored') as HTMLButtonElement
const meta = document.getElementById('meta') as HTMLElement

const store = await openIgnoreStore({ name: 'gochim-extension' })

function renderIgnored(): void {
  const count = store.keys().size
  ignoredCount.textContent = `${count}개`
  clearIgnored.disabled = count === 0
}

const settings = await loadSettings()
enabledToggle.checked = settings.enabled
status.textContent = settings.enabled ? '켜져 있습니다' : '꺼져 있습니다'
meta.textContent = `규칙 ${allRules.length}개 · 엔진 v${VERSION}`
renderIgnored()

enabledToggle.addEventListener('change', async () => {
  const next = await saveSettings({ enabled: enabledToggle.checked })
  status.textContent = next.enabled ? '켜져 있습니다' : '꺼져 있습니다'
})

clearIgnored.addEventListener('click', async () => {
  await store.clear()
  renderIgnored()
})
