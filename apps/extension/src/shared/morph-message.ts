import type { Category, Diagnostic } from '@gochim/core'

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

/**
 * 형태소 층에도 사용자 설정을 실어 보낸다.
 *
 * 안 실었더니 **3층만 설정을 무시하고 있었다.** 문턱을 0.99로 올리고 분류를
 * `spelling`만 켜 둔 사용자에게, 1층은 0건을 내는데 워커는 46건을 보냈고
 * 그중 44건이 사용자가 꺼 둔 띄어쓰기였다. 설정 화면이 거짓말을 한 셈이다.
 *
 * 무시 사전만 실려 있던 것은, 그것이 처음부터 워커 쪽에서 걸러야 하는 값이었기
 * 때문이다. 나머지 둘도 같은 자리에서 걸러야 한다.
 */
export interface MorphOptions {
  ignore: string[]
  /** 이 확신도 밑의 진단은 내지 않는다. */
  minConfidence?: number
  /** 켜 둔 분류만. 비어 있으면 전부. */
  categories?: Category[]
}

/** 콘텐츠 스크립트 → 서비스 워커. */
export interface MorphAsk extends MorphOptions {
  type: 'gochim:morph'
  id: number
  text: string
}

/** 서비스 워커 → 오프스크린 문서. */
export interface MorphRun extends MorphOptions {
  type: 'gochim:morph-run'
  id: number
  text: string
}

export type MorphReply =
  | { ok: true; diagnostics: Diagnostic[] }
  /** 더 새로운 요청이 들어와 이 요청은 버려졌다. 오류가 아니다. */
  | { ok: false; reason: 'dropped' }
  | { ok: false; reason: 'error'; message: string }

export const MORPH_ASK = 'gochim:morph'
export const MORPH_RUN = 'gochim:morph-run'
