import { allRules, VERSION, type Category } from '@gochim/core'
import { openIgnoreStore } from '@gochim/store'
import { loadSettings, saveSettings } from '../shared/settings.js'

/** 설정 화면. 무시 목록을 한 항목씩 되돌릴 수 있는 유일한 자리이기도 하다. */

const CATEGORY_LABELS: Record<Category, string> = {
  spelling: '맞춤법',
  spacing: '띄어쓰기',
  confusable: '혼동어',
  ending: '어미·서술격',
  redundancy: '겹말·군더더기',
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const enabled = $<HTMLInputElement>('enabled')
const morph = $<HTMLInputElement>('morph')
const confidence = $<HTMLInputElement>('confidence')
const confidenceValue = $('confidence-value')
const categoryBox = $('categories')
const inlineSuggest = $<HTMLInputElement>('inline-suggest')
const acceptKey = $<HTMLSelectElement>('accept-key')
const autofix = $<HTMLInputElement>('autofix')
const suppressNative = $<HTMLInputElement>('suppress-native')
const ignoredList = $<HTMLUListElement>('ignored')
const ignoredEmpty = $('ignored-empty')

/**
 * 무시 사전을 못 열어도 설정 화면은 떠야 한다.
 *
 * IndexedDB는 시크릿 창이나 사이트 데이터를 막아 둔 브라우저에서 거절당한다.
 * 예전에는 이 자리에서 멈춰 화면 전체가 빈 채로 남았다 — 켜고 끄는 스위치까지 죽는다.
 * 무시 목록만 못 보여 주고 나머지는 그대로 쓰게 한다.
 */
const store = await openIgnoreStore({ name: 'gochim-extension' }).catch(() => null)
let settings = await loadSettings()

enabled.checked = settings.enabled
confidence.value = String(settings.minConfidence)
confidenceValue.textContent = settings.minConfidence.toFixed(2)
$('meta').textContent = `규칙 ${allRules.length}개 · 엔진 @gochim/core v${VERSION}`

enabled.addEventListener('change', async () => {
  settings = await saveSettings({ enabled: enabled.checked })
})

morph.checked = settings.morph
morph.addEventListener('change', async () => {
  settings = await saveSettings({ morph: morph.checked })
})

inlineSuggest.checked = settings.inlineSuggest
inlineSuggest.addEventListener('change', async () => {
  settings = await saveSettings({ inlineSuggest: inlineSuggest.checked })
})

acceptKey.value = settings.acceptKey
acceptKey.addEventListener('change', async () => {
  settings = await saveSettings({ acceptKey: acceptKey.value as typeof settings.acceptKey })
})

suppressNative.checked = settings.suppressNativeSpellcheck
suppressNative.addEventListener('change', async () => {
  settings = await saveSettings({ suppressNativeSpellcheck: suppressNative.checked })
})

autofix.checked = settings.autoFix
autofix.addEventListener('change', async () => {
  settings = await saveSettings({ autoFix: autofix.checked })
})

confidence.addEventListener('input', () => {
  confidenceValue.textContent = Number(confidence.value).toFixed(2)
})
confidence.addEventListener('change', async () => {
  settings = await saveSettings({ minConfidence: Number(confidence.value) })
})

for (const category of Object.keys(CATEGORY_LABELS) as Category[]) {
  const label = document.createElement('label')
  label.className = 'check'
  const box = document.createElement('input')
  box.type = 'checkbox'
  // 빈 배열은 "전부 켬"을 뜻한다.
  box.checked = settings.categories.length === 0 || settings.categories.includes(category)
  box.addEventListener('change', async () => {
    const checked = [...categoryBox.querySelectorAll<HTMLInputElement>('input')]
      .map((input, index) => (input.checked ? (Object.keys(CATEGORY_LABELS)[index] as Category) : null))
      .filter((value): value is Category => value !== null)
    // 전부 켠 상태는 빈 배열로 저장한다 — 나중에 분류가 늘어도 자동으로 포함된다.
    settings = await saveSettings({ categories: checked.length === Object.keys(CATEGORY_LABELS).length ? [] : checked })
  })
  const count = allRules.filter((rule) => rule.category === category).length
  label.append(box, document.createTextNode(`${CATEGORY_LABELS[category]} (규칙 ${count}개)`))
  categoryBox.append(label)
}

function renderIgnored(): void {
  if (!store) {
    ignoredEmpty.textContent = '이 브라우저에서는 무시 목록을 열 수 없습니다.'
    ignoredEmpty.hidden = false
    return
  }
  const entries = store.list()
  ignoredList.replaceChildren()
  ignoredEmpty.hidden = entries.length > 0

  for (const entry of entries) {
    const item = document.createElement('li')
    const text = document.createElement('span')
    text.textContent = entry.text
    const rule = document.createElement('code')
    rule.textContent = entry.ruleId
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = '되돌리기'
    remove.addEventListener('click', async () => {
      await store.remove(entry.key)
      renderIgnored()
    })
    const left = document.createElement('div')
    left.append(text, document.createTextNode(' '), rule)
    item.append(left, remove)
    ignoredList.append(item)
  }
}

renderIgnored()
