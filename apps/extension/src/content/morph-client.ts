import type { Diagnostic } from '@gochim/core'
import type { WorkerRequest, WorkerResponse } from '../worker/morph-worker.js'

/**
 * 형태소 워커와 이야기하는 쪽.
 *
 * 워커는 **켠 사람에게만, 처음 필요한 순간에** 만들어진다.
 * 확장이 설치돼 있다는 이유만으로 모든 탭이 1.6MB를 지고 시작하지는 않는다.
 */

export interface MorphClient {
  /** 결과가 도착하면 콜백이 불린다. 마지막 요청의 결과만 전달된다. */
  request(text: string, ignore: readonly string[]): void
  terminate(): void
  readonly initMs: number | null
}

export interface MorphClientOptions {
  /** 워커 스크립트의 절대 URL. 확장에서는 `chrome.runtime.getURL(...)`로 만든다. */
  workerUrl: string
  onResult(diagnostics: Diagnostic[]): void
  onReady?(initMs: number): void
  onError?(message: string): void
}

export function createMorphClient(options: MorphClientOptions): MorphClient {
  const worker = new Worker(options.workerUrl, { type: 'module' })
  let nextId = 1
  let latest = 0
  let initMs: number | null = null

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    if (message.type === 'ready') {
      initMs = message.initMs
      options.onReady?.(message.initMs)
      return
    }
    if (message.type === 'error') {
      options.onError?.(message.message)
      return
    }
    // 늦게 도착한 옛 요청의 결과는 버린다. 그 사이 글이 바뀌었다.
    if (message.id === latest) options.onResult(message.diagnostics)
  })

  return {
    get initMs() {
      return initMs
    },
    request(text, ignore) {
      latest = nextId
      nextId += 1
      const request: WorkerRequest = { id: latest, text, ignore: [...ignore] }
      worker.postMessage(request)
    },
    terminate() {
      worker.terminate()
    },
  }
}
