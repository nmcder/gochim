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
  /**
   * 커서가 오류 위에 있으면 팝오버를 자동으로 띄울지.
   *
   * 끄면 밑줄을 클릭해야 고침 UI가 나온다. 켜면 타이핑을 멈춘 순간
   * 커서 자리에서 바로 고칠 수 있어 손이 마우스로 가지 않는다.
   */
  inlineSuggest: boolean
  /** 팝오버가 열려 있을 때 제안을 받아들이는 키. */
  acceptKey: 'Tab' | 'Enter' | 'Alt+Enter'
  /**
   * 확신도가 이 값 이상인 오류를 묻지 않고 바로 고친다. 0이면 끔.
   *
   * **커서가 지나간 자리만** 고친다 — 지금 치고 있는 낱말을 건드리면
   * 글자가 튀어서 타이핑이 망가진다.
   */
  autoFixAbove: number
  /**
   * 브라우저 기본 맞춤법 검사를 끌지.
   *
   * 크롬이 그리는 빨간 물결과 고침의 밑줄이 겹쳐 두 줄로 보이는 것을 막는다.
   * 입력칸의 `spellcheck` 속성만 잠시 바꾸고, 손을 뗄 때 원래대로 돌려놓는다.
   */
  suppressNativeSpellcheck: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  minConfidence: 0,
  categories: [],
  morph: false,
  inlineSuggest: true,
  acceptKey: 'Tab',
  autoFixAbove: 0,
  suppressNativeSpellcheck: true,
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
