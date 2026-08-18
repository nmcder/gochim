#!/usr/bin/env node
/**
 * 규칙 목록 문서 생성기.
 *
 * 규칙이 이미 예시·반례·근거를 코드 안에 들고 다니므로, 문서를 따로 쓰면 반드시 어긋난다.
 * 코드에서 뽑아 `docs/rules.md`로 굳힌다.
 *
 *   npm run rules:doc
 */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { allRules, allMorphRules } = await import(pathToFileURL(resolve(ROOT, 'packages/core/dist/index.js')).href)

const CATEGORY_LABEL = {
  spelling: '맞춤법',
  spacing: '띄어쓰기',
  confusable: '혼동어',
  ending: '어미·서술격',
}

const escape = (s) => String(s).replace(/\|/g, '\\|')

const lines = [
  '# 규칙 목록',
  '',
  '> 이 문서는 `npm run rules:doc`으로 코드에서 생성됩니다. 직접 고치지 마세요.',
  '',
  `현재 문자열 규칙 **${allRules.length}개**와 형태소 규칙 **${allMorphRules.length}개**.`,
  '사전형 규칙 하나는 여러 항목을 담고 있어, 실제로 잡는 표기 수는 더 많습니다.',
  '',
  '형태소 규칙은 `check(text, { analyzer })`로 분석기를 넘겼을 때만 돕니다.',
  '',
  '`확신도`는 문맥을 모르는 상태에서의 확신 정도입니다. `check(text, { minConfidence })`로 걸러낼 수 있습니다.',
  '',
]

const byCategory = new Map()
for (const rule of allRules) {
  byCategory.set(rule.category, [...(byCategory.get(rule.category) ?? []), rule])
}

for (const [category, rules] of byCategory) {
  lines.push(`## ${CATEGORY_LABEL[category] ?? category}`, '')
  for (const rule of rules) {
    const example = rule.examples[0]
    lines.push(`### \`${rule.id}\``, '')
    lines.push(
      `| | |`,
      `| --- | --- |`,
      `| 분류 | ${CATEGORY_LABEL[rule.category] ?? rule.category} |`,
      `| 심각도 | ${rule.severity === 'warning' ? '경고' : '오류'} |`,
      `| 확신도 | ${rule.confidence} |`,
      `| 예시 수 | ${rule.examples.length} |`,
      '',
    )
    if (example) {
      lines.push('```diff', `- ${example.wrong}`, `+ ${example.right}`, '```', '')
    }
    if (rule.examples.length > 1) {
      lines.push('<details><summary>예시 더 보기</summary>', '')
      for (const ex of rule.examples.slice(1, 40)) {
        lines.push(`- \`${escape(ex.wrong)}\` → \`${escape(ex.right)}\``)
      }
      if (rule.examples.length > 40) lines.push(`- … 외 ${rule.examples.length - 40}개`)
      lines.push('', '</details>', '')
    }
    if (rule.counterExamples?.length) {
      lines.push('**건드리면 안 되는 문장** (테스트로 강제됨)', '')
      for (const ce of rule.counterExamples) lines.push(`- ${escape(ce)}`)
      lines.push('')
    }
  }
}

// 형태소 규칙은 별도 절로 붙인다. 정규식이 없고 문장 전체의 분석 결과를 보기 때문이다.
lines.push('## 형태소 규칙 (3층)', '')
lines.push('분석기를 넘겼을 때만 도는 규칙입니다. 품사를 알기 때문에 1층이 예외 목록으로 막던 오탐이 저절로 걸러집니다.', '')
for (const rule of allMorphRules) {
  lines.push(`### \`${rule.id}\``, '')
  lines.push('| | |', '| --- | --- |', `| 분류 | ${CATEGORY_LABEL[rule.category] ?? rule.category} |`, `| 확신도 | ${rule.confidence} |`, '')
  for (const ex of rule.examples) lines.push(`- \`${escape(ex.wrong)}\` → \`${escape(ex.right)}\``)
  lines.push('')
  if (rule.counterExamples?.length) {
    lines.push('**건드리면 안 되는 문장**', '')
    for (const ce of rule.counterExamples) lines.push(`- ${escape(ce)}`)
    lines.push('')
  }
}

const out = resolve(ROOT, 'docs/rules.md')
writeFileSync(out, `${lines.join('\n')}\n`, 'utf8')
console.log(`규칙 문서 작성: ${out} (문자열 ${allRules.length}개 + 형태소 ${allMorphRules.length}개)`)
