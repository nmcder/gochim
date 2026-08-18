# 고침 크롬 확장

브라우저 안의 아무 입력칸에서나 한국어 맞춤법·띄어쓰기를 잡아 주는 MV3 확장입니다.

**권한 목록에 네트워크가 없습니다.** 입력한 글은 탭 밖으로 나가지 않습니다.

```json
"permissions": ["storage"]
```

`host_permissions`도, `fetch`도, 원격 코드도 없습니다. 검사는 전부 콘텐츠 스크립트 안에서 끝납니다.

## 설치 (개발용)

```bash
npm install
npm run build -w @gochim/extension
```

크롬에서 `chrome://extensions` → 개발자 모드 켜기 → **압축해제된 확장 프로그램을 로드** → `apps/extension/dist` 선택.

## 밑줄을 어떻게 긋는가

남의 페이지에서 지켜야 할 규칙이 하나 있습니다 — **호스트 DOM을 건드리지 않는다.**
리액트나 ProseMirror가 관리하는 트리에 `<span>`을 끼워 넣으면 그 편집기가 깨집니다.

그래서 입력칸 종류에 따라 방법을 나눕니다.

| 입력칸 | 방법 | 왜 |
| --- | --- | --- |
| `contenteditable` | **CSS Custom Highlight API** | Range만 등록하면 브라우저가 칠해 줍니다. DOM 변화 0 |
| `textarea` · `input` | 같은 자리에 겹친 **거울 레이어** | DOM에 글자가 없어 Range를 만들 수 없습니다 |

거울 레이어는 원본의 타이포그래피 속성 20여 개를 그대로 복사해 글자 위치를 맞추고,
스크롤·리사이즈에 따라 위치를 다시 잡습니다. 물결 밑줄은 글자 자리를 차지하지 않아 정렬이 깨지지 않습니다.

제안 팝오버는 **Shadow DOM**에 넣습니다. 그러지 않으면 호스트 사이트의 CSS 한 줄에 레이아웃이 무너집니다.

## 타이핑을 막지 않기

- 입력 후 **300ms 디바운스**
- 4,000자를 넘는 글은 **커서 주변만** 잘라 검사 (어절 경계까지 물러나 자릅니다)
- 교정 적용은 `execCommand('insertText')` — 사용자의 되돌리기(Ctrl+Z) 스택을 유지하는 유일한 방법입니다.
  실패하면 값을 직접 바꾸고 `input` 이벤트를 흉내 내 프레임워크가 알아채게 합니다.

## 구성

```
src/content/     콘텐츠 스크립트 — 입력칸 감지, 검사, 밑줄, 팝오버
src/background.ts  서비스 워커 (하는 일이 거의 없습니다. 그게 맞습니다)
src/options/     설정 화면 — 분류 선택, 확신도 하한, 무시 목록 관리
src/popup/       툴바 팝업 — 끄고 켜기
scripts/         아이콘 생성기 (의존성 없이 PNG를 직접 씁니다)
build.mjs        esbuild 빌드 — 콘텐츠 스크립트는 IIFE, 나머지는 ESM
```

## 확장 없이 확인하기

`test/smoke.html`은 빌드된 `dist/content.js`를 그대로 불러오는 페이지입니다.
`chrome.*` API가 없어도 기본 설정으로 동작하므로, 확장을 설치하지 않고 세 가지 입력칸을 한 번에 확인할 수 있습니다.

```bash
npm run build -w @gochim/extension
npx http-server apps/extension -p 5178   # 또는 python -m http.server
# → http://127.0.0.1:5178/test/smoke.html
```

## 아직 없는 것

- 형태소 층(3층) — 확장에서는 아직 1층만 돕니다. Worker로 분리한 뒤 붙일 예정입니다.
- 구글 문서 — 캔버스로 글을 그리기 때문에 DOM에 글자가 없습니다. 기술적으로 접근이 불가능합니다.
- 파이어폭스 · 사파리
