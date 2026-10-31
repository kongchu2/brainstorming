// 시작점: 저장값을 불러와 첫 화면을 그리고, 화면 위쪽 버튼(뽑기 줄·테마·초기화)을 연결
import { state } from "./state.js";
import { $, store, KEEP, framed, reduced, toast } from "./util.js";
import { loadDecks, saveDecks, drawDecks } from "./decks.js";
import { loadHistory, newEntry, switchEntry, showEntry, saveHistory, setMemo } from "./entry.js";
import { readSharedLink, shareUrl, syncUrl } from "./share.js";
import { newQuestion } from "./view-stage.js";
import { draw } from "./draw.js";
import { render } from "./render.js";

// ── 시작 ──
// 처음 방문: KEEP(기록·테마·애니메이션 최소화) 말고 저장값이 하나도 없음. 불러오기 전에 판단
const freshStart = (() => {
  try { return Object.keys(localStorage).every(k => !k.startsWith("kwdraw:") || KEEP.has(k)); }
  catch { return true; }
})();
store.remove("url");   // 예전에 새로고침 판단용으로 저장하던 주소
state.skipSeen = store.get("skipSeen") ?? true;
loadDecks();
loadHistory();
const sharedMemo = readSharedLink();   // 공유 링크면 덱을 맞추고 state.current를 채움
saveDecks();

if (state.current.length) {
  // 공유 링크로 들어온 조합: 지금 조합과 같으면 이어 쓰고, 아니면 지금 조합을 기록으로 넘기고 바꿈
  const e = state.entry;
  if (e && e.words.join("\n") === state.current.map(c => c.word).join("\n")) {
    e.decks = state.current.map(c => c.from);
    if (sharedMemo && !e.memo) setMemo(sharedMemo);
    saveHistory();
  } else switchEntry(newEntry({ memo: sharedMemo }));
}
if (state.entry) { showEntry(); newQuestion(); }   // 새로고침해도 지금 조합과 메모가 그대로
render();
// 처음 방문이면 무엇을 하는 도구인지 보이도록 예시로 한 번 뽑아 둠. 다녀간 사용자가 쪽지를 다 뺀 상태면 빈 화면 그대로
if (!state.entry && freshStart && sharedMemo === null && drawDecks().length) draw(undefined, true);

// ── 뽑기 줄 ──
if (!/Mac|iPhone|iPad/.test(navigator.platform)) $("draw-key").textContent = "Ctrl+Enter";
$("share").hidden = framed;
$("draw").onclick = () => draw();
// Cmd/Ctrl+Enter로 뽑기 (메모 같은 textarea 안에서는 안 먹음)
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); draw(); }
});
$("opt-unique").onclick = () => {
  state.skipSeen = !state.skipSeen; store.set("skipSeen", state.skipSeen); render();
  toast(state.skipSeen ? "기록에 있는 조합은 다시 나오지 않아요" : "이미 나온 조합도 다시 나올 수 있어요");
};
$("copy").onclick = async () => {
  const text = state.current.map(c => c.word).join(", ");
  try { await navigator.clipboard.writeText(text); toast("복사했어요: " + text); }
  catch { toast("이 환경에서는 복사할 수 없어요"); }
};
$("share").onclick = async () => {
  syncUrl();
  try { await navigator.clipboard.writeText(location.origin + shareUrl()); toast("공유 링크를 복사했어요"); }
  catch { toast("주소창의 링크를 복사해 공유하세요"); }
};

// 애니메이션 최소화: 저장값이 없으면 OS 설정을 따름. 고른 값이 OS 설정과 같으면 저장값을 지워 다시 OS를 따르게.
// 판단은 머리 스크립트의 window.kwdrawMotion 한 곳에서
let motionChoice = store.get("motion");
const osReduce = matchMedia("(prefers-reduced-motion: reduce)");
const applyMotion = () => $("opt-motion").setAttribute("aria-pressed", String(window.kwdrawMotion(motionChoice)));
applyMotion();
// 페이지를 연 채로 OS 설정을 바꿔도 따라감 (예전 Safari는 addListener만 있음)
if (osReduce.addEventListener) osReduce.addEventListener("change", applyMotion); else osReduce.addListener?.(applyMotion);
$("opt-motion").onclick = () => {
  const pick = reduced() ? "full" : "reduce";
  motionChoice = (pick === "reduce") === osReduce.matches ? null : pick;
  motionChoice ? store.set("motion", motionChoice) : store.remove("motion");
  applyMotion();
};

// ── 테마: 시스템이면 data-theme을 지워 OS 설정을 따름 ──
function applyTheme(choice) {
  if (choice === "light" || choice === "dark") document.documentElement.dataset.theme = choice;
  else { choice = "system"; delete document.documentElement.dataset.theme; }
  document.querySelectorAll("#theme-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
}
applyTheme(store.get("theme"));
document.querySelectorAll("#theme-seg button").forEach(b => b.onclick = () => {
  store.set("theme", b.dataset.themeChoice); applyTheme(b.dataset.themeChoice);
});

// ── 초기화: KEEP만 남기고 저장값을 모두 지운 뒤, 주소의 공유 내용 없이 다시 엶 ──
const showReset = open => {
  $("reset-panel").hidden = !open;
  $("reset-open").setAttribute("aria-expanded", String(open));
};
$("reset-open").onclick = () => showReset($("reset-panel").hidden);
$("reset-cancel").onclick = () => showReset(false);
$("reset-go").onclick = () => {
  try { Object.keys(localStorage).filter(k => k.startsWith("kwdraw:") && !KEEP.has(k)).forEach(k => localStorage.removeItem(k)); } catch {}
  if (framed) location.reload(); else location.replace(location.pathname);
};
