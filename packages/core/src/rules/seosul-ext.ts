import { finalOf } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 갈라진 파생어를 도로 붙인다 — 2부.
 *
 * [seosul-hada](./seosul-hada.ts)가 세운 두 관문(어미 허용 목록 + 앞 어절 관형어 판정)을
 * 그대로 쓰되, 명사 목록을 넓히고 접미사 '-되다'·'-드리다'와 '-아/-어지다',
 * 그리고 보조용언 '싶다'까지 함께 다룬다.
 */

// ══════════════════ 공통 가드 ══════════════════
const ADNOMINALS = new Set(['그','이','저','요','여러','아무','어느','온갖','새','각','매','몇','첫','옛','두','세','네','다섯','여섯','별의별','단','총','뭔','웬','내','제','자기','우리','저희','남','걔','얘','쟤','딴','뭇'])
const CHEEON_N = new Set(['난','넌','전','걘','얜','쟨','우린','저흰','너흰','이건','그건','저건','건'])
/** ㄴ·ㄹ로 끝나지만 관형어일 수 없는 부사. */
const ADV_NL = new Set(['잘','정말','제발','일단','우선','얼른','그만','이만','대신','다들','그동안','오랜만','당분간','조만간','한번','도대체','실컷','부디','기어이'])
/** 관형사형 어미가 아닌 보조사·연결어미. '가지만·하면·먹든' 뒤는 관형어가 아니다. */
const NOT_ADN_TAIL = ['만', '면', '든']
/** 체언에 붙는 조사. 관형사형 '-을'과 겹치므로 3음절 이상일 때만 체언으로 본다. */
const CHEEON_TAIL = ['을', '를', '들']
function adnominalBefore(text: string, index: number): boolean {
  const words = text.slice(0, index).split(/[ \t]/)
  const prev = words.length >= 2 ? (words[words.length - 2] ?? '') : ''
  if (prev) {
    if (ADNOMINALS.has(prev)) return true
    if (prev.endsWith('의')) return true
    const fin = finalOf(prev.slice(-1))
    if (fin === 'ㄴ' || fin === 'ㄹ') {
      const cheeon =
        CHEEON_N.has(prev) ||
        ADV_NL.has(prev) ||
        NOT_ADN_TAIL.some((t) => prev.endsWith(t)) ||
        (CHEEON_TAIL.some((t) => prev.endsWith(t)) && [...prev].length >= 3)
      if (!cheeon) return true
    }
  }
  const prev2 = words.length >= 3 ? (words[words.length - 3] ?? '') : ''
  return Boolean(prev2 && ADNOMINALS.has(prev2))
}

// ══════════════════ 1. seosul-hada-ext ══════════════════
const HADA_NOUNS_EXT = [
  '분석','검토','확인','신청','제출','참석','진행','처리','판단','평가',
  '조사','설명','계획','숙제','연락','전화','결정','선택','사용','이용',
  '관리','운영','개발','발표','회의','상담','예약','주문','결제','구매',
  '판매','교환','환불','취소','등록','가입','검색','수정','실행','완료',
  '경험','참여','공유','지원','응원','축하','요청','답변','반성','기대',
  '집중','오해','여행','출근','퇴근','방문','초대','졸업','수업','면접',
  '근무','사과','결혼','실천','도전','성공','실패','작성','기록','개선',
  '반복','연구','학습','일',
]
const AFTER_HA = new Set(['고','기','는','니','다','더','던','도','되','든','느','냐','네','려','러','래','며','면','자','지','죠','게','겠','세','시','십','신','실','셨','였','잖'])
const AFTER_HAL = new Set(['까','게','래','지','수','걸','텐','듯','망','뿐'])
const AFTER_HAE = new Set(['서','도','야','라','요','주','줘','줬','준','줄','봐','봤','본','보','선'])
const NOT_HADA = new Set(['하도','하지만','하기야','하다못해','하도급','하다하다','하기는커녕'])
const HAP_OK = new Set(['합니다','합니까','합시다','합디다'])
const NNB_AFTER_HAL = /^ (수|것|거|게|때|줄|리|텐데|뿐|만큼|듯|양|턱|나위)(?![가-힣])/

