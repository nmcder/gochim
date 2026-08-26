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

/**
 * 아직 답을 기다리는 요청들. 워커가 답하거나 버렸다고 알려 줄 때 풀린다.
 *
 * 열쇠는 **이 문서가 스스로 매긴 번호**다. 보내온 쪽의 번호를 쓰면 안 된다 —
 * 콘텐츠 스크립트는 `all_frames: true`라 탭마다·아이프레임마다 따로 돌고
 * 저마다 1번부터 센다. 그런데 이 문서는 브라우저에 **하나뿐**이라 그 번호가 겹친다.
 *
 * 겹치면 나중 요청이 앞 요청의 `sendResponse`를 말없이 덮고, 워커가 앞엣것의 답을
 * 돌려주면 **덮어쓴 쪽의 채널로 나간다.** 받는 쪽의 `id === latest` 검사는 번호가
 * 같으니 그대로 통과하고, 남의 창에서 나온 진단이 내 창 offset으로 밀려 그려진다.
 * 덮인 쪽은 답을 영영 못 받아 메시지 채널이 매달린 채 남는다.
 *
 * 글이 망가지지는 않는다 — 고치는 세 길이 전부 `text.slice(...) === d.text`를
 * 대조한다. 하지만 밑줄과 카드에는 그 대조가 없어 **남의 글자에 밑줄이 그어지고,
 * 눌러도 아무 일이 없는 카드**가 뜬다.
 */
let nextRun = 0
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
  // 보내온 쪽의 번호는 버리고 여기서 다시 매긴다. 답은 `sendResponse` 로만 돌아가고
  // `MorphReply` 에는 번호가 없으므로, 보낸 쪽은 이 번호를 알 필요가 없다.
  const id = (nextRun += 1)
  waiting.set(id, sendResponse)
  const request: WorkerRequest = {
    id,
    text: message.text,
    ignore: message.ignore,
    ...(message.minConfidence != null ? { minConfidence: message.minConfidence } : {}),
    ...(message.categories ? { categories: message.categories } : {}),
  }
  worker.postMessage(request)
  // 답이 늦게 오므로 채널을 열어 둔다.
  return true
})
