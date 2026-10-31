// 오른쪽 결과 화면: 뽑기 줄 버튼, 쪽지, 이번 조합(질문·★·메모·기록하기)
import { state } from "./state.js";
import { $, toast, rand, ICON_REROLL, reduced } from "./util.js";
import { drawDecks, deckColor, deckName } from "./decks.js";
import { isSaved, remember, forget, toggleStar, setMemo, removeSlips, saveHistory } from "./entry.js";
import { PROMPTS } from "./samples.js";
import { draw } from "./draw.js";
import { render } from "./render.js";
import { renderHistory } from "./view-history.js";
import { syncUrl } from "./share.js";

const slipsEl = $("slips"), memoEl = $("memo"), questionEl = $("combo-q");
const ICON_PIN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';

export function renderControls() {
  $("draw").disabled = state.spinning || !drawDecks().length;
  $("copy").disabled = state.spinning || !state.current.length;
  $("share").disabled = state.spinning || !drawDecks().length;
  $("opt-unique").setAttribute("aria-pressed", String(state.skipSeen));
}

// 쪽지를 지금 상태대로 다시 그림. landed: 방금 뽑혀 착지 효과를 줄 칸 번호
export function buildSlips(landed = []) {
  const showSrc = new Set(state.current.map(c => c.from)).size > 1;   // 덱이 섞일 때만 덱 이름·색 점
  slipsEl.replaceChildren(...state.current.map((item, i) => {
    const s = slipEl(item, i, showSrc);
    if (landed.includes(i) && !reduced()) s.classList.add("landed");
    return s;
  }));
  $("empty-stage").hidden = state.current.length > 0;
}

// 쪽지 한 장. innerHTML에는 고정 문자열만, 사용자가 쓴 글은 textContent로
function slipEl(item, i, showSrc) {
  const s = document.createElement("article");
  s.className = "slip" + (item.locked ? " locked" : "");
  s.style.setProperty("--dot", deckColor(item.from));   // 테두리는 늘 덱 색
  s.innerHTML = `<div class="meta"><span class="${showSrc ? "src" : ""}"></span><span>${item.locked ? "고정됨" : ""}</span></div>
    <div class="word"></div>
    <div class="acts"><button type="button" class="lock ico-btn">${ICON_PIN}</button><button type="button" class="reroll ico-btn" title="이것만 다시">${ICON_REROLL}</button></div>
    <button type="button" class="slip-x" title="이번 조합에서 빼기">×</button>`;
  s.querySelector(".meta span").textContent = showSrc ? deckName(item.from) : `쪽지 ${i + 1}`;
  s.querySelector(".word").textContent = item.word;

  const lock = s.querySelector(".lock");
  lock.title = item.locked ? "고정 해제" : "고정";
  lock.setAttribute("aria-label", `‘${item.word}’ 고정`);   // 상태는 aria-pressed가 알림
  lock.setAttribute("aria-pressed", String(item.locked));
  lock.onclick = () => { if (state.spinning) return; item.locked = !item.locked; render(); };

  const reroll = s.querySelector(".reroll");
  reroll.setAttribute("aria-label", `‘${item.word}’ 이것만 다시`);
  reroll.onclick = () => draw([i]);

  // × : 덱은 그대로 두고 지금 조합에서만 뺌
  const x = s.querySelector(".slip-x");
  x.setAttribute("aria-label", `‘${item.word}’ 이번 조합에서 빼기`);
  x.onclick = () => { removeSlips(c => c === item); render(); };
  return s;
}

// 이번 조합 카드. 지금 조합이 바뀌었을 때만 메모 칸을 그 조합의 메모로 바꿈 (입력 중 커서가 튀지 않게)
let shownEntry, memoTimer;
export function renderCombo() {
  const e = state.entry;
  $("combo").hidden = !state.current.length;
  if (e !== shownEntry) {
    shownEntry = e;
    clearTimeout(memoTimer);
    memoEl.value = e?.memo ?? "";
    $("memo-state").textContent = "";
  }
  const star = $("star"), save = $("save-entry"), saved = isSaved(e);
  star.hidden = save.hidden = !e;
  star.setAttribute("aria-pressed", String(!!e?.star));
  star.textContent = e?.star ? "★ 후보" : "☆ 후보로 표시";
  save.classList.toggle("saved", saved);
  save.textContent = saved ? "✓ 기록됨" : "기록하기";
  save.title = saved ? "한 번 더 누르면 기록에서 빼요" : "";
}

// 질문을 새로 고름 (지금 질문과 다른 것으로)
export function newQuestion() {
  const l = PROMPTS.filter(p => p !== questionEl.textContent);
  questionEl.textContent = l[rand(l.length)];
}
$("q-reroll").innerHTML = ICON_REROLL;
$("q-reroll").onclick = newQuestion;

$("star").onclick = () => {
  const e = state.entry;
  if (!e) return;
  toggleStar(e); render();
  toast(e.star ? "후보로 표시했어요" : "후보에서 뺐어요");
};
// 기록하기 / ✓ 기록됨(다시 누르면 기록에서 뺌)
$("save-entry").onclick = () => {
  const e = state.entry;
  if (!e) return;
  if (isSaved(e)) { forget(e); toast("기록에서 뺐어요"); }
  else { remember(e); toast("기록에 남겼어요"); }
  saveHistory(); render();
};
// 메모: 입력은 바로 지금 조합에 넣고, 저장은 잠깐 멈췄을 때
memoEl.addEventListener("input", () => {
  if (!state.entry) return;
  setMemo(memoEl.value);
  $("memo-state").textContent = "저장 중…";
  clearTimeout(memoTimer);
  // 메모는 기록 목록(메모 미리보기)과 주소에만 보이므로 그 둘만 다시 그림 (쪽지까지 다시 그리면 착지 효과가 끊김)
  memoTimer = setTimeout(() => {
    saveHistory(); renderHistory(); syncUrl();
    $("memo-state").textContent = "저장됨 · " + new Date().toTimeString().slice(0, 5);
  }, 400);
});