export const seosulHadaExt = defineRule({
  id: 'seosul-hada-ext',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣0-9])(${HADA_NOUNS_EXT.join('|')}) (하|한|할|했|해|함|합)([가-힣]*)`, 'g'),
  resolve(ctx) {
    const noun = ctx.match[1] ?? ''
    const head = ctx.match[2] ?? ''
    const rest = ctx.match[3] ?? ''
    const tail = head + rest
    const next = rest.slice(0, 1)
    if (NOT_HADA.has(tail)) return null
    if (head === '하') {
      if (!AFTER_HA.has(next)) return null
      if (next === '느' && !/^하느(라|냐)/.test(tail)) return null
    } else if (head === '할') {
      if (next && !AFTER_HAL.has(next)) return null
      if (!next && !NNB_AFTER_HAL.test(ctx.text.slice(ctx.index + ctx.match[0].length))) return null
    } else if (head === '해') {
      if (next && !AFTER_HAE.has(next)) return null
    } else if (head === '한') {
      if (next !== '다') return null
    } else if (head === '합') {
      if (!HAP_OK.has(tail)) return null
    } else if (head !== '했') {
      return null
    }
    if (adnominalBefore(ctx.text, ctx.index)) return null
    return {
      offset: noun.length - 1,
      length: 2,
      suggestions: [noun.slice(-1)],
      subId: noun,
      message: `'${noun}하다'는 한 단어입니다. 붙여 씁니다.`,
      explain: `'${noun}하다'는 표준국어대사전에 한 단어로 오른 말입니다. 접미사 '-하다'는 앞말에 붙여 씁니다. 다만 앞에 관형어가 오면 '${noun}'이 명사로 쓰인 것이라 띄어 씁니다.`,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '방문객의 이용 내역을 분석 하였다.', right: '방문객의 이용 내역을 분석하였다.' },
    { wrong: '현장에서 일 하면서 얻은 감각이 강점이다.', right: '현장에서 일하면서 얻은 감각이 강점이다.' },
    { wrong: '난 숙제 하느라 시작도 못 했어.', right: '난 숙제하느라 시작도 못 했어.' },
    { wrong: '내일까지 서류를 제출 해야 합니다.', right: '내일까지 서류를 제출해야 합니다.' },
    { wrong: '회의 시간을 다시 확인 했습니다.', right: '회의 시간을 다시 확인했습니다.' },
    { wrong: '전 이미 신청 했어요.', right: '전 이미 신청했어요.' },
    { wrong: '주말에 여행 하기로 했다.', right: '주말에 여행하기로 했다.' },
    { wrong: '그 부분은 제가 처리 할게요.', right: '그 부분은 제가 처리할게요.' },
    { wrong: '늦어서 정중히 사과 했다.', right: '늦어서 정중히 사과했다.' },
    { wrong: '자료를 꼼꼼히 검토 합니다.', right: '자료를 꼼꼼히 검토합니다.' },
  ],
  counterExamples: [
    '일 하나도 안 남았다.',
    '내일 하루만 쉬자.',
    '무슨 일 하세요?',
    '이런 일 하다니 믿을 수가 없다.',
    '집안 일 하기가 쉽지 않다.',
    '사과 한 개만 주세요.',
    '사과 하나 먹을래?',
    '조사 하나만 바꿔도 뜻이 달라진다.',
    '기대 하나도 안 했어.',
    '회의 한 번으로 끝날 일이 아니다.',
    '지원 하나 없이 혼자 해냈다.',
    '기록 하나하나가 소중하다.',
    '숙제 할 일이 많다.',
    '연락 할 사람이 없다.',
    '그 판단 하나로 결과가 갈렸다.',
    '여행 하루 만에 지쳤다.',
    '설명 함부로 하지 마.',
    '평가 하도 박해서 놀랐다.',
    '개선 하기는커녕 더 나빠졌다.',
  ],
})

// ══════════════════ 2. seosul-doeda ══════════════════
const DOE_NOUNS = [
  '검토','확인','처리','진행','시작','완료','준비','결정','개선','반복',
  '사용','이용','적용','발견','포함','제출','등록','가입','취소','해결',
  '설치','실행','저장','삭제','수정','변경','배송','발송','마감','접수',
  '승인','반영','정리','예상','판단','평가','분석','요구','연결','구성',
  '개발','운영','관리','계획','인정','제한','유지','향상','공개','발표',
  '전달','소개','초대','지원','통과','확대','축소','중단','종료','제작',
  '출시','판매','생산','적립','환불','교환','신청','예약','주문','작성',
  '기록','축적','언급','마련','결제','안내','제공','활용','이해','기억',
  '걱정','생각','형성','증명','설정','선정','채택','도입','구축','정착',
]
const DOE_EOMI = new Set(['다','고','면','니','지','어','었','는','며','나','도','기','겠','던','네','자','죠','잖','건','든','거','더','라','러','려','세','시','셨','십','길','느','냐'])
const DOEN_NEXT = new Set(['다','대','데','지'])
const DOEL_NEXT = new Set(['까','지','수','때','뿐','걸','것','거','텐','줄','리'])
const DWAET_NEXT = new Set(['다','어','고','네','는','지','으','던','겠','습','음','을'])
const DOEM_NEXT = new Set(['을','이','에','도','과','은','의','만'])
const DWAE_NEXT = new Set(['서','요','도','야','라'])
function isDoeInflection(head: string, next: string): boolean {
  if (head === '되') return DOE_EOMI.has(next)
  if (head === '됩') return next === '니'
  if (next === '') return true
  if (head === '된') return DOEN_NEXT.has(next)
  if (head === '될') return DOEL_NEXT.has(next)
  if (head === '됐') return DWAET_NEXT.has(next)
  if (head === '됨') return DOEM_NEXT.has(next)
  if (head === '돼') return DWAE_NEXT.has(next)
  return false
}
export const seosulDoeda = defineRule({
  id: 'seosul-doeda',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣0-9])(${DOE_NOUNS.join('|')}) (되|된|될|됐|됩|됨|돼)([가-힣]*)`, 'g'),
  resolve(ctx) {
    const noun = ctx.match[1] ?? ''
    const head = ctx.match[2] ?? ''
    if (!isDoeInflection(head, (ctx.match[3] ?? '').slice(0, 1))) return null
    if (adnominalBefore(ctx.text, ctx.index)) return null
    return {
      offset: noun.length - 1,
      length: 2,
      suggestions: [noun.slice(-1)],
      subId: noun,
      message: `'${noun}되다'는 한 단어입니다. 붙여 씁니다.`,
      explain: `접미사 '-되다'는 앞말에 붙여 씁니다. '${noun}되다'는 표준국어대사전에 한 단어로 오른 말입니다. 앞에 관형어가 오면 '${noun}'이 명사로 쓰인 것이라 띄어 씁니다.`,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '심의 기준도 함께 검토 되어야 한다.', right: '심의 기준도 함께 검토되어야 한다.' },
    { wrong: '주문이 정상적으로 처리 됐습니다.', right: '주문이 정상적으로 처리됐습니다.' },
    { wrong: '자료가 아직 정리 되지 않았다.', right: '자료가 아직 정리되지 않았다.' },
    { wrong: '신청서가 접수 되면 문자가 옵니다.', right: '신청서가 접수되면 문자가 옵니다.' },
    { wrong: '요즘 계속 걱정 돼서 잠이 안 온다.', right: '요즘 계속 걱정돼서 잠이 안 온다.' },
    { wrong: '이 기능은 다음 달에 공개 됩니다.', right: '이 기능은 다음 달에 공개됩니다.' },
    { wrong: '행사는 예정대로 진행 될 것이다.', right: '행사는 예정대로 진행될 것이다.' },
  ],
  counterExamples: [
    '의사 되기가 그렇게 어렵다.',
    '어른 되면 알게 된다.',
    '부자 될 사람은 따로 있다.',
    '그 계획 되돌릴 수 없다.',
    '기록 되찾는 데 애먹었다.',
    '예약 되게 어렵더라.',
    '생각 되게 많더라.',
    '무슨 준비 됐냐고 물었다.',
    '어떤 처리 될지 모르겠다.',
    '결제 되짚어 보자.',
  ],
})

