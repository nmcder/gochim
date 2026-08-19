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
      for (const segment of splitSentences(text)) {
        for (const token of tokensOf(garu.analyze(segment.text))) {
          morphemes.push({
            text: token.text,
            pos: token.pos,
            start: token.start + segment.offset,
            end: token.end + segment.offset,
          })
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
