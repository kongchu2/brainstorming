// 지금 조합(entry)과 기록(history). 화면은 view-stage.js·view-history.js
//
// entry: 지금 화면의 조합 {id, time, words, decks, memo, pin, keep}. 메모·핀은 여기에 붙음.
// 다른 조합으로 넘어갈 때(뽑기·기록 열기·쪽지 다 빼기) entry를 늘 기록에 남김. 단 keep === false면 안 남김.
//   keep = false: 예시 뽑기, 기록 삭제 때의 (메모 없는) 지금 조합
//   핀 고정이나 메모를 쓰면 keep이 풀림
// 핀 고정한 기록은 기록 삭제에도 남고, 목록 맨 위에 보임
// 기록 여부(history, keep)는 이 파일 안에서만 바꿈. 다른 파일은 여기 함수를 부를 것
import { state } from "./state.js";
import { store, newId, stamp } from "./util.js";
import { getDeck, findDeckOf, saveDecks } from "./decks.js";

const isSaved = e => !!e && state.history.some(h => h.id === e.id);
// 지금 쪽지로 새 조합을 만듦. sample: 예시 뽑기 (메모·핀 없이 넘어가면 기록에 안 남김)
export function newEntry({ memo = "", sample = false } = {}) {
  const e = { id: newId(), time: stamp(), memo: "", pin: false,
    words: state.current.map(c => c.word), decks: state.current.map(c => c.from) };
  if (sample) e.keep = false;
  if (memo) setMemo(memo, e);
  return e;
}

export function saveHistory() { store.set("history", state.history); store.set("current", state.entry); }
// 메모·핀 없는 기록은 최근 300개까지만
function prune() { let plain = 0; state.history = state.history.filter(h => h.memo || h.pin || ++plain <= 300); }

export function remember(e) {
  delete e.keep;
  if (!isSaved(e)) { state.history.unshift(e); prune(); }
}
// 지금 조합을 next로 바꿈. 이전 조합은 빼 둔 게 아니면 기록에 남김
export function switchEntry(next) {
  const prev = state.entry;
  if (prev?.words?.length && prev.keep !== false) remember(prev);
  state.entry = next;
  saveHistory();
}

export function togglePin(h) {
  h.pin = !h.pin;
  if (h.pin) remember(h);   // 핀 고정한 조합은 기록 맨 위에서 다시 찾으니 함께 기록
  saveHistory();
}
export function setMemo(text, e = state.entry) {
  e.memo = text.trim() ? text : "";
  if (e.memo) delete e.keep;   // 예시 뽑기·기록 삭제 때의 조합도 메모를 쓰면 기록으로 넘김
}
// 기록 삭제: 핀 고정한 기록만 남기고 지움.
// 지금 조합은 화면에 남지만 다음 뽑기 때 다시 기록으로 넘어가지 않게. 핀이나 메모가 있으면 잃지 않게 남김
export function clearHistory() {
  state.history = state.history.filter(h => h.pin);
  const e = state.entry;
  if (e && !e.pin && !e.memo) e.keep = false;
  saveHistory();
}

// 지금 조합에서 쪽지를 뺌 (결과 카드 ×, 덱 비우기). 덱은 그대로.
// 다 빠지면 지금 조합(메모 포함)을 기록으로 넘기고 비움.
// 남으면: 기록된 조합은 그 기록을 그대로 두고 남은 쪽지로 새 조합, 아니면 지금 조합을 고침
export function removeSlips(pred) {
  if (state.spinning || !state.current.some(pred)) return;
  state.current = state.current.filter(c => !pred(c));
  const e = state.entry;
  if (!state.current.length) switchEntry(null);
  else if (isSaved(e) || !e) { state.entry = newEntry(); saveHistory(); }
  else { e.words = state.current.map(c => c.word); e.decks = state.current.map(c => c.from); saveHistory(); }
}

// 지금 조합을 쪽지로 펼침.
// matchSettings: 기록 목록에서 열 때만 뽑기 설정(어떤 덱에서 몇 장)도 그 기록에 맞춤 (지운 덱은 건너뜀).
// 관점 덱("t")은 초기화해도 id가 같으므로, 다른 덱은 다 지워지고 관점 덱만 남은 기록이면 설정을 건드리지 않음
export function showEntry(matchSettings = false) {
  const h = state.entry;
  state.current = h.words.map((word, i) => ({ word, from: h.decks?.[i] ?? findDeckOf(word), locked: false }));
  if (!matchSettings || !h.decks) return;
  const cnt = {};
  for (const id of h.decks) cnt[id] = (cnt[id] || 0) + 1;
  const ids = Object.keys(cnt), live = ids.filter(id => getDeck(id));
  if (live.some(id => id !== "t") || (live.length && ids.every(id => id === "t"))) {
    for (const d of state.decks) { d.use = !!cnt[d.id]; if (cnt[d.id]) d.n = cnt[d.id]; }
    saveDecks();
  }
}

// ── 불러오기 ──
// 예전 기록의 관점 카드(twist)는 관점 덱(id "t")에서 뽑은 키워드 한 장으로
function absorbTwist(h) {
  if (h.twist) { h.words = [...h.words, h.twist]; if (h.decks) h.decks = [...h.decks, "t"]; }
  delete h.twist;
}
// 예전 형식 바꾸기: ★ 후보(star)는 핀(pin)으로, sample·dropped 표시는 keep으로 (예시 뽑기는 메모·핀이 있었으면 남기는 쪽)
function upgradeEntry(e) {
  if ("star" in e) { if (e.star) e.pin = true; delete e.star; }
  if (e.dropped || (e.sample && !e.memo && !e.pin)) e.keep = false;
  delete e.dropped; delete e.sample;
}
export function loadHistory() {
  state.history = store.get("history") ?? [];
  for (const h of state.history) { h.id ??= newId(); absorbTwist(h); upgradeEntry(h); delete h.keep; }
  // 예전 버전은 기록된 조합의 쪽지를 다 빼면 그 기록이 빈 채로 남았음
  state.history = state.history.filter(h => h.words?.length);
  // 저장된 지금 조합. 기록된 조합이면 기록 쪽 객체를 써서 메모가 양쪽에 함께 반영되게
  const saved = store.get("current");
  if (saved?.words?.length) {
    saved.id ??= newId();
    absorbTwist(saved); upgradeEntry(saved);
    state.entry = state.history.find(h => h.id === saved.id) ?? saved;
  }
}
