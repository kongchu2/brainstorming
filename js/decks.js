// 덱 데이터: 불러오기·예전 형식 옮기기·키워드 편집. 화면은 view-decks.js
import { state } from "./state.js";
import { store, newId, splitRaw, uniq } from "./util.js";
import { SAMPLE_A, SAMPLE_B, TWISTS } from "./samples.js";

export const saveDecks = () => store.set("decks", state.decks);

export const getDeck = id => state.decks.find(d => d.id === id);
// 덱 내용은 text가 원본(쉼표·줄바꿈 구분). 칩 추가·삭제도 text를 고침
export const deckWords = d => d ? uniq(splitRaw(d.text)) : [];
// 이번 뽑기에서 제외하지 않은 키워드
export const usable = d => { const ex = new Set(d?.excluded ?? []); return deckWords(d).filter(w => !ex.has(w)); };
// 켜져 있고 뽑을 키워드가 있는 덱
export const drawDecks = () => state.decks.filter(d => d.use && usable(d).length);
// 뽑을 수 없는 이유: "off" 켠 덱이 없음 / "empty" 켠 덱에 뽑을 키워드가 없음 / null 뽑을 수 있음
export const blocker = () => !state.decks.some(d => d.use) ? "off" : !drawDecks().length ? "empty" : null;
// 그 덱에서 실제로 뽑을 장 수
export const want = d => Math.min(Math.max(1, d.n), usable(d).length);
// 덱 색은 순서대로 --c0 ~ --c4 반복
export const deckColor = id => `var(--c${Math.max(0, state.decks.findIndex(d => d.id === id)) % 5})`;
export const deckName = id => getDeck(id)?.name ?? "지운 덱";
export const findDeckOf = word => state.decks.find(d => deckWords(d).includes(word))?.id ?? null;

function setWords(d, list) { d.text = list.join(", "); saveDecks(); }
// 덱에 없는 키워드만 더하고, 더한 개수를 돌려줌
export function addWords(d, raw) {
  const words = deckWords(d), have = new Set(words.map(w => w.toLowerCase()));
  const fresh = uniq(splitRaw(raw)).filter(w => !have.has(w.toLowerCase()));
  if (fresh.length) setWords(d, [...words, ...fresh]);
  return fresh.length;
}
// 키워드를 지우고, 되돌리는 함수를 돌려줌 (되돌릴 때는 지운 키워드만 원래 자리에. 그 사이 한 다른 편집은 그대로)
export function removeWord(d, w) {
  const at = deckWords(d).indexOf(w), wasOff = d.excluded.includes(w);
  d.excluded = d.excluded.filter(x => x !== w);
  setWords(d, deckWords(d).filter(x => x !== w));
  return () => {
    const words = deckWords(d);
    if (words.some(x => x.toLowerCase() === w.toLowerCase())) return;   // 그 사이 다시 넣었으면 그대로
    words.splice(Math.min(at, words.length), 0, w);
    if (wasOff && !d.excluded.includes(w)) d.excluded.push(w);
    setWords(d, words);
  };
}
export function toggleExcluded(d, w) {
  d.excluded = d.excluded.includes(w) ? d.excluded.filter(x => x !== w) : [...d.excluded, w];
  saveDecks();
}

// 새 덱: '새 덱 1'처럼 비어 있는 번호로, 켠 채로
export function newDeck() {
  let k = 1;
  while (state.decks.some(x => x.name === `새 덱 ${k}`)) k++;
  const d = { id: newId(), name: `새 덱 ${k}`, text: "", excluded: [], use: true, n: 1 };
  state.decks.push(d); saveDecks();
  return d;
}
// 덱 전부 삭제: 빈 덱 두 개('새 덱 1', '새 덱 2', 켠 채로)만 남김
export function wipeDecks() {
  state.decks = [];
  newDeck(); newDeck();
}
export function deleteDeck(d) {
  if (state.decks.length <= 1) return;
  state.decks = state.decks.filter(x => x !== d);
  saveDecks();
}

// 저장된 덱을 불러옴. 없으면 예전 저장값을 옮기거나 예시 덱 세 개로 시작
export function loadDecks() {
  let decks = store.get("decks");
  if (!Array.isArray(decks)) decks = migrateDecks();
  // 관점 카드는 이제 보통 덱 하나(id "t"). 예전에 따로 저장하던 관점 카드는 덱 목록 끝으로 옮김
  const old = store.get("twistDeck");
  if (old && !decks.some(d => d.id === "t"))
    decks.push({ id: "t", name: "관점", text: old.text ?? "", excluded: old.excluded ?? [], use: store.get("twistOn") ?? true, n: 1, fold: !!old.fold });
  // 옮긴 관점 덱을 먼저 저장하고, 저장된 게 확인될 때만 예전 키를 지움
  if (old) store.set("decks", decks);
  if (!old || store.get("decks")?.some(d => d.id === "t")) { store.remove("twistDeck"); store.remove("twistOn"); }
  for (const d of decks) { d.excluded ??= []; d.n = Math.max(1, d.n | 0); }
  state.decks = decks;
}

// 예전 저장값(덱 A·B, 관점 카드, 저장한 세트)을 덱 목록으로. 처음 방문이면 키워드·방식·관점 덱을 모두 켜고 한 장씩
function migrateDecks() {
  const out = [];
  const add = (name, text, excluded, use, n) => {
    if (text == null || out.some(d => d.text === text)) return;
    out.push({ id: newId(), name, text, excluded: excluded ?? [], use, n });
  };
  const fresh = store.get("input") == null, dual = fresh || store.get("mode") === "dual";
  add(store.get("nameA") || "키워드", store.get("input") ?? SAMPLE_A, store.get("excluded"), true, fresh ? 1 : dual ? (store.get("nA") ?? 1) : (store.get("n") ?? 2));
  add(store.get("nameB") || "방식", store.get("inputB") ?? SAMPLE_B, store.get("excludedB"), dual, store.get("nB") ?? 1);
  for (const pr of store.get("presets") ?? []) {
    add(pr.name, pr.a, pr.exA, false, 1);
    if (pr.mode === "dual") add(`${pr.name} · ${pr.nameB || "방식"}`, pr.b, pr.exB, false, 1);
  }
  out.push({ id: "t", name: "관점", text: store.get("inputT") ?? TWISTS.join(", "), excluded: store.get("excludedT") ?? [], use: store.get("twistOn") ?? true, n: 1 });
  return out;
}