// ══════════════════ 3. seosul-deurida ══════════════════
const DEURI_NOUNS = ['말씀','인사','감사','연락','부탁','축하','전화']
/** '문안 인사·새해 인사'처럼 '인사'를 꾸미는 명사. 이때 '인사'는 명사구의 머리라 '드리다'와 띄어 쓴다. */
const INSA_MODIFIER = new Set(['문안','새해','연말','신년','명절','작별','감사','환영','송별','축하','아침','저녁','귀국','졸업','입학','생일','명함'])
export const seosulDeurida = defineRule({
  id: 'seosul-deurida',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.93,
  pattern: new RegExp(`(?<![가-힣0-9])(${DEURI_NOUNS.join('|')}) (드리|드립|드려|드릴|드렸|드린|드림)([가-힣]*)`, 'g'),
  resolve(ctx) {
    const noun = ctx.match[1] ?? ''
    const head = ctx.match[2] ?? ''
    const next = (ctx.match[3] ?? '').slice(0, 1)
    if (head === '드립' && next !== '니') return null
    // '문안 인사 드리고'처럼 앞에 관형어가 오면 '인사'가 명사로 쓰인 것이라 띄어 쓴다.
    if (adnominalBefore(ctx.text, ctx.index)) return null
    if (noun === '인사') {
      const before = ctx.text.slice(0, ctx.index).trimEnd()
      const prev = before.slice(before.lastIndexOf(' ') + 1)
      if (INSA_MODIFIER.has(prev)) return null
    }
    return {
      offset: noun.length - 1,
      length: 2,
      suggestions: [noun.slice(-1)],
      subId: noun,
      message: `'${noun}드리다'는 한 단어입니다. 붙여 씁니다.`,
      explain: `'말씀드리다·인사드리다·감사드리다·연락드리다·부탁드리다·축하드리다·전화드리다'는 표준국어대사전에 한 단어로 올라 있습니다. 그 밖의 말 뒤에 오는 '드리다'는 본용언이라 띄어 씁니다 — '선물(을) 드리다'.`,
      refs: ['한글 맞춤법 제2항'],
    }
  },
  examples: [
    { wrong: '할머니께 인사 드리고 가.', right: '할머니께 인사드리고 가.' },
    { wrong: '이 자리를 빌려 감사 드립니다.', right: '이 자리를 빌려 감사드립니다.' },
    { wrong: '내일 다시 연락 드리겠습니다.', right: '내일 다시 연락드리겠습니다.' },
    { wrong: '한 가지만 부탁 드릴게요.', right: '한 가지만 부탁드릴게요.' },
    { wrong: '먼저 말씀 드릴 것이 있습니다.', right: '먼저 말씀드릴 것이 있습니다.' },
    { wrong: '진심으로 축하 드려요.', right: '진심으로 축하드려요.' },
  ],
  counterExamples: [
    '선물 드릴게요.',
    '돈 드리기로 했다.',
    '커피 드릴까요?',
    '어머니께 용돈 드렸다.',
    '자료 드리려고 왔습니다.',
    '할머니께 문안 인사 드리고 왔어.',
    '어른께 새해 인사 드리러 갔다.',
  ],
})

