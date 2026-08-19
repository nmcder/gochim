/**
 * 검사에서 제외할 구간을 찾는다.
 *
 * 교정기가 URL이나 코드 안의 글자를 건드리면 그 순간 신뢰를 잃는다.
 * 오탐을 줄이는 가장 값싼 수단이라 규칙보다 먼저 돈다.
 */

export type Range = readonly [start: number, end: number]

const PROTECTORS: RegExp[] = [
  // URL / 이메일
  /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  // 코드 — 마크다운 펜스, 인라인 코드
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  // HTML 태그
  /<\/?[a-zA-Z][^>\n]*>/g,
  // 멘션 / 해시태그 — 붙여 쓴 게 의도인 경우가 많다
  /(?:^|\s)[@#][^\s]+/g,
  // 파일 경로 (윈도·POSIX)
  /\b[A-Za-z]:\\[^\s]+/g,
  /**
   * 따옴표로 감싼 짧은 인용.
   *
   * 맞춤법 이야기를 하는 글에서는 틀린 표기가 **언급 대상**으로 등장한다.
   *   맞춤법 강의에서 '되요'와 '됬'은 틀린 표기라고 배웠다.
   * 여기에 밑줄을 그으면 글쓴이 입장에서는 도구가 문맥을 못 읽는 것으로 보인다.
   * 길이를 12자로 제한해 대화체 인용문까지 통째로 빠지는 일은 막는다.
   */
  /['"‘“「][^'"’”」\n]{1,12}['"’”」]/g,
]

/** 겹치는 구간을 합쳐 정렬된 목록으로 만든다. */
function merge(ranges: Range[]): Range[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: Range[] = [sorted[0]!]
  for (const r of sorted.slice(1)) {
    const last = out[out.length - 1]!
    if (r[0] <= last[1]) out[out.length - 1] = [last[0], Math.max(last[1], r[1])]
    else out.push(r)
  }
  return out
}

/** 보호 구간 목록. 정렬·병합되어 있다. */
export function protectedRanges(text: string): Range[] {
  const found: Range[] = []
  for (const re of PROTECTORS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1
        continue
      }
      found.push([m.index, m.index + m[0].length])
    }
  }
  return merge(found)
}

/**
 * 이 위치가 인용부호 안인가.
 *
 * 짧은 인용은 [protectedRanges]가 이미 막지만, 긴 인용문은 검사 대상으로 남긴다 —
 * 인용문 안의 맞춤법 오류도 오류이기 때문이다.
 * 다만 **문체 제안**(겹말 같은 것)은 남의 말을 고치는 셈이라 인용문 안에서 내지 않는다.
 */
export function insideQuotes(text: string, index: number): boolean {
  for (const [open, close] of [
    ['"', '"'],
    ['“', '”'],
    ['「', '」'],
    ['『', '』'],
  ] as const) {
    if (open === close) {
      // 같은 문자로 열고 닫으면 앞쪽 개수의 홀짝으로 판단한다.
      let count = 0
      for (let i = 0; i < index; i += 1) if (text[i] === open) count += 1
      if (count % 2 === 1) return true
      continue
    }
    const opened = text.lastIndexOf(open, index)
    if (opened === -1) continue
    const closed = text.indexOf(close, opened + 1)
    if (closed === -1 || closed > index) return true
  }
  return false
}

/** [start, end) 가 보호 구간과 조금이라도 겹치는가. 정렬된 목록을 이분 탐색한다. */
export function overlapsProtected(ranges: readonly Range[], start: number, end: number): boolean {
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const [s, e] = ranges[mid]!
    if (e <= start) lo = mid + 1
    else if (s >= end) hi = mid - 1
    else return true
  }
  return false
}
