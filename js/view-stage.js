// 오른쪽 결과 화면: 뽑기 줄 버튼, 쪽지, 이번 조합(메모·핀 고정)
import { state } from "./state.js";
import { $, toast, ICON_REROLL, ICON_PIN, reduced } from "./util.js";
import { drawDecks, deckColor, deckName, blocker } from "./decks.js";
import { togglePin, setMemo, removeSlips, saveHistory } from "./entry.js";
import { draw } from "./draw.js";
import { render } from "./render.js";
import { renderHistory } from "./view-history.js";
import { syncUrl } from "./share.js";

const slipsEl = $("slips"), memoEl = $("memo");

export function renderControls() {
  $("draw").disabled = state.spinning || !drawDecks().length;
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
  // 빈 화면 안내는 지금 상황에 맞게 (덱이 어디 있는지는 화면 폭마다 달라서 '왼쪽' 같은 말은 안 씀)
  $("empty-hint").textContent = {
    off: "뽑을 덱을 켜고 ‘뽑기’를 누르세요.",
    empty: "덱에 키워드를 넣고 ‘뽑기’를 누르세요.",
  }[blocker()] ?? "‘뽑기’를 누르면 켠 덱마다 쪽지가 나와요.";
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
  } else if (document.activeElement !== memoEl && memoEl.value !== (e?.memo ?? "")) {
    memoEl.value = e?.memo ?? "";   // 기록 목록에서 같은 조합의 메모를 고친 경우
  }
  const pin = $("pin");
  pin.hidden = !e;
  pin.setAttribute("aria-pressed", String(!!e?.pin));
  pin.innerHTML = ICON_PIN + (e?.pin ? "핀 고정됨" : "핀 고정");
}

$("pin").onclick = () => {
  const e = state.entry;
  if (!e) return;
  togglePin(e); render();
  toast(e.pin ? "핀 고정했어요. 기록 맨 위에 남아요" : "핀을 뺐어요");
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
