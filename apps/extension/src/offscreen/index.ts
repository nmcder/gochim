import type { WorkerRequest, WorkerResponse } from '../worker/morph-worker.js'
import { MORPH_RUN, type MorphReply, type MorphRun } from '../shared/morph-message.js'

/**
 * 오프스크린 문서 — 형태소 워커를 여기서 만든다.
 *
 * 화면에 보이지 않는 확장 자신의 페이지다. 여기서 만든 워커는 **확장의 출처**를 쓰므로
 * 콘텐츠 스크립트에서 막히던 일이 없고, 페이지의 CSP도 받지 않는다.
 * (왜 이렇게 됐는지는 [morph-message.ts](../shared/morph-message.ts) 참고)
 *
 * 탭이 몇 개든 이 문서는 브라우저에 **하나만** 뜬다. 예전에는 프레임마다 워커가 하나씩
 * 생겨 1.6MB를 따로 지고 있었다.
 */

const worker = new Worker(chrome.runtime.getURL('garu/morph-worker.js'), { type: 'module' })

/** 아직 답을 기다리는 요청들. 워커가 답하거나 버렸다고 알려 줄 때 풀린다. */
const waiting = new Map<number, (reply: MorphReply) => void>()

function settle(id: number, reply: MorphReply): void {
  const respond = waiting.get(id)
  if (!respond) return
  waiting.delete(id)
  respond(reply)
}

worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
  const message = event.data
  if (message.type === 'result') {
    settle(message.id, { ok: true, diagnostics: message.diagnostics })
    return
  }
  if (message.type === 'dropped') {
    settle(message.id, { ok: false, reason: 'dropped' })
    return
  }
  if (message.type === 'error') {
    // 어느 요청이 깨졌는지 워커가 알려 주지 않는다. 기다리던 것을 모두 푼다.
    for (const id of [...waiting.keys()]) settle(id, { ok: false, reason: 'error', message: message.message })
  }
})

worker.addEventListener('error', (event) => {
  for (const id of [...waiting.keys()]) settle(id, { ok: false, reason: 'error', message: String(event.message) })
})

chrome.runtime.onMessage.addListener((message: MorphRun, _sender, sendResponse) => {
  if (message?.type !== MORPH_RUN) return undefined
  waiting.set(message.id, sendResponse)
  const request: WorkerRequest = { id: message.id, text: message.text, ignore: message.ignore }
  worker.postMessage(request)
  // 답이 늦게 오므로 채널을 열어 둔다.
  return true
})
