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
   * **기본값은 켜짐이다.** 처음에는 크기(WASM 0.4MB + 모델 1.2MB) 때문에 꺼 두었는데,
   * 재 보니 골든·실문 표본 241편에서 이 층이 혼자 잡는 것이 44건 있었다.
   * `말 대로`(조사, 붙임)와 `들은 대로`(의존명사, 띄움)처럼 앞말의 품사가 정하는 자리는
   * 문자열만으로는 갈리지 않는다.
   *
   * 파일은 확장 안에 들어 있어 **네트워크는 쓰지 않는다.** 워커도 입력칸을 처음 만질 때
   * 만들므로, 글을 쓰지 않는 탭은 이 무게를 지지 않는다.
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
   * 묻지 않고 알아서 고칠지. **기본값은 꺼짐이다.**
   *
   * 켜면 밑줄도 카드도 뜨지 않는다. 다 쓰고 나서 무언가를 누를 필요가 없다는 것이
   * 이 도구가 가장 크게 덜어 주는 수고라, 한동안 이쪽을 기본으로 두었다.
   *
   * **2026-08-25에 되돌렸다.** 밖에서 온 글로 정밀도를 다시 재 보니 골든셋에서의
   * 1.000이 아니었다 — 평범한 정상 문장 25개 중 9개가 망가졌다. 진짜 https 페이지에
   * 확장을 붙여 그대로 재현했다.
   *
   *   먹지 않거나  → 먹지 안 거나      (anh-vs-an: 어미 목록에 '거'가 없다)
   *   십 년간      → 십 연간           (dueum-yeon: 공백을 어두로 오인한다)
   *   뒤를 이었다  → 뒤를이었다         (seosul-detached: '잇다'의 활용형을 모른다)
   *   일의 일부로  → 일의 일부러        (lexicon/일부로: 가드가 명사 15개 목록이다)
   *   내려다보니   → 내려다 보니        (bojo-boda: 합성어 목록에 빠져 있다)
   *
   * 이것들이 전부 `severity: 'error'` 라 자동 고침이 **묻지도 않고** 적용했다.
   * 게다가 자동 고침이 켜져 있으면 밑줄도 카드도 안 그려서 예고가 전혀 없다.
   *
   * 기능 자체가 틀린 것은 아니다. 틀린 것은 **무엇을 자동으로 적용해도 되는지 가리는 눈**이
   * 없다는 쪽이다 — 지금은 `severity` 하나가 '밑줄을 그을지'와 '묻지 않고 고칠지'를
   * 겹쳐서 정한다. 규칙마다 자동 적용 안전 여부를 따로 표시하게 되면 그때 다시 켠다.
   * 그때까지는 설정에서 손수 켤 수 있게만 열어 둔다.
   *
   * 켰을 때의 동작은 그대로다 — **이미 지나간 어절만** 고치고, 고친 뒤에는 커서를
   * 원래 자리로 되돌려 놓고, 한글 조합 중에는 아예 손대지 않는다.
   */
  autoFix: boolean
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
  morph: true,
  inlineSuggest: true,
  acceptKey: 'Tab',
  autoFix: false,
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
