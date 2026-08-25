import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 표본 파일에 든 모든 한국어 문자열.
 *
 * 파일마다 구조가 달라(케이스 배열, 문장 배열, 중첩 객체) 통째로 훑어 문자열만 걷는다.
 * 정답이든 오답이든 가리지 않는다 — **고침이 어떤 글을 받아도 멱등해야** 하기 때문이다.
 *
 * 테스트 파일이 아니라 여기 둔 이유는, `.test.ts`에서 가져오면 그 파일의 테스트가
 * 함께 도는 탓이다.
 */
export function goldenSamples(files: readonly string[] = ['golden.json', 'corpus.json', 'prose.json', 'wild.json']): string[] {
  const out = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (v.length < 1200 && /[가-힣]/.test(v)) out.add(v)
    } else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  for (const name of files) {
    const path = fileURLToPath(new URL(`../../../data/golden/${name}`, import.meta.url))
    walk(JSON.parse(readFileSync(path, 'utf8')))
  }
  return [...out]
}
