import type { Analyzer, Morpheme } from '@gochim/core'
import { Garu, splitSentences } from 'garu-ko'

/**
 * `@gochim/morph` — `@gochim/core`에 형태소 정보를 공급하는 어댑터.
 *
 * 코어는 WASM도 모델 파일도 모른다. 이 패키지가 그 경계다.
 * 덕분에 코어만 쓰면 18.5 kB로 끝나고, 정확도가 더 필요할 때만 1.6 MB를 더 얹는다.
 *
 * ```ts
 * import { check } from '@gochim/core'
 * import { createAnalyzer } from '@gochim/morph'
 *
 * const analyzer = await createAnalyzer()
 * check('누구나 할수있는 일이야.', { analyzer })
 * // 수/NNB 가 앞말에 붙어 있음을 보고 '할 수 있는'을 제안한다
 * ```
 *
 * ⚠ garu-ko는 **0.9.14로 정확히 고정**되어 있다. 0.9.15는 플래그 없는 크롬에서
 *   WASM 로드 자체가 실패한다. 올리기 전에 `npm run probe:sync`로 실측할 것.
 */

export interface CreateAnalyzerOptions {
  /** 모델 바이트를 직접 넘긴다. 확장에서 번들한 에셋을 쓸 때 필요하다. */
  modelData?: ArrayBuffer
  /** 모델 URL. 기본값은 패키지에 들어 있는 `models/base.gmdl`. */
  modelUrl?: string
}

export interface GochimAnalyzer extends Analyzer {
  /** WASM 인스턴스를 해제한다. 페이지를 떠날 때 호출하면 좋다. */
  destroy(): void
  /** 로드된 모델 정보 (버전·크기·정확도). */
  info(): { version: string; size: number; accuracy: number }
}

/**
 * 자리 셈법을 맞춘다 — garu-ko는 **코드포인트**, 자바스크립트 문자열은 **UTF-16**.
 *
 * 이 하나가 카톡·SNS에서 형태소 층을 통째로 죽이고 있었다. 이모지는 UTF-16에서
 * 두 자리(서러게이트 쌍)를 차지하는데 코드포인트로는 한 자리다. 그래서 이모지 하나가
 * 나올 때마다 뒤따르는 모든 자리가 1씩 밀린다. 밀린 자리로 어절을 자르면
 * `학교끝나고`가 `" 학교끝나"`로 잘려 나와 어느 규칙도 맞아떨어지지 않는다.
 * 재현율이 0.955에서 0.790으로 떨어졌고, **틀린 자리에 밑줄을 긋는 것이 아니라
 * 아무 데도 안 긋는** 꼴이라 아무도 눈치채지 못했다.
 *
 * `token.start/end`뿐 아니라 `segment.offset`도 코드포인트다. 둘 다 옮겨야 한다.
 *
 * 코드포인트 k번째 글자가 UTF-16 몇 번째에서 시작하는지 적은 표를 돌려준다.
 * 길이는 글자 수 + 1이라 끝점(exclusive)도 그대로 찾을 수 있다.
 *
 * 서러게이트가 없으면 두 셈법이 같으므로 `null`을 돌려주고 표를 만들지 않는다 —
 * 한국어 글은 거의 언제나 이쪽이다.
 */
function codePointIndex(text: string): number[] | null {
  if (!/[\uD800-\uDFFF]/.test(text)) return null
  const map: number[] = []
  for (let i = 0; i < text.length; ) {
    map.push(i)
    i += (text.codePointAt(i) ?? 0) > 0xffff ? 2 : 1
  }
  map.push(text.length)
  return map
}

/** topN 옵션을 쓰면 배열이 온다. 우리는 최적해 하나만 쓴다. */
function tokensOf(result: unknown): { text: string; pos: string; start: number; end: number }[] {
  const best = Array.isArray(result) ? result[0] : result
  return (best as { tokens?: { text: string; pos: string; start: number; end: number }[] } | undefined)?.tokens ?? []
}

/** 분석기 하나를 만든다. WASM 초기화 때문에 비동기다 (실측 70~110ms). */
export async function createAnalyzer(options: CreateAnalyzerOptions = {}): Promise<GochimAnalyzer> {
  const garu = await Garu.load(options)

  return {
    analyze(text: string): readonly Morpheme[] {
      if (!text) return []
      // 문장 단위로 나눠 분석한다. 긴 글을 통째로 넣으면 격자가 커져
      // 시간이 초선형으로 늘어난다 (실측: 4,000자 612ms → 문장 분할 후 4ms).
      const morphemes: Morpheme[] = []
      // 코드포인트 자리를 UTF-16 자리로 옮기는 표. 서러게이트가 없으면 null이고,
      // 그때는 두 셈법이 같으므로 그대로 쓴다.
      const map = codePointIndex(text)
      const last = map ? map.length - 1 : 0
      const at = (cp: number): number => (map ? (map[Math.max(0, Math.min(cp, last))] ?? text.length) : cp)

      for (const segment of splitSentences(text)) {
        for (const token of tokensOf(garu.analyze(segment.text))) {
          const start = at(token.start + segment.offset)
          const end = at(token.end + segment.offset)
          // 분석기가 범위 밖을 가리키면 버린다. 그 형태소를 믿고 어절을 자르면
          // 없던 오류가 생긴다 — 조용히 빠지는 편이 낫다.
          if (start >= end || end > text.length) continue
          morphemes.push({ text: token.text, pos: token.pos, start, end })
        }
      }
      return morphemes
    },
    score(text: string): number {
      if (!text) return 0
      const result = garu.analyze(text)
      const best = Array.isArray(result) ? result[0] : result
      return best?.score ?? 0
    },
    destroy() {
      garu.destroy()
    },
    info() {
      return garu.modelInfo()
    },
  }
}
