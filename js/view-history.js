// 기록 목록: 핀 고정한 기록은 늘 맨 위. 전체(핀 + 최근 12개, 더 보기) / 핀 거르기, 기록 삭제(핀은 남김)
import { state } from "./state.js";
import { $, toast, ICON_PIN, ICON_PENCIL } from "./util.js";
import { switchEntry, showEntry, togglePin, clearHistory, setMemo, saveHistory } from "./entry.js";
import { render } from "./render.js";

const SHORT = 12;
let filter = "all";
let showAll = false;   // 전체에서 12개 넘는 기록 펼치기
let memoOpen = null;   // 메모 칸을 펼친 기록의 id (기록을 열지 않고 뒤늦게 메모 남기기)
let memoTimer;

// 핀 고정한 기록을 맨 위로 (각 묶음 안에서는 최근 순)
const pinned = () => state.history.filter(h => h.pin);
const unpinned = () => state.history.filter(h => !h.pin);
function filtered() {
  if (filter === "pin") return pinned();
  return [...pinned(), ...(showAll ? unpinned() : unpinned().slice(0, SHORT))];
}

export function renderHistory() {
  const history = state.history;
  $("history").hidden = !history.length;
  document.querySelectorAll("#filter-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
  const items = filtered().map(historyItem);
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "핀 고정한 조합이 아직 없어요.";
    items.push(li);
  }
  const rest = unpinned().length;
  if (filter === "all" && rest > SHORT) items.push(moreButton(rest - SHORT));
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
  if (h.pin) li.className = "pinned";
  // 메모 남기기: 누르면 이 줄 아래에 메모 칸이 펼쳐짐
  const editing = memoOpen === h.id;
  const memoBtn = document.createElement("button");
  memoBtn.type = "button"; memoBtn.className = "h-memo"; memoBtn.innerHTML = ICON_PENCIL;
  memoBtn.setAttribute("aria-expanded", String(editing));
  memoBtn.setAttribute("aria-label", h.memo ? "메모 고치기" : "메모 남기기");
  memoBtn.title = h.memo ? "메모 고치기" : "메모 남기기";
  memoBtn.onclick = () => {
    memoOpen = editing ? null : h.id;
    renderHistory();
    if (!editing) $("history-list").querySelector(".h-memo-edit")?.focus();
  };
  const pin = document.createElement("button");
  pin.type = "button"; pin.className = "h-pin"; pin.innerHTML = ICON_PIN;
  pin.setAttribute("aria-pressed", String(!!h.pin));
  pin.setAttribute("aria-label", h.pin ? "핀 빼기" : "핀 고정");
  pin.title = h.pin ? "핀 빼기" : "핀 고정 (기록 맨 위에 남고, 기록 삭제에도 안 지워져요)";
  pin.onclick = () => { togglePin(h); render(); toast(h.pin ? "핀 고정했어요. 기록 맨 위에 남아요" : "핀을 뺐어요"); };
  li.append(open, memoBtn, pin);
  if (editing) li.append(memoEditor(h));
  return li;
}

// 기록 줄 아래 메모 칸: 입력은 바로 그 기록에 넣고, 잠깐 멈추면 저장. 칸을 벗어나면(change) 화면에 반영
function memoEditor(h) {
  const ta = document.createElement("textarea");
  ta.className = "h-memo-edit"; ta.value = h.memo ?? ""; ta.rows = 2;
  ta.placeholder = "이 조합에서 떠오른 생각을 적어 두세요.";
  ta.setAttribute("aria-label", `‘${h.words.join(", ")}’ 메모`);
  ta.addEventListener("input", () => {
    setMemo(ta.value, h);
    clearTimeout(memoTimer);
    memoTimer = setTimeout(saveHistory, 400);
  });
  ta.addEventListener("change", () => { clearTimeout(memoTimer); saveHistory(); render(); });
  ta.addEventListener("keydown", e => { if (e.key === "Escape") { memoOpen = null; ta.blur(); renderHistory(); } });
  return ta;
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
    const gone = unpinned(), memos = gone.filter(h => h.memo).length, pins = pinned().length;
    $("history-clear-note").textContent = !gone.length ? "핀 고정한 기록만 있어서 지울 기록이 없어요."
      : `기록 ${gone.length}개가 지워져요.` + (memos ? ` 메모가 있는 ${memos}개도 포함돼요.` : "")
        + (pins ? ` 핀 고정한 ${pins}개는 남아요.` : "") + " 지금 화면의 조합도 남아요.";
    $("history-clear-go").disabled = !gone.length;
  }
  showPanel(open);
};
$("history-clear-cancel").onclick = () => showPanel(false);
$("history-clear-go").onclick = () => {
  const pins = pinned().length;
  clearHistory(); filter = "all";
  showPanel(false);
  render(); toast(pins ? "핀 고정한 기록만 남기고 지웠어요" : "기록을 모두 지웠어요");
};
