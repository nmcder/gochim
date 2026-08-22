import type { Diagnostic } from '@gochim/core'

/**
 * 콘텐츠 스크립트와 형태소 분석기 사이의 말.
 *
 * ## 왜 메시지를 거치게 됐나
 *
 * 예전에는 콘텐츠 스크립트가 워커를 직접 만들었다. 그런데 콘텐츠 스크립트는
 * 격리된 세계에서 돌아도 **출처(origin)는 그 페이지의 것**이라, 확장 안의 스크립트로
 * 워커를 만들려 하면 브라우저가 막는다.
 *
 *     Failed to construct 'Worker': Script at 'chrome-extension://…/morph-worker.js'
 *     cannot be accessed from origin 'https://www.google.com'.
 *
 * 이 때문에 형태소 층이 실제 웹페이지에서는 한 번도 돌지 않았다.
 * 재현율로 치면 0.955가 아니라 0.786으로 쓰고 있었던 셈이다.
 *
 * ## 블롭 워커를 쓰지 않은 이유
 *
 * 스크립트를 받아 와 `blob:` URL로 워커를 만드는 우회가 있다. 하지만 그 워커도
 * 페이지의 출처에서 돌기 때문에 **페이지의 CSP**를 그대로 받는다.
 * 오류가 처음 보고된 곳이 하필 구글이었다 — `worker-src`를 좁게 잠가 둔 사이트에서는
 * 그 길도 막힌다. 게다가 프레임마다 1.6MB를 따로 지게 된다.
 *
 * 그래서 확장 자신의 문서(offscreen document) 안에서 워커를 만든다.
 * 거기는 출처도 CSP도 확장의 것이라 막힐 일이 없고, 탭이 몇이든 **하나만** 뜬다.
 */

/** 콘텐츠 스크립트 → 서비스 워커. */
export interface MorphAsk {
  type: 'gochim:morph'
  id: number
  text: string
  ignore: string[]
}

/** 서비스 워커 → 오프스크린 문서. */
export interface MorphRun {
  type: 'gochim:morph-run'
  id: number
  text: string
  ignore: string[]
}

export type MorphReply =
  | { ok: true; diagnostics: Diagnostic[] }
  /** 더 새로운 요청이 들어와 이 요청은 버려졌다. 오류가 아니다. */
  | { ok: false; reason: 'dropped' }
  | { ok: false; reason: 'error'; message: string }

export const MORPH_ASK = 'gochim:morph'
export const MORPH_RUN = 'gochim:morph-run'
