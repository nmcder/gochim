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
 * 파일이 다 있는가는 절반이다. 나머지 절반은 **남이 이걸 어떻게 불러 쓰는가**다.
 * 받는 쪽에서만 드러나는 사고는 우리 테스트가 절대 못 잡는다 — 받는 쪽이 없기 때문이다.
 * 그래서 여기서 소비자 흉내를 낸다.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const here = process.cwd()
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pkg = readJson(resolve(here, 'package.json'))

const problems = []
const fail = (why) => problems.push(why)

/** 있고, 비어 있지 않은가. */
function present(rel, { minBytes = 1 } = {}) {
  try {
    const st = statSync(resolve(here, rel))
    if (st.isDirectory()) return true
    if (st.size < minBytes) {
      fail(`${rel} 이 비었다 (${st.size}바이트)`)
      return false
    }
    return true
  } catch {
    fail(`${rel} 이 없다`)
    return false
  }
}

/* ── 1. 적어 둔 것이 전부 있는가 ─────────────────────────────── */

for (const entry of pkg.files ?? []) present(entry)

const entry = pkg.exports?.['.'] ?? {}
for (const rel of [entry.import ?? pkg.main, entry.types ?? pkg.types]) {
  if (rel) present(rel, { minBytes: 64 })
}

if (pkg.license && !(pkg.files ?? []).includes('LICENSE')) {
  fail(`license 는 ${pkg.license} 인데 files 에 LICENSE 가 없다`)
}

/* ── 2. `require()` 가 닿을 수 있는가 ────────────────────────────
 *
 * ESM 전용 패키지라도 `exports` 에 `import` 조건만 두면 안 된다. CommonJS 쪽에서
 * 부르면 노드가 파일에 닿기도 전에 **해석 단계에서** 이렇게 끝난다.
 *
 *     Error [ERR_PACKAGE_PATH_NOT_EXPORTED]:
 *       No "exports" main defined in .../@gochim/core/package.json
 *
 * 진짜 이유(ESM 이라 못 부른다)는 한마디도 없다. 게다가 타입스크립트는
 * `moduleResolution: nodenext` 에서도 **이걸 통과시킨다** — 컴파일은 조용히 되고
 * 실행할 때만 죽는다. 실측했다.
 *
 * `default` 를 하나 더 두면 노드가 파일까지는 닿는다. 요즘 노드(20.19+, 22.12+)는
 * 최상위 `await` 만 없으면 CJS 에서 ESM 을 그대로 `require` 할 수 있어 실제로 돌고,
 * 더 낮은 판에서는 적어도 "ESM 이라 안 된다"는 **맞는 오류**가 난다.
 */
if (pkg.exports?.['.']) {
  const conditions = pkg.exports['.']
  if (typeof conditions === 'object' && !conditions.require && !conditions.default) {
    fail(`exports["."] 에 require 도 default 도 없다 — CommonJS 쪽에서 부르면 ERR_PACKAGE_PATH_NOT_EXPORTED 로 끝난다`)
  }
}

// 최상위 await 가 있으면 위의 `require(esm)` 이 성립하지 않는다.
function distFiles() {
  const out = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name))
      else out.push(join(dir, e.name))
    }
  }
  walk(resolve(here, 'dist'))
  return out
}

const shipped = distFiles()

for (const file of shipped) {
  if (!file.endsWith('.js')) continue
  const body = readFileSync(file, 'utf8')
  // 함수 안의 await 는 상관없다. 들여쓰기 없이 줄 맨 앞에 오는 것만 본다.
  if (/^\s{0,2}(?:await |(?:const|let|var)\s[^\n]*=\s*await )/m.test(body)) {
    const bad = body.split('\n').find((l) => /^\s{0,2}(?:await |(?:const|let|var)\s[^\n]*=\s*await )/.test(l))
    fail(`${file.slice(here.length + 1)} 에 최상위 await 가 있다 — CommonJS 에서 require 할 수 없다: ${bad?.trim()}`)
  }
}

/* ── 3. 나가지 않는 파일을 가리키는 소스맵 주석이 없는가 ────────────
 *
 * `//# sourceMappingURL=` 주석은 남기고 `.map` 은 안 담거나, `.map` 은 담았는데
 * 그 안의 `sources` 가 가리키는 `src/` 는 안 담는 일이 쉽게 벌어진다.
 * 그러면 받는 쪽 번들러가 "소스맵을 못 읽었다"고 매번 경고를 뱉는다.
 * 우리한테는 아무 일도 안 일어나므로 여기서 잡지 않으면 영영 모른다.
 */
