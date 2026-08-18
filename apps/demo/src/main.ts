import { VERSION, allRules, check, ignoreKey, type Analyzer, type Diagnostic } from '@gochim/core'

const SAMPLE = [
  '어제는 정말 어의없는 일이 있었어. 담당자한테 몇일 뒤에 연락 준다고 했는데 아직도 소식이 없어.',
  '이렇게 하면 안 되요. 나도 할수있는 만큼은 다 했을뿐이야.',
  '지금 회의중이라 못 받으니까 끝나는대로 전화할께요.',
  '그 사람이 그런 말을 했을리가 없어. 신발을 신은채로 들어올 사람이 아니야.',
  '이런 상황이 올줄 몰랐어.',
].join('\n')

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} 를 찾을 수 없습니다`)
  return el as T
}

const input = $<HTMLTextAreaElement>('input')
const highlights = $<HTMLDivElement>('highlights')
const findingList = $<HTMLOListElement>('findings')
const emptyNote = $<HTMLParagraphElement>('empty')
const statChars = $('stat-chars')
const statIssues = $('stat-issues')
const statTime = $('stat-time')
const fixAllButton = $<HTMLButtonElement>('fix-all')
const morphToggle = $<HTMLInputElement>('morph-toggle')
const morphNote = $('morph-note')
const resetIgnoredButton = $<HTMLButtonElement>('reset-ignored')

/**
 * 형태소 분석기. 1.6MB라 **켤 때만** 내려받는다.
 * 이 지연 로딩이 코어와 형태소 층을 나눠 둔 이유 그 자체다.
 */
let analyzer: (Analyzer & { destroy(): void }) | null = null

/** 이번 세션에서 무시한 항목. Phase 1에서 IndexedDB로 옮긴다. */
const ignored = new Set<string>()

let diagnostics: Diagnostic[] = []
let activeIndex = -1

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/**
 * 결과 카드에 보여줄 어절 단위 문맥.
 *
 * 엔진은 밑줄을 정확히 그으려고 오류 구간을 최소로 잡는다(`전화할께요`의 `께`).
 * 그대로 카드에 쓰면 "께 ▸ 게"가 되어 읽히지 않으므로, 공백 사이 어절까지 넓혀 보여 준다.
 */
function wordContext(text: string, d: Diagnostic): { from: string; to: string } {
  const isBoundary = (ch: string | undefined) => ch === undefined || /[\s.,!?…~"'()[\]]/.test(ch)
  let start = d.start
  let end = d.end
  while (!isBoundary(text[start - 1])) start -= 1
  while (!isBoundary(text[end])) end += 1
  const from = text.slice(start, end)
  const to = text.slice(start, d.start) + (d.suggestions[0] ?? '') + text.slice(d.end, end)
  return { from, to }
}

/** 진단 구간을 <mark>로 감싼 HTML을 만든다. 진단은 서로 겹치지 않는다. */
function renderHighlights(text: string): void {
  let html = ''
  let cursor = 0
  diagnostics.forEach((d, i) => {
    html += escapeHtml(text.slice(cursor, d.start))
    const classes = ['hl', d.severity === 'warning' ? 'hl--warning' : '', i === activeIndex ? 'is-active' : '']
    html += `<mark class="${classes.filter(Boolean).join(' ')}">${escapeHtml(d.text)}</mark>`
    cursor = d.end
  })
  html += escapeHtml(text.slice(cursor))
  // 마지막 줄바꿈이 잘려 보이지 않도록 한 칸 덧댄다.
  highlights.innerHTML = `${html}\n`
}

function renderFindings(): void {
  findingList.replaceChildren()
  emptyNote.hidden = diagnostics.length > 0
  resetIgnoredButton.hidden = ignored.size === 0

  if (diagnostics.length === 0) {
    const hasText = input.value.trim().length > 0
    emptyNote.textContent = hasText ? '고칠 곳을 찾지 못했습니다.' : '글을 입력하면 결과가 여기에 나타납니다.'
    emptyNote.classList.toggle('empty--clean', hasText)
    return
  }

  diagnostics.forEach((d, index) => {
    const item = document.createElement('li')
    item.className = `finding${d.severity === 'warning' ? ' finding--warning' : ''}${
      index === activeIndex ? ' is-active' : ''
    }`
    item.dataset['index'] = String(index)

    const { from, to } = wordContext(input.value, d)
    const swap = document.createElement('div')
    swap.className = 'finding__swap'
    swap.innerHTML =
      `<span class="finding__from">${escapeHtml(from)}</span>` +
      `<span class="finding__arrow">▸</span>` +
      `<span class="finding__to">${escapeHtml(to)}</span>`
    item.append(swap)

    const message = document.createElement('p')
    message.className = 'finding__msg'
    message.textContent = d.message
    item.append(message)

    if (d.explain) {
      const why = document.createElement('p')
      why.className = 'finding__why'
      why.textContent = d.explain
      item.append(why)
    }

    const meta = document.createElement('div')
    meta.className = 'finding__meta'
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = d.ruleId
    meta.append(tag)
    if (d.refs?.length) meta.append(document.createTextNode(d.refs.join(' · ')))

    const actions = document.createElement('div')
    actions.className = 'finding__actions'

    const applyButton = document.createElement('button')
    applyButton.type = 'button'
    applyButton.className = 'btn btn--sm'
    applyButton.textContent = '고치기'
    applyButton.addEventListener('click', (event) => {
      event.stopPropagation()
      applyOne(d)
    })

    const ignoreButton = document.createElement('button')
    ignoreButton.type = 'button'
    ignoreButton.className = 'btn btn--sm btn--quiet'
    ignoreButton.textContent = '무시'
    ignoreButton.addEventListener('click', (event) => {
      event.stopPropagation()
      ignored.add(ignoreKey(d))
      run()
    })

    actions.append(applyButton, ignoreButton)
    meta.append(actions)
    item.append(meta)

    item.addEventListener('click', () => select(index, { focusInput: true }))
    findingList.append(item)
  })
}

function select(index: number, options: { focusInput?: boolean } = {}): void {
  activeIndex = index
  const d = diagnostics[index]
  if (d && options.focusInput) {
    input.focus()
    input.setSelectionRange(d.start, d.end)
  }
  renderHighlights(input.value)
  renderFindings()
  findingList.children[index]?.scrollIntoView({ block: 'nearest' })
}

function applyOne(d: Diagnostic): void {
  const replacement = d.suggestions[0]
  if (replacement == null) return
  const caret = input.selectionStart
  input.value = input.value.slice(0, d.start) + replacement + input.value.slice(d.end)
  const shift = replacement.length - (d.end - d.start)
  input.setSelectionRange(caret + (caret > d.start ? shift : 0), caret + (caret > d.start ? shift : 0))
  run()
}

function run(): void {
  const text = input.value
  const started = performance.now()
  diagnostics = check(text, analyzer ? { ignore: ignored, analyzer } : { ignore: ignored })
  const elapsed = performance.now() - started

  activeIndex = -1
  statChars.textContent = String(text.length)
  statIssues.textContent = String(diagnostics.length)
  statTime.textContent = `${elapsed.toFixed(1)}ms`
  fixAllButton.disabled = diagnostics.length === 0

  renderHighlights(text)
  renderFindings()
}

/** 입력 중에는 프레임 하나만큼 미뤄 타이핑을 막지 않는다. */
let scheduled = 0
function scheduleRun(): void {
  cancelAnimationFrame(scheduled)
  scheduled = requestAnimationFrame(run)
}

input.addEventListener('input', scheduleRun)
input.addEventListener('scroll', () => {
  highlights.scrollTop = input.scrollTop
  highlights.scrollLeft = input.scrollLeft
})

/** 본문에서 밑줄 친 곳을 클릭하면 해당 결과 카드를 연다. */
input.addEventListener('click', () => {
  const caret = input.selectionStart
  const index = diagnostics.findIndex((d) => caret >= d.start && caret <= d.end)
  if (index !== -1) select(index)
})

fixAllButton.addEventListener('click', () => {
  // 뒤에서부터 고쳐야 앞쪽 인덱스가 밀리지 않는다.
  let text = input.value
  for (let i = diagnostics.length - 1; i >= 0; i -= 1) {
    const d = diagnostics[i]!
    const replacement = d.suggestions[0]
    if (replacement == null) continue
    text = text.slice(0, d.start) + replacement + text.slice(d.end)
  }
  input.value = text
  run()
})

$('load-sample').addEventListener('click', () => {
  input.value = SAMPLE
  run()
  input.focus()
})

$('clear').addEventListener('click', () => {
  input.value = ''
  run()
  input.focus()
})

resetIgnoredButton.addEventListener('click', () => {
  ignored.clear()
  run()
})

morphToggle.addEventListener('change', async () => {
  if (!morphToggle.checked) {
    analyzer?.destroy()
    analyzer = null
    morphNote.textContent = '+1.6MB를 내려받아 품사까지 봅니다. 여전히 전부 기기 안에서.'
    run()
    return
  }

  morphToggle.disabled = true
  morphNote.textContent = '형태소 분석기를 내려받는 중… (WASM 0.4MB + 모델 1.2MB)'
  try {
    const started = performance.now()
    const { createAnalyzer } = await import('@gochim/morph')
    analyzer = await createAnalyzer()
    const elapsed = performance.now() - started
    morphNote.textContent = `품사까지 봅니다. 초기화 ${elapsed.toFixed(0)}ms · 이 파일들도 네트워크 밖으로 나가지 않습니다.`
  } catch (error) {
    analyzer = null
    morphToggle.checked = false
    morphNote.textContent = `분석기를 불러오지 못했습니다: ${String(error)}`
  } finally {
    morphToggle.disabled = false
    run()
  }
})

$('rule-count').textContent = String(allRules.length)
$('version').textContent = VERSION
input.value = SAMPLE
run()
