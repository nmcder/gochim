import { adaptJosa } from '../hangul.js'
import { defineRule } from './define.js'
import type { Rule } from '../types.js'

/**
 * 외래어 표기법.
 *
 * 여기서 지켜야 할 규칙은 하나다 — **어절 전체가 일치할 때만 고친다.**
 *
 * 음절 단위로 일반화하면 재앙이 된다. 오탐 감사에서 나온 실제 사례들이다.
 *
 *   탈 → 털   ⇒  이탈·탈락·탈출이 무너진다
 *   레포 → 리포 ⇒  레포츠(표준어)가 리포츠가 된다
 *   메세 → 메시 ⇒  메세나·(하노버) 메세가 깨진다
 *   사리 → 서리 ⇒  라면 사리, 불교의 사리가 깨진다
 *   쉽 → 십    ⇒  쉽다·쉽게·쉽사리가 파괴된다
 *   플랑 → 플래 ⇒  플랑크톤이 플래크톤이 된다
 *   콘 → 컨    ⇒  콘서트·콘센트가 깨진다
 *
 * 그래서 이 규칙은 표기 하나하나를 어휘로 지정한다. 접미사나 음절로 넓히지 않는다.
 */

interface Loanword {
  /** 잘못된 표기. 변이형은 각각 항목으로 넣는다. */
  wrong: string
  right: string
  note: string
}

