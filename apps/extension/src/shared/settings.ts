import type { Category } from '@gochim/core'

/**
 * 확장 설정.
 *
 * `chrome.storage.local`만 쓴다 — `sync`를 쓰면 설정이 구글 서버를 거치고,
 * 그건 "아무것도 밖으로 보내지 않는다"는 이 확장의 전제와 어긋난다.
 */

export interface Settings {
  /** 밑줄을 그을지. 끄면 콘텐츠 스크립트가 아무 일도 하지 않는다. */
  enabled: boolean
  /** 이 확신도 미만의 진단은 보여 주지 않는다. */
  minConfidence: number
  /** 켜 둘 분류. 비우면 전부. */
  categories: Category[]
  /**
   * 형태소 분석 층(3층)을 쓸지.
   *
   * 기본값이 꺼짐인 이유는 크기다 — WASM 0.4MB + 모델 1.2MB를 내려받는다.
   * 켜면 품사를 보고 판정해 `먹을만큼만` 같은 띄어쓰기를 더 잡는다.
   */
  morph: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  minConfidence: 0,
  categories: [],
  morph: false,
}

const KEY = 'settings'

function storage(): chrome.storage.StorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null
}

export async function loadSettings(): Promise<Settings> {
  const area = storage()
  if (!area) {
    // 확장 밖(스모크 테스트 페이지)에서 실행될 때 설정을 주입할 수 있게 열어 둔다.
    const injected = (globalThis as { __gochimSettings?: Partial<Settings> }).__gochimSettings
    return { ...DEFAULT_SETTINGS, ...injected }
  }
  try {
    const stored = await area.get(KEY)
    return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch }
  await storage()?.set({ [KEY]: next })
  return next
}

/** 다른 탭이나 설정 화면에서 값이 바뀌면 알려 준다. */
export function onSettingsChanged(listener: (settings: Settings) => void): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[KEY]) return
    listener({ ...DEFAULT_SETTINGS, ...(changes[KEY]!.newValue as Partial<Settings>) })
  })
}
