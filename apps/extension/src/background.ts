import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './shared/settings.js'

/**
 * 서비스 워커.
 *
 * 하는 일이 거의 없다 — 그게 맞다.
 * 검사는 전부 콘텐츠 스크립트 안에서 끝나므로 메시지를 주고받을 이유가 없고,
 * 네트워크를 쓰지 않으므로 백그라운드에서 돌 일도 없다.
 * 여기 남은 것은 설치 시 기본값을 깔고, 툴바 아이콘으로 끄고 켜는 것뿐이다.
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await saveSettings(DEFAULT_SETTINGS)
  }
  await refreshBadge()
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['settings']) void refreshBadge()
})

/** 꺼져 있다는 사실은 아이콘에서 바로 보여야 한다. */
async function refreshBadge(): Promise<void> {
  const settings = await loadSettings()
  await chrome.action.setBadgeText({ text: settings.enabled ? '' : 'OFF' })
  await chrome.action.setBadgeBackgroundColor({ color: '#8f8c81' })
}

void refreshBadge()
