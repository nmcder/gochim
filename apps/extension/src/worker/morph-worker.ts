import { allMorphRules, check, type Category, type Diagnostic } from '@gochim/core'
import { createAnalyzer, type GochimAnalyzer } from '@gochim/morph'

/**
 * 형태소 층 워커.
 *
 * 분석기는 WASM 0.4MB + 모델 1.2MB다. 이걸 콘텐츠 스크립트에 넣으면
 * 맞춤법을 쓰지도 않을 페이지까지 전부 1.6MB를 지고 시작한다.
 * 그래서 **켠 사람만, 별도 스레드에서** 받는다.
 *
 * 콘텐츠 스크립트는 1층 결과로 밑줄을 먼저 긋고, 여기 결과가 도착하면 합친다.
 * 사용자 입장에서는 밑줄이 즉시 뜨고 잠시 뒤 몇 개가 더 붙는다.
 */

export type WorkerRequest = {
  id: number
  text: string
  ignore: string[]
  /** 사용자 설정. 안 실으면 3층만 설정을 무시하게 된다. */
  minConfidence?: number
  categories?: Category[]
}
export type WorkerResponse =
  | { type: 'ready'; initMs: number }
  | { type: 'result'; id: number; diagnostics: Diagnostic[] }
  /** 더 새로운 요청이 들어와 버린 요청. 기다리는 쪽이 영영 매달리지 않도록 알려 준다. */
  | { type: 'dropped'; id: number }
  | { type: 'error'; message: string }

let analyzer: GochimAnalyzer | null = null
/** 마지막 요청만 처리한다. 타이핑 중에는 앞선 요청이 이미 쓸모없다. */
let pending: WorkerRequest | null = null
let running = false

async function ensureAnalyzer(): Promise<GochimAnalyzer> {
  if (analyzer) return analyzer
  const started = performance.now()
  // 모델은 워커 옆에 둔다. 번들된 뒤 상대 경로를 추측하지 않도록 명시적으로 넘긴다.
  analyzer = await createAnalyzer({ modelUrl: new URL('base.gmdl', import.meta.url).href })
  post({ type: 'ready', initMs: Math.round(performance.now() - started) })
  return analyzer
}

function post(message: WorkerResponse): void {
  self.postMessage(message)
}

async function drain(): Promise<void> {
  if (running) return
  running = true
  try {
    while (pending) {
      const request = pending
      pending = null
      const ready = await ensureAnalyzer()
      // 문자열 규칙은 콘텐츠 스크립트가 이미 돌렸다. 여기서는 형태소 규칙만 돈다.
      const diagnostics = check(request.text, {
        analyzer: ready,
        rules: [],
        morphRules: allMorphRules,
        ignore: request.ignore,
        ...(request.minConfidence != null ? { minConfidence: request.minConfidence } : {}),
        ...(request.categories && request.categories.length > 0 ? { categories: request.categories } : {}),
      })
      post({ type: 'result', id: request.id, diagnostics })
    }
  } catch (error) {
    post({ type: 'error', message: String(error) })
  } finally {
    running = false
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  // 타이핑 중에는 앞선 요청이 이미 쓸모없다. 다만 **버렸다는 사실은 알려야** 한다 —
  // 답을 기다리던 쪽이 영영 매달린 채 남으면 메시지 채널이 새어 나간다.
  if (pending) post({ type: 'dropped', id: pending.id })
  pending = event.data
  void drain()
})
