import type { Category, Diagnostic } from '@gochim/core'
import type { WorkerRequest, WorkerResponse } from '../worker/morph-worker.js'
import { MORPH_ASK, type MorphReply } from '../shared/morph-message.js'

/**
 * 형태소 분석기와 이야기하는 쪽.
 *
 * 길이 둘이다.
 *
 *  - **확장 안에서** — 서비스 워커에 메시지를 보낸다. 워커는 오프스크린 문서가 만든다.
 *    콘텐츠 스크립트는 페이지의 출처를 쓰기 때문에 확장 안의 스크립트로 워커를 만들 수 없다.
 *  - **확장 밖에서** — 스모크 테스트 페이지처럼 `chrome.*`가 없는 곳에서는 워커를 직접 만든다.
 *    같은 출처라 막힐 일이 없다.
 *
 * 어느 쪽이든 **켠 사람에게만, 처음 필요한 순간에** 붙는다.
 * 확장이 설치돼 있다는 이유만으로 모든 탭이 1.6MB를 지고 시작하지는 않는다.
 */

/**
 * 형태소 층에 보낼 한 뭉치.
 *
 * `text`는 **글 전체가 아니라 커서 둘레의 창**이다. 1층은 진작부터 창으로 잘라
 * 보고 있었는데 3층만 글 전체를 받고 있었다 — 32,000자에서 912ms가 걸렸다.
 * 창으로 자르면 글이 아무리 길어도 86ms에서 평평하다.
 *
 * 창으로 자르면 진단의 자리가 창 기준이 되므로 `offset`을 더해 글 전체 기준으로
 * 되돌려야 한다. 그 일은 **여기서** 한다 — 요청 번호에 offset을 묶어 두면
 * 늦게 도착한 옛 답이 새 offset으로 밀리는 사고가 구조적으로 일어나지 않는다.
 */
export interface MorphRequest {
  /** 커서 둘레의 창. 글 전체가 아니다. */
  text: string
  /** 창이 글 전체에서 시작하는 자리. 결과 오프셋에 더한다. */
  offset: number
  ignore: readonly string[]
  minConfidence?: number
  categories?: Category[]
}

export interface MorphClient {
  /** 결과가 도착하면 콜백이 불린다. 마지막 요청의 결과만 전달된다. */
  request(input: MorphRequest): void
  terminate(): void
  readonly initMs: number | null
}

/** 창 기준 자리를 글 전체 기준으로 되돌린다. */
function shift(diagnostics: Diagnostic[], offset: number): Diagnostic[] {
  if (offset === 0) return diagnostics
  return diagnostics.map((d) => ({ ...d, start: d.start + offset, end: d.end + offset }))
}

export interface MorphClientOptions {
  /** 워커 스크립트의 절대 URL. 확장 밖에서 직접 만들 때만 쓴다. */
  workerUrl?: string
  onResult(diagnostics: Diagnostic[]): void
  onReady?(initMs: number): void
  onError?(message: string): void
}

/** 확장 안이면 중계 길로, 밖이면 워커를 직접 만드는 길로 간다. */
export function createMorphClient(options: MorphClientOptions): MorphClient | null {
  if (options.workerUrl) return createDirectClient({ ...options, workerUrl: options.workerUrl })
  // `chrome.runtime`이 있어도 `sendMessage`가 없는 자리가 있다(권한 없는 프레임).
  // 타입 위에서는 늘 있는 것으로 보이므로 실제 값을 본다.
  if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
    return createRelayClient(options)
  }
  return null
}

/**
 * 서비스 워커를 거쳐 오프스크린 문서의 워커에 묻는다.
 *
 * 답이 늦게 오는 사이 글이 바뀌면 그 답은 버린다. 워커도 앞선 요청을 버리는데,
 * 버렸다는 사실을 `dropped`로 알려 주므로 여기서 조용히 넘긴다 — 오류가 아니다.
 */
function createRelayClient(options: MorphClientOptions): MorphClient {
  let nextId = 1
  let latest = 0

  return {
    get initMs() {
      return null
    },
    request(input) {
      const id = nextId
      nextId += 1
      latest = id
      // offset을 이 요청 번호에 묶어 둔다. 따로 두면 답이 도착하는 사이
      // 커서가 움직여 창이 바뀌었을 때 엉뚱한 자리에 밑줄이 그어진다.
      const at = input.offset
      chrome.runtime
        .sendMessage({
          type: MORPH_ASK,
          id,
          text: input.text,
          ignore: [...input.ignore],
          ...(input.minConfidence != null ? { minConfidence: input.minConfidence } : {}),
          ...(input.categories && input.categories.length > 0 ? { categories: input.categories } : {}),
        })
        .then((reply: MorphReply | undefined) => {
          if (!reply) return
          if (reply.ok) {
            if (id === latest) options.onResult(shift(reply.diagnostics, at))
            return
          }
          if (reply.reason === 'dropped') return
          options.onError?.(reply.message)
        })
        .catch((error: unknown) => options.onError?.(String(error)))
    },
    terminate() {
      // 중계 길에서는 워커가 오프스크린 문서의 것이라 여기서 끊을 것이 없다.
    },
  }
}

function createDirectClient(options: MorphClientOptions & { workerUrl: string }): MorphClient {
  const worker = new Worker(options.workerUrl, { type: 'module' })
  let nextId = 1
  let latest = 0
  let initMs: number | null = null
  /** 요청 번호마다의 창 시작 자리. 답이 오면 그만큼 밀어 글 전체 기준으로 되돌린다. */
  const offsets = new Map<number, number>()

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    if (message.type === 'ready') {
      initMs = message.initMs
      options.onReady?.(message.initMs)
      return
    }
    if (message.type === 'error') {
      options.onError?.(message.message)
      offsets.clear()
      return
    }
    // 워커가 버린 요청. 중계 길에서는 매달린 `sendResponse`를 풀어 주는 신호지만
    // 여기서는 기다리는 것이 없으니 그냥 넘긴다 — 오류가 아니다.
    // (이 갈래가 빠져 있어 `undefined`를 결과로 넘길 뻔했고, 타입 검사가 그걸 잡았다)
    if (message.type === 'dropped') {
      offsets.delete(message.id)
      return
    }
    // 늦게 도착한 옛 요청의 결과는 버린다. 그 사이 글이 바뀌었다.
    if (message.id === latest) options.onResult(shift(message.diagnostics, offsets.get(message.id) ?? 0))
    offsets.delete(message.id)
  })

  return {
    get initMs() {
      return initMs
    },
    request(input) {
      latest = nextId
      nextId += 1
      offsets.set(latest, input.offset)
      const request: WorkerRequest = {
        id: latest,
        text: input.text,
        ignore: [...input.ignore],
        ...(input.minConfidence != null ? { minConfidence: input.minConfidence } : {}),
        ...(input.categories && input.categories.length > 0 ? { categories: input.categories } : {}),
      }
      worker.postMessage(request)
    },
    terminate() {
      worker.terminate()
    },
  }
}