const WORDS: Loanword[] = [
  { wrong: '디지탈', right: '디지털', note: 'digital의 [ə]는 ㅓ에 대응합니다. 일본식 표기 デジタル의 잔재입니다.' },
  { wrong: '컨텐츠', right: '콘텐츠', note: "정부·언론외래어심의공동위원회가 '콘텐츠'로 확정했습니다." },
  { wrong: '악세사리', right: '액세서리', note: '무성 파열음 [k]가 자음 앞에 와 받침 ㄱ으로 적습니다(제3장 제1절 제1항).' },
  { wrong: '악세서리', right: '액세서리', note: '무성 파열음 [k]가 자음 앞에 와 받침 ㄱ으로 적습니다.' },
  { wrong: '초콜렛', right: '초콜릿', note: 'chocolate의 어말 [lət]은 릿으로 적습니다.' },
  { wrong: '초코렛', right: '초콜릿', note: 'chocolate의 어말 [lət]은 릿으로 적습니다.' },
  { wrong: '쵸코렛', right: '초콜릿', note: 'chocolate의 어말 [lət]은 릿으로 적습니다.' },
  { wrong: '케잌', right: '케이크', note: "받침에는 ㄱㄴㄹㅁㅂㅅㅇ만 씁니다(제1장 제3항). [eɪ]는 짧은 모음이 아니라 '크'를 붙입니다." },
  { wrong: '케익', right: '케이크', note: "[eɪ]는 짧은 모음이 아니므로 어말 [k]에 '으'를 붙여 '케이크'로 적습니다." },
  { wrong: '메세지', right: '메시지', note: 'message의 둘째 음절 모음은 [ɪ]라 시로 적습니다.' },
  { wrong: '워크샵', right: '워크숍', note: '모음 앞의 [ʃ]는 뒤 모음에 따라 적습니다(제3장 제1절 제3항). [ʃɒ]는 쇼입니다.' },
  { wrong: '리더쉽', right: '리더십', note: '모음 앞의 [ʃɪ]는 시로 적습니다. -ship은 늘 -십입니다.' },
  { wrong: '멤버쉽', right: '멤버십', note: '-ship은 -십으로 적습니다.' },
  { wrong: '오너쉽', right: '오너십', note: '-ship은 -십으로 적습니다.' },
  { wrong: '파트너쉽', right: '파트너십', note: '-ship은 -십으로 적습니다.' },
  { wrong: '카페트', right: '카펫', note: '짧은 모음 뒤 어말 [t]는 받침 ㅅ으로 적습니다(제3장 제1절 제1항).' },
  { wrong: '레포트', right: '리포트', note: 'report의 첫 음절 모음은 [ɪ]라 리로 적습니다. 일본식 レポート의 영향입니다.' },
  { wrong: '넌센스', right: '난센스', note: "표준국어대사전 표제어는 '난센스'입니다." },
  { wrong: '앙케이트', right: '앙케트', note: '프랑스어 enquête의 [ɛ]는 ㅔ입니다. 영어식 이중모음을 덧붙일 근거가 없습니다.' },
  { wrong: '플랭카드', right: '플래카드', note: 'placard에는 비음 [ŋ]이 없어 받침 ㅇ을 넣을 근거가 없습니다.' },
  { wrong: '플랑카드', right: '플래카드', note: 'placard에는 비음 [ŋ]이 없습니다.' },
  { wrong: '팜플렛', right: '팸플릿', note: 'pamphlet의 [æ]는 ㅐ, 어말 [lɪt]은 릿입니다.' },
  { wrong: '팜플릿', right: '팸플릿', note: 'pamphlet의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '바베큐', right: '바비큐', note: 'barbecue의 둘째 음절은 [ɪ]라 비로 적습니다.' },
  { wrong: '소세지', right: '소시지', note: 'sausage의 둘째 음절 모음은 [ɪ]라 시로 적습니다.' },
  { wrong: '케찹', right: '케첩', note: 'ketchup의 [ʌ]는 ㅓ에 대응합니다.' },
  { wrong: '케챂', right: '케첩', note: '받침에는 ㄱㄴㄹㅁㅂㅅㅇ만 씁니다. ketchup은 케첩입니다.' },
  { wrong: '알콜', right: '알코올', note: 'alcohol의 [oʊ]는 오오로 적어 알코올이 됩니다.' },
  { wrong: '비지니스', right: '비즈니스', note: 'business의 [z]는 ㅈ, [ɪ]는 이라 비즈니스입니다.' },
  { wrong: '심포지움', right: '심포지엄', note: '-ium은 -엄으로 적습니다(스타디움은 관용을 인정한 예외).' },
  { wrong: '스티로폴', right: '스티로폼', note: 'styrofoam의 어말은 [foʊm]이라 폼입니다. 독일어 Styropor의 영향입니다.' },
  { wrong: '후라이팬', right: '프라이팬', note: '[f]는 ㅍ으로 적습니다(제3장 제1절 제6항). 일본식 표기의 영향입니다.' },
  { wrong: '쇼파', right: '소파', note: 'sofa의 첫 음절은 [soʊ]라 소입니다.' },
  { wrong: '리모콘', right: '리모컨', note: 'remote control의 준말로, control의 [ə]는 ㅓ입니다.' },
  { wrong: '쥬스', right: '주스', note: "juice의 [uː]는 'ㅜ'입니다. 'ㅈ' 뒤에 이중 모음을 적지 않습니다(제2장 표1)." },
  { wrong: '스케쥴', right: '스케줄', note: "schedule의 어말 [uːl]은 '줄'입니다. 'ㅈ' 뒤에 이중 모음을 적지 않습니다." },
  { wrong: '데스크탑', right: '데스크톱', note: 'desktop의 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '도너츠', right: '도넛', note: "doughnut은 단수형을 기준으로 '도넛'으로 적습니다. 어말 [t]는 받침 ㅅ입니다." },
  { wrong: '도넛츠', right: '도넛', note: "표준국어대사전 표제어는 '도넛'입니다." },
  { wrong: '엘레베이터', right: '엘리베이터', note: 'elevator의 둘째 음절 모음은 [ɪ]라 리로 적습니다.' },
  { wrong: '부페', right: '뷔페', note: '프랑스어 buffet의 [y]는 ㅟ로 적습니다.' },
  // 된소리 표기 — 외래어 표기법 제1장 제4항은 파열음에 된소리를 쓰지 않는다
  { wrong: '까페', right: '카페', note: '파열음 표기에는 된소리를 쓰지 않습니다(제1장 제4항). café의 [k]는 ㅋ입니다.' },
  { wrong: '카페라떼', right: '카페라테', note: '파열음 표기에는 된소리를 쓰지 않습니다. caffè latte는 카페라테입니다.' },
  { wrong: '스파게띠', right: '스파게티', note: '파열음 표기에는 된소리를 쓰지 않습니다(제1장 제4항).' },
  { wrong: '삐에로', right: '피에로', note: '파열음 표기에는 된소리를 쓰지 않습니다. pierrot은 피에로입니다.' },
  { wrong: '모짜렐라', right: '모차렐라', note: '파찰음에도 된소리를 쓰지 않습니다. mozzarella는 모차렐라입니다.' },
  // 일본어를 거친 표기
  { wrong: '밧데리', right: '배터리', note: 'battery의 [æ]는 ㅐ, [t]는 ㅌ입니다. 일본식 バッテリー의 잔재입니다.' },
  { wrong: '빳데리', right: '배터리', note: 'battery는 배터리로 적습니다. 일본식 표기의 잔재입니다.' },
  { wrong: '데이타', right: '데이터', note: 'data의 어말 [tə]는 터입니다. 일본식 データ의 영향입니다.' },
  { wrong: '센타', right: '센터', note: 'center의 어말 [tə]는 터입니다.' },
  { wrong: '라이타', right: '라이터', note: 'lighter의 어말 [tə]는 터입니다.' },
  { wrong: '아답터', right: '어댑터', note: 'adapter의 첫 음절 [ə]는 ㅓ, [æ]는 ㅐ입니다.' },
  { wrong: '메뉴얼', right: '매뉴얼', note: 'manual의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '판넬', right: '패널', note: 'panel의 [æ]는 ㅐ이고 [n]은 겹치지 않습니다. 일본식 パネル의 영향입니다.' },
  { wrong: '후라이드', right: '프라이드', note: '[f]는 ㅍ으로 적습니다(제3장 제1절 제6항).' },
  { wrong: '후라이', right: '프라이', note: '[f]는 ㅍ으로 적습니다. 일본식 フライ의 영향입니다.' },
  { wrong: '화이팅', right: '파이팅', note: '[f]는 ㅍ으로 적습니다. 표준국어대사전 표제어도 파이팅입니다.' },
  { wrong: '카스테라', right: '카스텔라', note: '포르투갈어 castella의 [l]은 ㄹㄹ로 적습니다.' },
  { wrong: '바게뜨', right: '바게트', note: '파열음 표기에는 된소리를 쓰지 않습니다(제1장 제4항). 프랑스어 baguette입니다.' },
  { wrong: '크로와상', right: '크루아상', note: '프랑스어 croissant의 표준 표기는 크루아상입니다.' },
  { wrong: '뱃지', right: '배지', note: 'badge에는 받침으로 적을 자음이 없습니다.' },
  { wrong: '셋트', right: '세트', note: 'set의 짧은 모음 뒤 어말 [t]는 받침 ㅅ으로 적어 세트가 됩니다.' },
  { wrong: '런닝', right: '러닝', note: '같은 자음을 겹쳐 적지 않습니다(제1장 제2항). running은 러닝입니다.' },
  // ㅈ·ㅊ 뒤의 이중 모음 — 제2장 표1에 따라 적지 않는다
  { wrong: '텔레비젼', right: '텔레비전', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다(제2장 표1)." },
  { wrong: '비젼', right: '비전', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다. vision은 비전입니다." },
  { wrong: '버젼', right: '버전', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다. version은 버전입니다." },
  { wrong: '브라우져', right: '브라우저', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다." },
  { wrong: '매니져', right: '매니저', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다." },
  { wrong: '쥬얼리', right: '주얼리', note: "'ㅈ' 뒤에는 이중 모음을 적지 않습니다." },
  { wrong: '시츄에이션', right: '시추에이션', note: "'ㅊ' 뒤에는 이중 모음을 적지 않습니다." },
  // [ʃ] 표기 — 모음 앞에서는 뒤 모음에 따라 적는다(제3장 제1절 제3항)
  { wrong: '밀크쉐이크', right: '밀크셰이크', note: '모음 앞의 [ʃeɪ]는 셰로 적습니다(제3장 제1절 제3항).' },
  { wrong: '쉐이크', right: '셰이크', note: '모음 앞의 [ʃeɪ]는 셰로 적습니다.' },
  { wrong: '쉐프', right: '셰프', note: '모음 앞의 [ʃe]는 셰로 적습니다.' },
  { wrong: '커피샵', right: '커피숍', note: '[ʃɒ]는 쇼로 적고 어말 [p]는 받침 ㅂ이라 숍이 됩니다.' },
  { wrong: '헤어샵', right: '헤어숍', note: '[ʃɒ]는 쇼로 적습니다. -shop은 -숍입니다.' },
  // 모음 대응
  { wrong: '프리젠테이션', right: '프레젠테이션', note: 'presentation의 둘째 음절 모음은 [e]라 레로 적습니다.' },
  { wrong: '컴플렉스', right: '콤플렉스', note: 'complex의 첫 음절 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '콘트롤', right: '컨트롤', note: 'control의 첫 음절 [ə]는 ㅓ에 대응합니다.' },
  { wrong: '컨테스트', right: '콘테스트', note: 'contest의 첫 음절 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '컨셉트', right: '콘셉트', note: 'concept의 첫 음절 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '컨퍼런스', right: '콘퍼런스', note: 'conference의 첫 음절 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '네비게이션', right: '내비게이션', note: 'navigation의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '코메디', right: '코미디', note: 'comedy의 둘째 음절 모음은 [ɪ]라 미로 적습니다.' },
  { wrong: '미스테리', right: '미스터리', note: 'mystery의 [ə]는 ㅓ에 대응합니다.' },
  { wrong: '매니아', right: '마니아', note: 'mania의 첫 음절은 [meɪ]가 아니라 [mæ]라 마로 적습니다.' },
  { wrong: '프로포즈', right: '프러포즈', note: 'propose의 첫 음절 [ə]는 ㅓ에 대응합니다.' },
  { wrong: '프론트', right: '프런트', note: 'front의 [ʌ]는 ㅓ에 대응합니다.' },
  { wrong: '트랜드', right: '트렌드', note: 'trend의 [e]는 ㅔ로 적습니다.' },
  { wrong: '플렛폼', right: '플랫폼', note: 'platform의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '에니메이션', right: '애니메이션', note: 'animation의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '다이나믹', right: '다이내믹', note: 'dynamic의 둘째 음절 [æ]는 ㅐ로 적습니다.' },
  { wrong: '액센트', right: '악센트', note: "표준국어대사전 표제어는 '악센트'입니다." },
  { wrong: '에어콘', right: '에어컨', note: 'air conditioner의 준말로, con의 [ə]는 ㅓ입니다.' },
  { wrong: '커텐', right: '커튼', note: 'curtain의 어말 [tən]은 튼입니다.' },
  { wrong: '다이알', right: '다이얼', note: 'dial의 어말 [əl]은 얼입니다.' },
  { wrong: '심볼', right: '심벌', note: 'symbol의 [əl]은 얼이 아니라 벌로, 표제어는 심벌입니다.' },
  { wrong: '타겟', right: '타깃', note: 'target의 둘째 음절 모음은 [ɪ]라 깃으로 적습니다.' },
  { wrong: '리플렛', right: '리플릿', note: 'leaflet의 어말 [lɪt]은 릿입니다.' },
  { wrong: '랩탑', right: '랩톱', note: 'laptop의 [ɒ]는 ㅗ에 대응합니다.' },
  { wrong: '스넥', right: '스낵', note: 'snack의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '배트민턴', right: '배드민턴', note: 'badminton의 [d]는 ㄷ입니다.' },
  { wrong: '메트리스', right: '매트리스', note: 'mattress의 [æ]는 ㅐ로 적습니다.' },
  { wrong: '카라멜', right: '캐러멜', note: 'caramel의 [æ]는 ㅐ, [ə]는 ㅓ입니다.' },
  { wrong: '크리스찬', right: '크리스천', note: 'Christian의 어말 [tʃən]은 천입니다.' },
  { wrong: '레크레이션', right: '레크리에이션', note: 'recreation의 둘째 음절 모음은 [ɪ]라 리로 적습니다.' },
  { wrong: '에스칼레이터', right: '에스컬레이터', note: 'escalator의 [ə]는 ㅓ에 대응합니다.' },
  { wrong: '스프링쿨러', right: '스프링클러', note: 'sprinkler의 [klə]는 클러입니다.' },
  { wrong: '카운셀링', right: '카운슬링', note: 'counseling의 [sə]는 슬입니다.' },
  { wrong: '앰뷸란스', right: '앰뷸런스', note: 'ambulance의 [ə]는 ㅓ에 대응합니다.' },
  { wrong: '앰블런스', right: '앰뷸런스', note: 'ambulance의 [bjə]는 뷸로 적습니다.' },
  { wrong: '알러지', right: '알레르기', note: "독일어 Allergie를 따라 표준국어대사전 표제어는 '알레르기'입니다." },
  { wrong: '팡파레', right: '팡파르', note: '프랑스어 fanfare의 어말 [aːʁ]는 르로 적습니다.' },
  { wrong: '할로윈', right: '핼러윈', note: 'Halloween의 [æ]는 ㅐ, [ə]는 ㅓ입니다.' },
  { wrong: '렌트카', right: '렌터카', note: 'rent-a-car의 [tə]는 터입니다.' },
  { wrong: '카톨릭', right: '가톨릭', note: '무성 파열음 [k]는 어두에서 ㄱ으로 적어 온 관용을 인정합니다.' },
  { wrong: '수퍼마켓', right: '슈퍼마켓', note: 'super의 [uː]는 ㅠ로 적어 온 관용을 인정합니다.' },
]

const byWrong = new Map(WORDS.map((word) => [word.wrong, word]))
// 긴 표기를 먼저 시도해야 '악세사리'가 '악세'류 짧은 항목에 먹히지 않는다.
const source = [...WORDS]
  .sort((a, b) => b.wrong.length - a.wrong.length)
  .map((word) => word.wrong)
  .join('|')

export const loanword = defineRule({
  id: 'loanword',
  autoFixSafe: true,
  category: 'spelling',
  confidence: 0.95,
  // 앞에 한글이 붙어 있으면 다른 낱말의 일부다. ('일부 페이지'의 '부 페'는 애초에 공백으로 갈린다)
  pattern: new RegExp(`(?<![가-힣])(${source})`, 'g'),
  resolve(ctx) {
    const entry = byWrong.get(ctx.match[1] ?? '')
    if (!entry) return null

    // 받침이 바뀌면 뒤따르는 조사도 함께 고친다. '케잌을 → 케이크를'
    const rest = ctx.text.slice(ctx.index + entry.wrong.length)
    const adapted = adaptJosa(entry.wrong, entry.right, rest)

    return {
      suggestions: [adapted ? entry.right + adapted.josa : entry.right],
      length: entry.wrong.length + (adapted?.consumed ?? 0),
      subId: entry.wrong,
      message: `'${entry.wrong}'은 외래어 표기법에 맞지 않습니다. '${entry.right}'로 적습니다.`,
      explain: entry.note,
      refs: ['외래어 표기법'],
    }
  },
  examples: [
    { wrong: '디지탈 컨텐츠 시장이 커지고 있다.', right: '디지털 콘텐츠 시장이 커지고 있다.' },
    { wrong: '케잌을 만들어서 나눠 먹었다.', right: '케이크를 만들어서 나눠 먹었다.' },
    { wrong: '거실에 카페트를 깔았다.', right: '거실에 카펫을 깔았다.' },
    { wrong: '스티로폴로 포장했어요.', right: '스티로폼으로 포장했어요.' },
    { wrong: '이번 워크샵에서 리더쉽 강의를 들었다.', right: '이번 워크숍에서 리더십 강의를 들었다.' },
    { wrong: '악세사리를 선물로 샀어요.', right: '액세서리를 선물로 샀어요.' },
  ],
  counterExamples: [
    // 음절 단위로 일반화했을 때 깨지는 정상 표기들
    '컨테이너에 짐을 실었다.',
    '오늘 컨디션이 좋지 않다.',
    '레포츠 용품을 파는 가게다.',
    '메세나 활동으로 예술을 후원한다.',
    '라면에 사리를 추가했다.',
    '이 문제는 생각보다 쉽게 풀렸다.',
    '플랑크톤은 바다의 시작이다.',
    '콘서트 표를 예매했다.',
    '아웃렛에서 옷을 샀다.',
    '이번 대회에서 이탈자가 없었다.',
    '그건 네 잘못이 아니라 내 실수였다.',
    '일부 페이지가 찢어져 있었다.',
  ],
})

export const loanwordRules: Rule[] = [loanword]
