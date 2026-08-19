import { allMorphRules, check, type Diagnostic } from '@gochim/core'
import { createAnalyzer, type GochimAnalyzer } from '@gochim/morph'

/**
 * 형태소 층 워커.
 *
 * 2만 자 글에서 형태소 분석은 385ms가 걸린다(`npm run bench`).
 * 메인 스레드에서 돌리면 그동안 타이핑이 멈춘다 — 교정기로서는 실격이다.
 * 그래서 데모도 확장과 같은 구조를 쓴다.
 */

export type Request = { id: number; text: string }
export type Response =
  | { type: 'ready'; initMs: number }
  | { type: 'result'; id: number; diagnostics: Diagnostic[] }
  | { type: 'error'; message: string }

let analyzer: GochimAnalyzer | null = null
/** 마지막 요청만 처리한다. 타이핑 중에는 앞선 요청이 이미 쓸모없다. */
let pending: Request | null = null
let running = false

function post(message: Response): void {
  self.postMessage(message)
}

async function drain(): Promise<void> {
  if (running) return
  running = true
  try {
    while (pending) {
      const request = pending
      pending = null
      if (!analyzer) {
        const started = performance.now()
        analyzer = await createAnalyzer()
        post({ type: 'ready', initMs: Math.round(performance.now() - started) })
      }
      // 문자열 규칙은 메인 스레드가 이미 돌렸다. 여기서는 형태소 규칙만.
      const diagnostics = check(request.text, { analyzer, rules: [], morphRules: allMorphRules })
      post({ type: 'result', id: request.id, diagnostics })
    }
  } catch (error) {
    post({ type: 'error', message: String(error) })
  } finally {
    running = false
  }
}

self.addEventListener('message', (event: MessageEvent<Request>) => {
  pending = event.data
  void drain()
})
