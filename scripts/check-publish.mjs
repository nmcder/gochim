#!/usr/bin/env node
/**
 * 배포 직전에 **정말 나갈 만한 상태인가**를 확인한다.
 *
 * 세 패키지의 `prepublishOnly`가 이것을 부른다. 패키지 폴더에서 돈다.
 *
 * ## 왜 필요한가
 *
 * `dist`는 `.gitignore` 대상이다. 새로 클론한 자리에서 `npm publish`를 그냥 부르면
 * **빈 패키지가 나간다.** 한 번 나가면 그 버전은 다시 못 쓴다.
 *
 * `files`에 `dist`를 적어 두는 것만으로는 부족하다. 그건 "있으면 넣어라"이지
 * "없으면 멈춰라"가 아니다.
 *
 * ## 무엇을 보는가
 *
 * 진입점이 실제로 있고 비어 있지 않은가, 타입 선언이 함께 나가는가,
 * 그리고 `files`에 적어 둔 것이 하나도 빠지지 않았는가.
 * MIT로 내놓는 것이므로 LICENSE가 빠지면 그것만으로도 멈출 이유가 된다.
 */

import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const here = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'))

const problems = []

/** 있고, 비어 있지 않은가. */
function present(rel, { minBytes = 1 } = {}) {
  try {
    const st = statSync(resolve(here, rel))
    if (st.isDirectory()) return true
    if (st.size < minBytes) {
      problems.push(`${rel} 이 비었다 (${st.size}바이트)`)
      return false
    }
    return true
  } catch {
    problems.push(`${rel} 이 없다`)
    return false
  }
}

// 1) `files`에 적어 둔 것이 전부 있는가.
for (const entry of pkg.files ?? []) present(entry)

// 2) 진입점과 타입 선언. `exports`가 가리키는 실제 파일을 본다.
const entry = pkg.exports?.['.'] ?? {}
for (const rel of [entry.import ?? pkg.main, entry.types ?? pkg.types]) {
  if (rel) present(rel, { minBytes: 64 })
}

// 3) 라이선스 파일이 `files`에 적혀 있는가. 있어도 안 적으면 안 나간다.
if (pkg.license && !(pkg.files ?? []).includes('LICENSE')) {
  problems.push(`license 는 ${pkg.license} 인데 files 에 LICENSE 가 없다`)
}

if (problems.length > 0) {
  console.error(`\n${pkg.name} 는 아직 내보낼 상태가 아니다\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n  먼저 저장소 뿌리에서 \`npm run build\` 를 돌릴 것.`)
  console.error(`  (dist 는 .gitignore 대상이라 새 클론에는 없다)\n`)
  process.exit(1)
}

console.log(`  ✓ ${pkg.name} — 내보낼 준비가 됐다`)
