import { decompose, finalOf, hasFinal, josa } from '../hangul.js'
import { insideQuotes } from '../protect.js'
import { defineLexicon, defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 높임 표현과 한자어 혼동
 */

export const honorificGyesidaConj = defineRule({
  id: "honorific-gyesida-conj",
  category: "ending",
  confidence: 0.92,
  pattern: /(?<![가-힣])(말씀|의견|이견|생각|질문|문의|사항|당부|지시|조언|제안|요청|부탁|걱정|공지|안내|인사말|축사|훈화|불편|용무|볼일|건의|이의|의문|점)(?:이|가)\s+계(?=[시셔셨세신실심십])/g,
  resolve(ctx) {
    /** 사람이 아니라서 직접 높일 수 없는 말. 이 뒤의 '계시다'는 '있으시다'의 잘못이다. */
    const GYESIDA_NOUNS =
      '말씀|의견|이견|생각|질문|문의|사항|당부|지시|조언|제안|요청|부탁|걱정|공지|안내|인사말|축사|훈화|불편|용무|볼일|건의|이의|의문|점'
    /** `honorific-gyesida`가 이미 잡는 자리. 두 번 밑줄 긋지 않는다. */
    const GYESIDA_DONE = /^(?:말씀|인사말|축사|훈화|질문|문의|사항|의견|불편)$/

    // resolve 본문
    const noun = ctx.match[1] ?? ''
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length)
    if (GYESIDA_DONE.test(noun) && /^(?:시겠습니다|시겠어요|십니다|신)/.test(rest)) return null
    return {
      suggestions: ['있으'],
      offset: ctx.match[0].length - 1,
      length: 1,
      message: "'계시다'는 사람에게만 씁니다.",
      explain:
        "말씀·의견은 사람이 아니므로 직접 높이지 않습니다. 높이는 대상은 그 말을 한 사람이라, 간접 높임 '있으시다'를 씁니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: "사장님 말씀이 계셔서 건의도 해 봤다.", right: "사장님 말씀이 있으셔서 건의도 해 봤다." },
    { wrong: "지난주 회의에서 말씀이 계셨던 예산 건입니다.", right: "지난주 회의에서 말씀이 있으셨던 예산 건입니다." },
    { wrong: "사장님께서도 의견이 계시다고 하여 확정하지 못했습니다.", right: "사장님께서도 의견이 있으시다고 하여 확정하지 못했습니다." },
    { wrong: "담임쌤 말씀이 계셨는데 내일은 지각하면 안 된대.", right: "담임쌤 말씀이 있으셨는데 내일은 지각하면 안 된대." },
    { wrong: "궁금하신 점이 계시면 언제든 연락 주세요.", right: "궁금하신 점이 있으시면 언제든 연락 주세요." },
  ],
  counterExamples: [
    "아버지는 지금 댁에 계십니다.",
    "할머니도 계시니까 와서 인사드리고 가.",
    "사장님께서는 지금 자리에 안 계세요.",
    "다음은 교장 선생님의 말씀이 있으시겠습니다.",
    "손님이 계셔서 조용히 했다.",
    "부모님이 계신 곳으로 갔다.",
    "어르신이 계시던 자리를 정리했다.",
  ],
})

export const honorificObjectDoe = defineRule({
  id: "honorific-object-doe",
  category: "ending",
  confidence: 0.92,
  pattern: /(?<![가-힣])(발송|배송|출고|배달|반품|교환|결제|청구|정산|충전|적립|출력|인쇄|저장|삭제|마감|매진|품절|입고|송금)(되십니다|되십니까|되셨습니다|되시겠습니다|되세요|되셨어요)/g,
  resolve(ctx) {
    /** 사람이 될 수 없는 서술성 명사. '-되시-'가 붙으면 사물 존대다. */
    const THINGS_DOE =
      '발송|배송|출고|배달|반품|교환|결제|청구|정산|충전|적립|출력|인쇄|저장|삭제|마감|매진|품절|입고|송금'
    const DOE_PLAIN: Record<string, string> = {
      되십니다: '됩니다',
      되십니까: '됩니까',
      되셨습니다: '됐습니다',
      되시겠습니다: '되겠습니다',
      되세요: '돼요',
      되셨어요: '됐어요',
    }

    // resolve 본문
    // 인용부호 안은 남이 실제로 한 말이다. 고치면 그 사람이 하지 않은 말이 된다.
    if (insideQuotes(ctx.text, ctx.index)) return null
    const tail = ctx.match[2] ?? ''
    const fixed = DOE_PLAIN[tail]
    if (!fixed) return null
    return {
      suggestions: [fixed],
      offset: ctx.match[0].length - tail.length,
      length: tail.length,
      message: '사물에는 높임을 쓰지 않습니다.',
      explain:
        "주체 높임 '-시-'는 사람을 높일 때만 씁니다. 발송되는 것은 자료이므로 '발송됩니다'가 맞습니다. ('회장이 되십니다'처럼 사람이 무엇이 될 때는 정상입니다)",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: "자료는 내일 발송되십니다.", right: "자료는 내일 발송됩니다." },
    { wrong: "주문하신 상품은 오늘 배송되셨습니다.", right: "주문하신 상품은 오늘 배송됐습니다." },
    { wrong: "결제는 매월 1일에 자동으로 정산되십니다.", right: "결제는 매월 1일에 자동으로 정산됩니다." },
  ],
  counterExamples: [
    "자료는 내일 발송됩니다.",
    "부장님께서 회장이 되셨습니다.",
    "그분은 올해 교장이 되십니다.",
    "성함이 어떻게 되세요?",
    "이번 인사에서 팀장이 되셨어요.",
  ],
})

export const kkeseoAgreementPast = defineRule({
  id: "kkeseo-agreement-past",
  category: "ending",
  confidence: 0.86,
  pattern: /께서(?:는|도)?\s+((?:[가-힣]+\s+){0,2}?)([가-힣]*?)(물어봤|여쭤봤|말했|먹었|보냈|물었|웃었|앉았|읽었|들었|봤|했|갔|왔|줬|샀|탔|썼|냈)(는데|는지|길래|더니|지만)/g,
  resolve(ctx) {
    /** 높이지 않은 과거형 → 높인 과거형. 활용이 불규칙해서 표로 못박는다. */
    const PAST_HONORED: Record<string, string> = {
      물어봤: '물어보셨', 여쭤봤: '여쭤보셨', 말했: '말씀하셨', 먹었: '드셨', 보냈: '보내셨',
      물었: '물으셨', 웃었: '웃으셨', 앉았: '앉으셨', 읽었: '읽으셨', 들었: '들으셨',
      봤: '보셨', 했: '하셨', 갔: '가셨', 왔: '오셨', 줬: '주셨', 샀: '사셨', 탔: '타셨', 썼: '쓰셨', 냈: '내셨',
    }
    // 긴 것을 먼저 시도해야 '물어봤'이 '봤'에, '말했'이 '했'에 먹히지 않는다.
    const PAST_KEYS = Object.keys(PAST_HONORED).sort((a, b) => b.length - a.length).join('|')

    // resolve 본문
    const middle = ctx.match[1] ?? ''
    const stem = ctx.match[2] ?? ''
    const past = ctx.match[3] ?? ''
    const ending = ctx.match[4] ?? ''
    // 다른 주어가 끼어들면 '-시-'의 임자가 바뀐다.
    if (/제가|저는|저희|내가|나는|우리가|은\s|는\s|니까|테니|어서|아서|으면|려고/.test(middle)) return null
    // 관형절이 끼면 '께서'는 그 절의 주어다. '할머니께서 계신 병원에 갔는데'의 주어는 나다.
    if (/[가-힣](?:신|시는|실|셨던)\s/.test(middle)) return null
    // 목적어가 놓인 자리만 본다. 부사어만 있으면 주어가 생략된 다른 절일 때가 많다.
    if (middle !== '' && !/[을를]\s+$/.test(middle)) return null
    const honored = PAST_HONORED[past]
    if (!honored) return null
    const length = stem.length + past.length + ending.length
    return {
      suggestions: [`${stem}${honored}${ending}`],
      offset: ctx.match[0].length - length,
      length,
      message: "'께서'가 주어면 서술어에도 높임을 씁니다.",
      explain:
        "주격 조사 '께서'는 주어를 높이는 형태입니다. 서술어에 '-시-'를 넣지 않으면 높임이 반쪽만 됩니다.",
      refs: ['표준 언어 예절'],
    }
  },
  examples: [
    { wrong: "사장님께서 내 이름을 물어봤는데 목소리가 떨렸다.", right: "사장님께서 내 이름을 물어보셨는데 목소리가 떨렸다." },
    { wrong: "선생님께서 숙제를 냈는데 다들 잊어버렸다.", right: "선생님께서 숙제를 내셨는데 다들 잊어버렸다." },
  ],
  counterExamples: [
    "할머니께서 계신 병원에 갔는데 사람이 많았다.",
    "사장님께서 시키신 일을 했는데 칭찬을 들었다.",
    "아버지께서 주신 용돈으로 책을 샀는데 벌써 다 읽었다.",
    "교수님께서 부르셔서 연구실에 갔는데 아무도 없었다.",
    "사장님께서 오라고 해서 내가 자료를 봤는데 문제가 없었다.",
    "사장님께서 내 이름을 물어보셨는데 목소리가 떨렸다.",
    "선생님께서 화를 내셨는데 이유를 몰랐다.",
    "어머니께서 시장에 갔는데 문을 닫았더라.",
  ],
})

export const hanjaGyeolje = defineRule({
  id: "hanja-gyeolje",
  category: "confusable",
  // 같은 자리를 lexicon의 경고 항목도 잡는다. 겹치면 확신도가 높은 쪽이 남으므로
  // 문맥을 바로 옆에서 확인하는 이쪽을 한 칸 올려 둔다.
  confidence: 0.93,
  pattern: /(?<![가-힣])(?:(?:신용\s*카드|체크\s*카드|법인\s*카드|기프트\s*카드|카드|현금|계좌\s*이체|무통장|간편|앱|온라인|모바일|비대면|할부|일시불|포인트|상품권|카카오페이|네이버페이|삼성페이|애플페이|페이코|대금|요금|운임|배송비|이용료|관람료|입장료|수강료|숙박비|식대|잔금)(?:으로|로|을|를|은|는|의)?\s*결재|(?:방문객|고객|손님|이용자|사용자|회원|구매자|소비자|승객|관람객|가입자)(?:의|들의)?\s*결재)/g,
  resolve(ctx) {
    /** 돈을 내는 수단·항목. 이 말이 바로 앞에 붙으면 '결제'다. */
    const PAY_LEFT =
      '신용\\s*카드|체크\\s*카드|법인\\s*카드|기프트\\s*카드|카드|현금|계좌\\s*이체|무통장|간편|앱|온라인|모바일|비대면|할부|일시불|포인트|상품권|카카오페이|네이버페이|삼성페이|애플페이|페이코|대금|요금|운임|배송비|이용료|관람료|입장료|수강료|숙박비|식대|잔금'
    /** 돈을 내는 쪽. 이 사람들은 결재(승인)를 하지 않는다. */
    const PAYER = '방문객|고객|손님|이용자|사용자|회원|구매자|소비자|승객|관람객|가입자'
    // 신호는 **바로 옆에만** 둔다. '대금 지급 결재를 올렸다'처럼 사이에 말이 끼면
    // 결재(승인)가 맞는 문장이 되므로, 한 칸이라도 떨어지면 손대지 않는다.

    // resolve 본문
    if (insideQuotes(ctx.text, ctx.index)) return null
    // '전자결재'는 붙여 쓰는 한 낱말이다.
    if (/전자\s*$/.test(ctx.text.slice(Math.max(0, ctx.index - 3), ctx.index))) return null
    return {
      suggestions: ['결제'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "대금을 치르는 것은 '결제'입니다.",
      explain:
        "'결제(決濟)'는 대금을 주고받아 거래를 끝내는 일, '결재(決裁)'는 상급자가 안건을 승인하는 일입니다. 카드·대금이 앞에 오면 '결제'입니다.",
    }
  },
  examples: [
    { wrong: "앱 결재가 자꾸 튕겨서 세 번이나 다시 했다.", right: "앱 결제가 자꾸 튕겨서 세 번이나 다시 했다." },
    { wrong: "카드로 결재하는 것도 한참 헤맸다.", right: "카드로 결제하는 것도 한참 헤맸다." },
    { wrong: "내가 카드로 결재했으니까 너는 팝콘만 사 와.", right: "내가 카드로 결제했으니까 너는 팝콘만 사 와." },
    { wrong: "대금 결재 시스템에서 오류가 발견되었습니다.", right: "대금 결제 시스템에서 오류가 발견되었습니다." },
    { wrong: "방문객의 결재 내역을 분석하였다.", right: "방문객의 결제 내역을 분석하였다." },
  ],
  counterExamples: [
    "법인카드 사용 내역은 매달 팀장 결재를 받아야 한다.",
    "전자결재로 올린 문서가 반려되어 다시 상신했다.",
    "지출 결의서 결재가 아직 나지 않았다.",
    "부장님 결재를 먼저 받으세요.",
    "카드 결제가 안 돼서 편의점에서 현금으로 계산했다.",
    "대금 지급 결재를 요청했습니다.",
    "요금 인상 결재가 어제 났다.",
    "출장비 결재를 올렸다.",
  ],
})

export const hanjaGyeoljae = defineRule({
  id: "hanja-gyeoljae",
  category: "confusable",
  confidence: 0.9,
  pattern: /(?<![가-힣])(?:(?:계약서|서류|문서|품의서|품의|기안서|기안|보고서|공문|전표|지출\s*결의서|결의서)(?:을|를|은|는|의)?\s*결제|(?:부서|팀|본부|과|처|실)의\s*결제(?=(?:를|가)\s*(?:[가-힣]{1,4}\s+)?(?:거[치쳐]|받|올|얻|기다))|(?:부장|과장|차장|팀장|사장|본부장|대표|임원|원장|이사|국장|실장)(?:님)?의\s*결제(?=(?:를|가)\s*(?:[가-힣]{1,4}\s+)?(?:거[치쳐]|받|올|얻|기다|필요|나[지야]|떨어))|결제(?=(?:를|가)?\s*(?:상신|반려|올려|올린|올렸|올릴|맡기)))/g,
  resolve(ctx) {
    /** 결재를 받는 대상이 되는 문서. */
    const DOCS = '계약서|서류|문서|품의서|품의|기안서|기안|보고서|공문|전표|지출\\s*결의서|결의서'
    /** 결재권을 가진 조직·사람. 뒤에 승인 동사가 따라올 때만 신호로 친다. */
    const APPROVER_ORG = '부서|팀|본부|과|처|실'
    const BOSS = '부장|과장|차장|팀장|사장|본부장|대표|임원|원장|이사|국장|실장'
    // '전자결제(전자지급결제대행)'는 실재하는 말이라 '전자 결제'는 건드리지 않는다.

    // resolve 본문
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['결재'],
      offset: ctx.match[0].lastIndexOf('결제'),
      length: 2,
      message: "상급자가 안건을 승인하는 것은 '결재'입니다.",
      explain:
        "'결재(決裁)'는 결정권을 가진 사람이 안건을 허가·승인하는 일, '결제(決濟)'는 대금 지급입니다. 서류를 올려 승인받는 자리라면 '결재'입니다.",
    }
  },
  examples: [
    { wrong: "계약서 결제가 아직 나지 않아 이틀 늦어집니다.", right: "계약서 결재가 아직 나지 않아 이틀 늦어집니다." },
    { wrong: "예산은 담당 부서의 결제를 거쳐 집행된다.", right: "예산은 담당 부서의 결재를 거쳐 집행된다." },
    { wrong: "부장님의 결제를 먼저 받아야 합니다.", right: "부장님의 결재를 먼저 받아야 합니다." },
    { wrong: "어제 올린 결제를 반려당했다.", right: "어제 올린 결재를 반려당했다." },
  ],
  counterExamples: [
    "회식비는 팀장님이 법인카드로 결제하셨다.",
    "카드 결제가 안 돼서 편의점에서 현금으로 계산했다.",
    "앱 결제가 자꾸 튕겨서 세 번이나 다시 했다.",
    "대금 결제 시스템에서 오류가 발견되었습니다.",
    "사장님께 결제 대금을 청구했다.",
    "전자결제 대행업체를 통해 요금을 냈다.",
    "입학 신청서 결제를 완료했다.",
    "결제 금액을 올려서 다시 시도했다.",
  ],
})

export const hanjaYurae = defineRule({
  id: "hanja-yurae",
  category: "confusable",
  confidence: 0.9,
  pattern: /(?<![가-힣])(?:(?:축제|명절|풍습|풍속|관습|의식|행사|놀이|속담|지명|명칭|이름|낱말|단어|표현|어원|전설|설화|민요|음식|요리|절기|제도|성씨|마을|유행|의례|가문|상호)의\s*유례|유례(?=가\s*깊))/g,
  resolve(ctx) {
    /** 기원을 따지는 대상. 이 말의 '유례'는 '유래'의 잘못이다. */
    const ORIGIN_NOUNS =
      '축제|명절|풍습|풍속|관습|의식|행사|놀이|속담|지명|명칭|이름|낱말|단어|표현|어원|전설|설화|민요|음식|요리|절기|제도|성씨|마을|유행|의례|가문|상호'

    // resolve 본문
    if (insideQuotes(ctx.text, ctx.index)) return null
    const rest = ctx.text.slice(ctx.index + ctx.match[0].length)
    // '유례가 없다·유례를 찾기 힘들다'는 굳은 표현이라 '유례'가 맞다.
    if (/^(?:\s*없|가\s*없|를\s*찾|를\s*보기|가\s*드[물문])/.test(rest)) return null
    return {
      suggestions: ['유래'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "생겨난 내력은 '유래'입니다.",
      explain:
        "'유래(由來)'는 사물이 생겨난 내력, '유례(類例)'는 같은 종류의 예입니다. 축제나 지명이 어디서 왔는지 말할 때는 '유래'입니다.",
    }
  },
  examples: [
    { wrong: "축제의 유례를 다룬 제3장은 문헌을 근거로 삼았다.", right: "축제의 유래를 다룬 제3장은 문헌을 근거로 삼았다." },
    { wrong: "이 마을의 유례는 조선 후기 기록에 남아 있다.", right: "이 마을의 유래는 조선 후기 기록에 남아 있다." },
    { wrong: "이 절기는 유례가 깊은 명절이다.", right: "이 절기는 유래가 깊은 명절이다." },
  ],
  counterExamples: [
    "올해 실적은 창사 이래 유례를 찾기 힘든 성장세였다.",
    "이 지명의 유래를 문헌에서 찾기 어려웠다.",
    "이번 사태는 유례가 없는 일이다.",
    "이 축제는 삼국 시대 제천 행사에서 유래했다.",
    "이런 규모의 행사는 유례를 찾아보기 어렵다.",
  ],
})

export const hanjaJegoE = defineRule({
  id: "hanja-jego-e",
  category: "confusable",
  confidence: 0.9,
  pattern: /(?<![가-힣])(생산성|효율성|효율|이미지|위상|경쟁력|신뢰도|만족도|인식|가치|품질|성과|수준|역량|청렴도|투명성|사기)\s*재고(?=에\s*(?:힘|나서|주력|매진|중점|앞장|기여|이바지)|[가를을]\s*(?:필요|시급|절실|관건|급선무))/g,
  resolve(ctx) {
    /** 높임의 대상이 되는 추상 품질. `hanja-jego`와 같은 목록에 몇 개를 더 얹었다. */
    const QUALITIES =
      '생산성|효율성|효율|이미지|위상|경쟁력|신뢰도|만족도|인식|가치|품질|성과|수준|역량|청렴도|투명성|사기'
    // `hanja-jego`는 '재고를 위해/재고하여'만 본다. 여기는 '재고에 힘쓰다·재고가 시급하다' 쪽이다.

    // resolve 본문
    if (insideQuotes(ctx.text, ctx.index)) return null
    return {
      suggestions: ['제고'],
      offset: ctx.match[0].length - 2,
      length: 2,
      message: "수준을 높이는 것은 '제고'입니다.",
      explain:
        "'제고(提高)'는 쳐들어 높임, '재고(再考)'는 다시 생각함, '재고(在庫)'는 창고의 물건입니다. 만족도를 높이는 것은 '제고'입니다.",
    }
  },
  examples: [
    { wrong: "질적 만족도 재고에 힘써야 한다.", right: "질적 만족도 제고에 힘써야 한다." },
    { wrong: "기업 이미지 재고가 시급하다.", right: "기업 이미지 제고가 시급하다." },
  ],
  counterExamples: [
    "이사회는 투자 계획을 재고하기로 했다.",
    "창고에 쌓인 재고를 절반으로 줄였다.",
    "효율적인 재고 관리로 물류 비용을 크게 줄였다.",
    "재고 확인 결과 해당 상품은 이미 품절됨.",
    "재고가 필요한 사안이라 다시 논의하기로 했다.",
  ],
})

export const roseoMeans = defineRule({
  id: "roseo-means",
  category: "confusable",
  confidence: 0.92,
  pattern: /(?<![가-힣])([가-힣]{2,})(함|됨|씀)으로서(?=[\s,.])/g,
  resolve(ctx) {
    /** 명사 '-함'으로 끝나는 말. 이쪽은 자격을 뜻할 수 있어 '로서'가 맞다. */
    const BOX_STEMS =
      /(?:잠수|보관|사물|수납|편지|우편|저금|쓰레기|건의|의견|투표|화장|공구|서류|신발|정리|냉동|냉장|모금|항공모|분리)$/
    // `roseo-qualification`은 사람 명사 뒤의 '로써'를 '로서'로 되돌린다. 여기는 그 반대편,
    // 명사형 어미 '-ㅁ' 뒤다. '무엇을 해서'라는 방법을 뜻하므로 거의 언제나 '로써'다.

    // resolve 본문
    const stem = ctx.match[1] ?? ''
    // '잠수함으로서'는 명사 '잠수함'에 자격의 '-으로서'가 붙은 정상 표기다.
    if ((ctx.match[2] ?? '') === '함' && BOX_STEMS.test(stem)) return null
    return {
      suggestions: ['으로써'],
      offset: ctx.match[0].length - 3,
      length: 3,
      message: "수단·방법을 나타낼 때는 '-(으)로써'입니다.",
      explain:
        "'-(으)로써'는 수단·방법, '-(으)로서'는 지위·자격을 나타냅니다. 명사형 '-ㅁ' 뒤는 '무엇을 해서'라는 방법이므로 '-(으)로써'입니다.",
    }
  },
  examples: [
    { wrong: "자료를 꾸준히 축적함으로서 개선점이 밝혀진다.", right: "자료를 꾸준히 축적함으로써 개선점이 밝혀진다." },
    { wrong: "매일 조금씩 연습함으로서 실력이 늘었다.", right: "매일 조금씩 연습함으로써 실력이 늘었다." },
  ],
  counterExamples: [
    "그는 꾸준히 운동을 함으로써 체력을 길렀다.",
    "학생으로서 지켜야 할 기본 규칙부터 정리해 보았다.",
    "담당자로서 제가 다시 확인한 뒤 말씀드리겠습니다.",
    "이 배는 잠수함으로서의 기능을 잃었다.",
    "이로써 우리 팀은 3년 연속 우승을 차지했다.",
    "서류함으로서 쓰기에는 너무 작다.",
  ],
})

export const nnbDaeroSin = defineRule({
  id: "nnb-daero-sin",
  category: "spacing",
  confidence: 0.92,
  pattern: /([가-힣]*[하되주오가보아으드])신대로/g,
  resolve(ctx) {
    // `nnb-daero`는 '-는/-던' 뒤만 본다. 높임 관형사형 '-신' 뒤가 비어 있었다.
    // 앞 음절을 용언 어간으로 못박아 '내신대로(내신 성적)·무한대로(무한대+로)'를 피한다.

    // resolve 본문
    return {
      suggestions: ['신 대로'],
      offset: ctx.match[0].length - 3,
      length: 3,
      message: "용언 뒤의 '대로'는 의존명사라 띄어 씁니다.",
      explain:
        "관형사형 어미 '-ㄴ' 뒤의 '대로'는 의존명사입니다. 체언 뒤('규정대로')는 조사라 붙여 씁니다.",
      refs: ['한글 맞춤법 제41항', '한글 맞춤법 제42항'],
    }
  },
  examples: [
    { wrong: "말씀하신대로 필요한 항목만 추린 것입니다.", right: "말씀하신 대로 필요한 항목만 추린 것입니다." },
    { wrong: "부장님께서 알려주신대로 자료를 수정했습니다.", right: "부장님께서 알려주신 대로 자료를 수정했습니다." },
    { wrong: "아까 보신대로 절차는 그대로입니다.", right: "아까 보신 대로 절차는 그대로입니다." },
  ],
  counterExamples: [
    "부장님께서 말씀하신 대로 자료를 수정했습니다.",
    "모든 절차는 규정대로 진행하겠습니다.",
    "내신대로 지원하면 합격할 것 같다.",
    "무한대로 늘어나는 것은 아니다.",
    "세종대로를 따라 걸었다.",
    "사실대로 진술했습니다.",
  ],
})

export const honorificHanjaLexicon = defineLexicon({
  id: "honorific-hanja-lexicon",
  category: "confusable",
  confidence: 0.92,
  entries: [
    {
      wrong: "그러므로써",
      right: "그럼으로써",
      atWordStart: true,
      explain: "'그러므로'는 까닭을 나타내는 접속부사라 조사 '써'가 붙지 못합니다. 수단을 뜻할 때는 '그러함'의 준말에 조사가 붙은 '그럼으로써'입니다.",
      refs: ["한글 맞춤법 제19항"],
      counterExamples: ["비가 왔다. 그러므로 경기는 취소되었다.", "그는 꾸준히 운동함으로써 체력을 길렀다."],
    },
    {
      wrong: "게셨",
      right: "계셨",
      atWordStart: true,
      explain: "'있다'의 높임말은 '계시다'입니다. '게시다'는 없는 말이고, '게시(揭示)하다'는 뜻이 전혀 다릅니다.",
      refs: ["표준국어대사전 계시다"],
      counterExamples: ["할머니는 방에 계셨다.", "공지를 게시했다.", "게시판에 글을 올렸다."],
    },
    {
      wrong: "게세요",
      right: "계세요",
      atWordStart: true,
      explain: "'있다'의 높임말은 '계시다'입니다. '게시다'는 없는 말입니다.",
      refs: ["표준국어대사전 계시다"],
      counterExamples: ["어머니 안녕히 계세요.", "공지 사항을 게시하세요."],
    },
    {
      wrong: "게십니다",
      right: "계십니다",
      atWordStart: true,
      explain: "'있다'의 높임말은 '계시다'입니다. '게시다'는 없는 말입니다.",
      refs: ["표준국어대사전 계시다"],
      counterExamples: ["아버지는 지금 댁에 계십니다."],
    },
  ],
})

export const honorificHanjaRules: Rule[] = [
  honorificGyesidaConj,
  honorificObjectDoe,
  kkeseoAgreementPast,
  hanjaGyeolje,
  hanjaGyeoljae,
  hanjaYurae,
  hanjaJegoE,
  roseoMeans,
  nnbDaeroSin,
  honorificHanjaLexicon,
]
