// 기록 목록: 전체(최근 12개, 더 보기) / 메모 / ★ 후보 거르기, 기록 삭제
import { state } from "./state.js";
import { $, toast } from "./util.js";
import { switchEntry, showEntry, toggleStar, clearHistory } from "./entry.js";
import { newQuestion } from "./view-stage.js";
import { render } from "./render.js";

const SHORT = 12;
let filter = "all";
let showAll = false;   // 전체에서 12개 넘는 기록 펼치기

function filtered() {
  if (filter === "memo") return state.history.filter(h => h.memo);
  if (filter === "star") return state.history.filter(h => h.star);
  return showAll ? state.history : state.history.slice(0, SHORT);
}

export function renderHistory() {
  const history = state.history;
  $("history").hidden = !history.length;
  document.querySelectorAll("#filter-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  const items = filtered().map(historyItem);
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = filter === "star" ? "★ 후보로 표시한 조합이 아직 없어요." : "메모를 남긴 조합이 아직 없어요.";
    items.push(li);
  }
  if (filter === "all" && history.length > SHORT) items.push(moreButton(history.length - SHORT));
  $("history-list").replaceChildren(...items);
}

function historyItem(h) {
  const li = document.createElement("li");
  const open = document.createElement("button");
  open.type = "button"; open.className = "h-open";
  open.innerHTML = `<span class="t"></span><span class="words"></span>`;
  open.querySelector(".t").textContent = h.time;
  open.querySelector(".words").textContent = h.words.join(", ");
  if (h.memo) {
    const m = document.createElement("span");
    m.className = "memo-preview"; m.textContent = h.memo.replace(/\s+/g, " ");
    open.append(m);
  }
  open.onclick = () => openFromHistory(h);
  const star = document.createElement("button");
  star.type = "button"; star.className = "h-star"; star.textContent = h.star ? "★" : "☆";
  star.setAttribute("aria-pressed", String(!!h.star));
  star.setAttribute("aria-label", h.star ? "후보에서 빼기" : "후보로 표시");
  star.onclick = () => { toggleStar(h); render(); toast(h.star ? "후보로 표시했어요" : "후보에서 뺐어요"); };
  li.append(open, star);
  return li;
}

// '더 보기 (N개)' / 펼친 뒤엔 맨 아래 '접기'
function moreButton(hiddenCount) {
  const li = document.createElement("li");
  const more = document.createElement("button");
  more.type = "button"; more.className = "linkbtn h-more";
  more.textContent = showAll ? "접기" : `더 보기 (${hiddenCount}개)`;
  more.setAttribute("aria-expanded", String(showAll));
  more.onclick = () => {
    showAll = !showAll; renderHistory();
    // 접으면 버튼이 위로 올라가니 기록 머리가 화면 밖이면 보이게 하고 초점도 옮김
    if (!showAll) {
      if ($("history").getBoundingClientRect().top < 0) $("history").scrollIntoView({ block: "start" });
      $("history-list").querySelector(".h-more")?.focus({ preventScroll: true });
    }
  };
  li.append(more);
  return li;
}

// 기록에서 꺼낸 조합이 지금 조합이 됨 (기록에는 그대로 남고, 뽑기 설정도 그 기록에 맞춤)
function openFromHistory(h) {
  if (state.spinning) return;   // 셔플이 끝나면 뽑은 조합으로 덮이므로 막음
  switchEntry(h);
  showEntry(true);
  if (!$("combo-q").textContent) newQuestion();
  render();
  toast("이전 조합을 불러왔어요");
}

document.querySelectorAll("#filter-seg button").forEach(b => b.onclick = () => {
  filter = b.dataset.filter; showAll = false; renderHistory();
});

// 기록 삭제 (페이지 안 확인 창)
const showPanel = open => {
  $("history-clear-panel").hidden = !open;
  $("history-clear-open").setAttribute("aria-expanded", String(open));
};
$("history-clear-open").onclick = () => {
  const open = $("history-clear-panel").hidden;
  if (open) {
    const kept = state.history.filter(h => h.memo || h.star).length;
    $("history-clear-note").textContent = `기록 ${state.history.length}개가 지워져요.`
      + (kept ? ` 메모나 ★가 있는 ${kept}개도 포함돼요.` : "") + " 지금 화면의 조합은 남아요.";
  }
  showPanel(open);
};
$("history-clear-cancel").onclick = () => showPanel(false);
$("history-clear-go").onclick = () => {
  clearHistory(); filter = "all";
  showPanel(false);
  render(); toast("기록을 모두 지웠어요");
};
