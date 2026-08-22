import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './shared/settings.js'
import { MORPH_ASK, MORPH_RUN, type MorphAsk, type MorphReply } from './shared/morph-message.js'

/**
 * 서비스 워커.
 *
 * 검사는 전부 콘텐츠 스크립트 안에서 끝나므로 하는 일이 거의 없다 — 설치 시 기본값을
 * 깔고, 툴바 아이콘으로 끄고 켜는 것. 네트워크는 쓰지 않는다.
 *
 * 하나 더 맡는 것이 **형태소 요청 중계**다. 콘텐츠 스크립트는 페이지의 출처를 쓰기 때문에
 * 확장 안의 스크립트로 워커를 만들 수 없다. 워커는 오프스크린 문서가 만들고,
 * 그 문서를 띄울 수 있는 것은 서비스 워커뿐이라 여기서 이어 준다.
 * (사정은 [morph-message.ts](./shared/morph-message.ts)에 적어 두었다)
 */

/** 만드는 중에 요청이 겹치면 `createDocument`가 던진다. 만들던 약속을 함께 기다린다. */
let creating: Promise<void> | null = null

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.WORKERS],
        justification: '형태소 분석기를 페이지 밖에서 돌리기 위해서입니다. 네트워크는 쓰지 않습니다.',
      })
      .finally(() => {
        creating = null
      })
  }
  await creating
}

chrome.runtime.onMessage.addListener((message: MorphAsk, _sender, sendResponse) => {
  if (message?.type !== MORPH_ASK) return undefined
  void (async () => {
    try {
      await ensureOffscreen()
      const reply: MorphReply = await chrome.runtime.sendMessage({
        type: MORPH_RUN,
        id: message.id,
        text: message.text,
        ignore: message.ignore,
      })
      sendResponse(reply)
    } catch (error) {
      sendResponse({ ok: false, reason: 'error', message: String(error) } satisfies MorphReply)
    }
  })()
  // 답이 늦게 오므로 채널을 열어 둔다.
  return true
})

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
