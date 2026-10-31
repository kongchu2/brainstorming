// 공유 링크: ?dn=덱 이름&dw=키워드,키워드&dc=장 수 (켠 덱마다 반복) &d=뽑힌 키워드,…&m=메모
// 예전 형식 ?k=…&k2=…&p=2&n=…&n2=…&na=…&nb=…&d=…&d2=…와 예전 관점 카드 t=도 읽음
import { state } from "./state.js";
import { framed, newId } from "./util.js";
import { getDeck, deckWords, saveDecks } from "./decks.js";

const csv = s => (s ?? "").split(",").map(x => x.trim()).filter(Boolean);

// 주소는 상태가 바뀔 때마다 이 페이지가 고쳐 둠(syncUrl). 새로고침·뒤로 가기로 다시 연 거면 공유 링크가 아니라 내 상태
const reopened = (() => {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    return nav ? nav.type === "reload" || nav.type === "back_forward" : performance.navigation?.type >= 1;
  } catch { return false; }
})();

// 공유 링크로 들어왔으면 덱을 맞추고 state.current에 공유된 쪽지를 넣음. 공유 메모(없으면 "")를 돌려주고, 공유 링크가 아니면 null
export function readSharedLink() {
  if (reopened) return null;
  const params = new URLSearchParams(location.search);
  let shared = [];
  if (params.getAll("dw").length) {
    const names = params.getAll("dn"), counts = params.getAll("dc");
    shared = params.getAll("dw").map((w, i) => ({ name: names[i] || `덱 ${i + 1}`, words: csv(w), n: parseInt(counts[i], 10) || 1 }));
  } else if (params.get("k")) {   // 예전 형식
    shared.push({ name: params.get("na") || "키워드", words: csv(params.get("k")), n: parseInt(params.get("n"), 10) || 2 });
    if (params.get("p") === "2" && params.get("k2")) shared.push({ name: params.get("nb") || "방식", words: csv(params.get("k2")), n: parseInt(params.get("n2"), 10) || 1 });
  }
  shared = shared.filter(s => s.words.length);
  if (!shared.length) return null;

  // 내 덱은 덮지 않음: 키워드가 같은 덱은 그 덱을 쓰고, 없으면 새 덱으로 추가 (이름만 같으면 '이름 (공유)').
  // text 원문은 줄바꿈·띄어쓰기가 다를 수 있으니(예시 덱은 줄바꿈 포함) 키워드 목록으로 비교
  state.decks.forEach(d => d.use = false);
  const ids = shared.map(s => {
    const key = s.words.join("\n");
    let d = state.decks.find(x => deckWords(x).join("\n") === key);
    if (!d) {
      const name = state.decks.some(x => x.name === s.name) ? `${s.name} (공유)` : s.name;
      d = { id: newId(), name, text: s.words.join(", "), excluded: [], use: true, n: s.n };
      state.decks.push(d);
    }
    d.use = true; d.n = s.n;
    return d.id;
  });
  state.current = [...csv(params.get("d")), ...csv(params.get("d2"))]
    .map(word => { const id = ids.find(x => deckWords(getDeck(x)).includes(word)); return id ? { word, from: id, locked: false } : null; })
    .filter(Boolean);
  // 예전 관점 카드 t=: 관점 덱 한 장으로
  const t = params.get("t");
  const td = t && (deckWords(getDeck("t")).includes(t) ? getDeck("t") : state.decks.find(d => deckWords(d).includes(t)));
  if (td) { if (!td.use) { td.use = true; td.n = 1; } state.current.push({ word: t, from: td.id, locked: false }); }
  saveDecks();
  return params.get("m") ?? "";
}

export function shareUrl() {
  const used = state.decks.filter(d => d.use && deckWords(d).length);
  if (!used.length) return location.pathname;
  const enc = encodeURIComponent, list = l => l.map(enc).join(",");
  const q = [];
  for (const d of used) q.push(`dn=${enc(d.name)}`, `dw=${list(deckWords(d))}`, `dc=${d.n}`);
  if (state.current.length) q.push(`d=${list(state.current.map(c => c.word))}`);
  if (state.current.length && state.entry?.memo) q.push(`m=${enc(state.entry.memo)}`);
  return location.pathname + "?" + q.join("&");
}
// 셔플 중엔 결과가 주소에 미리 보이지 않게 건너뜀
export function syncUrl() {
  if (state.spinning || framed) return;
  const url = shareUrl();
  if (url === location.pathname + location.search) return;
  try { window.history.replaceState(null, "", url); } catch {}
}
