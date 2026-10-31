// 화면 전체가 함께 쓰는 상태. 여기 있는 값을 바꾼 뒤에는 저장하고 render()를 부름
export const state = {
  decks: [],         // 덱 [{id, name, text, excluded[], use, n, fold}] (decks.js)
  current: [],       // 지금 쪽지 [{word, from: 덱 id, locked}]
  entry: null,       // 지금 조합 {id, time, words, decks, memo, pin, keep} (entry.js)
  history: [],       // 기록 (entry와 같은 형식)
  skipSeen: true,    // 이미 나온 조합 제외
  spinning: false,   // 셔플 중. 이때는 쪽지를 바꾸는 동작을 모두 막음
  spinSlots: [],     // 셔플·착지 중인 쪽지의 '덱 id\n키워드'. 이 키워드는 덱 칩 하이라이트를 늦게 켬
};