// ══════════════════ 4. bojo-sipda ══════════════════
export const bojoSipda = defineRule({
  id: 'bojo-sipda',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.95,
  pattern: /([가-힣])(고|가|나|까)싶/g,
  resolve(ctx) {
    const eomi = ctx.match[2] ?? ''
    return {
      offset: 1,
      length: 2,
      suggestions: [`${eomi} 싶`],
      subId: eomi,
      message: "보조용언 '싶다'는 앞말과 띄어 씁니다.",
      explain:
        "'-고 싶다'의 '싶다'는 보조형용사입니다. 제47항이 붙여쓰기를 허용하는 자리는 '-아/-어' 뒤와 관형사형 뒤뿐이고 '-고·-ㄴ가·-나·-ㄹ까'는 그 밖이라, '싶다'는 언제나 앞말과 띄어 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '얼른 보고싶다.', right: '얼른 보고 싶다.' },
    { wrong: '이번 여름에는 바다에 가고싶어요.', right: '이번 여름에는 바다에 가고 싶어요.' },
    { wrong: '더 자고싶은데 알람이 울렸다.', right: '더 자고 싶은데 알람이 울렸다.' },
    { wrong: '집에 갈까싶다가 그냥 남았다.', right: '집에 갈까 싶다가 그냥 남았다.' },
    { wrong: '무슨 일인가싶어 돌아봤다.', right: '무슨 일인가 싶어 돌아봤다.' },
    { wrong: '내가 잘못했나싶었다.', right: '내가 잘못했나 싶었다.' },
  ],
  counterExamples: [
    '보고 싶다고 말했다.',
    '가고 싶은 곳이 많다.',
    '자고 싶어도 잠이 안 온다.',
    '갈까 싶었지만 그만뒀다.',
    '그런가 싶기도 하다.',
  ],
})

// ══════════════════ 5. seosul-eojida ══════════════════
const EO_STEMS = [
  '밝혀','알려','만들어','이루어','주어','여겨','보여','느껴','그려','벌어',
  '떨어','나눠','정해','행해','지어','쓰여','놓여','담겨','새겨','실려',
  '옮겨','늘어','줄어','넘어','끊어','잘려','걸러','부서','깨어','없어',
  '사라','잊혀','좋아','나빠','많아','커','작아','길어','짧아','넓어',
  '깊어','높아','낮아','늦어','빨라','느려','달라','멀어','심해','편해',
  '강해','약해','예뻐','어려워','쉬워','가까워','무거워','가벼워','따뜻해','시원해',
  '추워','더워','행복해','익숙해','유명해','친해','흐려','맑아','밝아','어두워',
  '조용해','복잡해','단순해','새로워','부드러워','자연스러워','이상해','확실해','분명해','다양해',
]
const JI_EOMI = new Set(['다','고','면','니','는','며','자','도','기','겠','던','네','죠','잖','러','려','만','지','게','나','시','세','더'])
const JIN_NEXT = new Set(['다','대','데','지','채'])
const JIL_NEXT = new Set(['까','지','수','때','뿐','걸','것','거','텐','줄','리'])
const JYEOT_NEXT = new Set(['다','어','고','네','는','지','으','던','겠','습','음','을'])
const JIM_NEXT = new Set(['을','이','에','도','과','은','의','만'])
const JYEO_NEXT = new Set(['서','도','요','야','라'])
function isJiInflection(head: string, next: string): boolean {
  if (head === '지') return JI_EOMI.has(next)
  if (head === '집') return next === '니'
  if (next === '') return true
  if (head === '진') return JIN_NEXT.has(next)
  if (head === '질') return JIL_NEXT.has(next)
  if (head === '졌') return JYEOT_NEXT.has(next)
  if (head === '짐') return JIM_NEXT.has(next)
  if (head === '져') return JYEO_NEXT.has(next)
  return false
}
export const seosulEojida = defineRule({
  id: 'seosul-eojida',
  autoFixSafe: true,
  category: 'spacing',
  confidence: 0.9,
  pattern: new RegExp(`(?<![가-힣])(${EO_STEMS.join('|')}) (지|진|질|졌|짐|집|져)([가-힣]*)`, 'g'),
  resolve(ctx) {
    const stem = ctx.match[1] ?? ''
    const head = ctx.match[2] ?? ''
    if (!isJiInflection(head, (ctx.match[3] ?? '').slice(0, 1))) return null
    return {
      offset: stem.length - 1,
      length: 2,
      suggestions: [stem.slice(-1)],
      subId: stem,
      message: "'-아/-어지다'는 앞말에 붙여 씁니다.",
      explain:
        "'-아/-어지다'는 보조용언이 아니라 앞말과 어울려 한 단어를 이루는 구성입니다('밝혀지다·만들어지다·좋아지다'). 그래서 언제나 붙여 씁니다.",
      refs: ['한글 맞춤법 제47항'],
    }
  },
  examples: [
    { wrong: '자료를 모으면 개선점이 밝혀 진다.', right: '자료를 모으면 개선점이 밝혀진다.' },
    { wrong: '규칙은 이렇게 만들어 진 것이다.', right: '규칙은 이렇게 만들어진 것이다.' },
    { wrong: '기회는 누구에게나 주어 진다.', right: '기회는 누구에게나 주어진다.' },
    { wrong: '요즘 부쩍 날이 추워 졌다.', right: '요즘 부쩍 날이 추워졌다.' },
    { wrong: '이름이 널리 알려 지면서 손님이 늘었다.', right: '이름이 널리 알려지면서 손님이 늘었다.' },
    { wrong: '요즘 들어 사이가 좋아 졌다.', right: '요즘 들어 사이가 좋아졌다.' },
    { wrong: '그렇게 여겨 집니다.', right: '그렇게 여겨집니다.' },
  ],
  counterExamples: [
    '해 지기 전에 돌아가자.',
    '짐을 다 지고 갔다.',
    '경기에 지고 나서 울었다.',
    '아까 지나간 사람이 누구야?',
    '오래 지나서야 알았다.',
    '얼마 지났는지 모르겠다.',
    '집을 새로 지었다.',
    '주어 자리에 명사가 온다.',
    '커피 지금 마실래?',
    '진짜 지네 같아 보였다.',
    '밝혀 주셔서 감사합니다.',
    '이름을 알려 주세요.',
    '책을 만들어 주기로 했다.',
  ],
})


export const seosulExtRules: Rule[] = [seosulHadaExt, seosulDoeda, seosulDeurida, bojoSipda, seosulEojida]
