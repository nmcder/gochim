# 0005 — 확장은 호스트 DOM을 건드리지 않는다

- 상태: 확정
- 날짜: 2026-08-19
- 관련: [0003](0003-three-layers-and-repo-split.md)

## 맥락

확장은 남의 페이지 안에서 돈다. 밑줄을 그으려면 "이 글자 구간"을 표시해야 하는데,
가장 쉬운 방법은 그 구간을 `<span>`으로 감싸는 것이다.

그리고 그건 편집기를 부순다.

리액트, ProseMirror, Slate, Quill 같은 편집기는 자기가 만든 DOM 트리를 **자기 상태의 반영**으로 본다.
바깥에서 노드를 끼워 넣으면 다음 렌더에서 트리가 어긋나고, 커서가 튀고, 입력이 사라진다.
사용자 입장에서는 "이 확장 켜니까 노션이 이상해졌다"가 된다. 그 순간 확장은 지워진다.

## 결정

**호스트 DOM에 노드를 추가하지도, 속성을 바꾸지도 않는다.** 입력칸 종류에 따라 두 가지 방법만 쓴다.

| 입력칸 | 방법 | DOM 변화 |
| --- | --- | --- |
| `contenteditable` | CSS Custom Highlight API | **없음** |
| `textarea` · `input` | 같은 자리에 겹친 거울 레이어 | 없음 (`document.body`에 형제로 하나 추가) |

제안 팝오버도 마찬가지로 `document.body`에 **Shadow DOM** 호스트 하나만 붙인다.

## 근거

### contenteditable — CSS Custom Highlight API

```js
const highlight = new Highlight(range1, range2)
CSS.highlights.set('gochim-error', highlight)
```

```css
::highlight(gochim-error) { text-decoration: underline wavy #c2402d; }
```

Range만 등록하면 브라우저가 칠해 준다. **DOM은 한 글자도 바뀌지 않는다.**
편집기가 트리를 다시 그려도 우리 밑줄이 그 트리를 오염시킬 일이 없다.
크롬 105+에서 쓸 수 있고, 이 확장은 어차피 크롬 대상이다.

### textarea — 거울 레이어

`textarea`의 값은 문자열이지 DOM이 아니다. 텍스트 노드가 없으니 Range를 만들 수 없고,
Highlight API를 쓸 수 없다. 그래서 같은 자리에 같은 타이포그래피로 **투명한 복제본**을 겹쳐 놓고
거기에만 밑줄을 긋는다. 원본은 손대지 않는다.

두 레이어가 한 픽셀도 어긋나면 안 되므로 `font-*`, `letter-spacing`, `line-height`, `padding`,
`border-width`, `white-space`, `word-break`, `tab-size` 등 20여 개 속성을 복사하고
스크롤·리사이즈에 맞춰 위치를 다시 잡는다.
물결 밑줄(`text-decoration: underline wavy`)은 글자 자리를 차지하지 않아 정렬을 깨지 않는다.

### 팝오버 — Shadow DOM

호스트 사이트의 CSS는 우리 편이 아니다. `div { box-sizing: content-box }` 한 줄에 카드가 무너진다.
Shadow DOM 안에 넣고 `:host { all: initial }`로 상속을 끊으면 그 위험이 사라진다.

## 예외로 남긴 것

- **구글 문서**는 글을 캔버스에 그린다. DOM에 글자가 없으므로 Range도, 거울도 만들 수 없다.
  기술적으로 접근이 불가능하다 — 리포트가 지목했던 대상이지만 포기한다.
- 교정을 **적용할 때**는 어쩔 수 없이 값을 바꾼다. 이때도 `document.execCommand('insertText')`를 먼저 쓴다.
  낡은 API지만 **사용자의 되돌리기(Ctrl+Z) 스택을 유지하는 유일한 방법**이다.
  실패하면 값을 직접 바꾸고 `input` 이벤트를 흉내 내 프레임워크가 변화를 알아채게 한다.

## 결과

- 밑줄 때문에 편집기가 깨질 구조적 위험이 없다.
- 로컬 스모크 테스트 페이지(`apps/extension/test/smoke.html`)로 세 종류 입력칸을 확장 설치 없이 확인할 수 있다.
- 대가: `textarea` 쪽은 타이포그래피 복사에 실패하면 밑줄이 어긋난다. 이건 눈으로 봐야 잡히는 종류의 버그다.