for (const file of shipped) {
  if (!/\.(js|d\.ts)$/.test(file)) continue
  const body = readFileSync(file, 'utf8')
  const m = /[/][/]#\s*sourceMappingURL=(.+)/.exec(body)
  if (!m) continue
  const url = m[1].trim()
  if (url.startsWith('data:')) continue
  const mapPath = resolve(file, '..', url)
  const rel = file.slice(here.length + 1)
  if (!existsSync(mapPath)) {
    fail(`${rel} 이 가리키는 소스맵 ${url} 이 없다`)
    continue
  }
  const map = readJson(mapPath)
  if (map.sourcesContent) continue
  for (const src of map.sources ?? []) {
    const srcPath = resolve(mapPath, '..', src)
    if (!existsSync(srcPath)) {
      fail(`${rel} 의 소스맵이 ${src} 를 가리키는데 그 파일은 없다`)
      break
    }
    // 있어도 `files` 에 안 적혀 있으면 tarball에는 안 들어간다.
    const top = srcPath.slice(here.length + 1).replace(/[\\/].*$/, '')
    if (!(pkg.files ?? []).includes(top)) {
      fail(`${rel} 의 소스맵이 ${src} 를 가리키는데 '${top}' 은 files 에 없어 함께 나가지 않는다`)
      break
    }
  }
}

/* ── 4. 세 패키지의 판이 어긋나지 않는가 ────────────────────────
 *
 * `@gochim/store` 는 `ignoreKey` 를 코어에서 **실행 시점에** 가져다 쓰고,
 * `@gochim/morph` 는 코어의 `Analyzer` 타입에 맞춰 자기 타입을 적는다.
 * 둘 다 peerDependency 로 코어의 지금 판에 캐럿을 건다. 0.x 에서 캐럿은 다음 마이너 판
 * 앞에서 끊기므로(`^0.2.0` 은 `<0.3.0`), **코어만 올리면** 받는 쪽에서 곧바로 ERESOLVE 가 난다.
 *
 * 답은 범위를 느슨하게 푸는 것이 아니다. 0.x 사이에는 깨는 변경이 실제로 들어가므로
 * 느슨하게 풀면 안 맞는 짝이 조용히 설치된다. **셋을 늘 같은 판으로 함께 내보내고,**
 * 그 규율을 여기서 강제한다. 어긋난 채로는 publish 가 시작되지 않는다.
 */
const workspace = resolve(here, '..')
const siblings = readdirSync(workspace, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(resolve(workspace, e.name, 'package.json')))
  .map((e) => readJson(resolve(workspace, e.name, 'package.json')))

const core = siblings.find((s) => s.name === '@gochim/core')

for (const s of siblings) {
  if (s.version !== pkg.version) {
    fail(`${s.name} 는 ${s.version} 인데 ${pkg.name} 는 ${pkg.version} 이다 — 셋은 늘 같은 판으로 나간다`)
  }
}

const peer = pkg.peerDependencies?.['@gochim/core']
if (peer && core && peer !== `^${core.version}`) {
  fail(`peerDependencies 의 @gochim/core 가 '${peer}' 인데 코어는 ${core.version} 이다 — '^${core.version}' 이어야 한다`)
}

/* ── 5. 코드에 적어 둔 버전이 package.json 과 같은가 ───────────── */

if (pkg.name === '@gochim/core') {
  const body = readFileSync(resolve(here, 'dist/index.js'), 'utf8')
  const m = /export const VERSION = ['"]([^'"]+)['"]/.exec(body)
  if (!m) fail(`dist/index.js 에서 VERSION 을 못 찾았다`)
  else if (m[1] !== pkg.version) {
    fail(`VERSION 은 '${m[1]}' 인데 package.json 은 ${pkg.version} 이다`)
  }
}

/* ── 결과 ────────────────────────────────────────────────────── */

if (problems.length > 0) {
  console.error(`\n${pkg.name} 는 아직 내보낼 상태가 아니다\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error(`\n  빌드가 없어서라면 저장소 뿌리에서 \`npm run build\` 를 먼저 돌릴 것.`)
  console.error(`  (dist 는 .gitignore 대상이라 새 클론에는 없다)\n`)
  process.exit(1)
}

console.log(`  ✓ ${pkg.name}@${pkg.version} — 내보낼 준비가 됐다`)
