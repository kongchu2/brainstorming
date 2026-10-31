// 왼쪽 덱 목록 화면. 덱 카드: [접기] [이름] [키워드 수] [− n장 +] [켜기] [×], 켠 덱은 아래에 키워드 편집이 펼쳐짐.
// 상태가 바뀔 때마다 통째로 다시 그림. 아직 추가 안 한 입력값·고치는 중인 이름·키보드 초점(data-fk)은 되살림
import { state } from "./state.js";
import { $, toast } from "./util.js";
import {
  saveDecks, deckWords, usable, drawDecks, want, deckColor, blocker,
  addWords, removeWord, toggleExcluded, newDeck, deleteDeck,
} from "./decks.js";
import { removeSlips } from "./entry.js";
import { render } from "./render.js";

const listEl = $("deck-list");
const bulkOpen = new Set();      // 한꺼번에 편집 칸을 펼친 덱
let armedDel = null, armTimer;   // × 는 한 번 누르면 '삭제'로 바뀌고 3초 안에 한 번 더 눌러야 지워짐

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const button = (props, label) => {
  const b = el("button", { type: "button", ...props });
  if (label) b.setAttribute("aria-label", label);
  return b;
};

export function renderDecks() {
  const act = document.activeElement, fk = act?.dataset?.fk;
  const caret = fk && typeof act.selectionStart === "number" ? act.selectionStart : null;
  const typed = new Map([...listEl.querySelectorAll(".add-input")].filter(x => x.value).map(x => [x.dataset.fk, x.value]));
  if (fk?.startsWith("name-")) typed.set(fk, act.value);
  listEl.replaceChildren(...state.decks.map(deckCard));
  for (const [k, v] of typed) { const x = listEl.querySelector(`[data-fk="${k}"]`); if (x) x.value = v; }
  if (fk) {
    const x = listEl.querySelector(`[data-fk="${fk}"]`);
    if (x) { x.focus(); if (caret != null) try { x.setSelectionRange(caret, caret); } catch {} }
  }
  // 덱 목록 위 제목 줄: '덱 N개' · '이번에 N장 뽑아요'
  const total = drawDecks().reduce((s, d) => s + want(d), 0);
  $("decks-title").textContent = `덱 ${state.decks.length}개`;
  $("decks-note").textContent = { off: "켜진 덱이 없어요", empty: "켠 덱에 키워드가 없어요" }[blocker()] ?? `이번에 ${total}장 뽑아요`;
}

// 지금 쪽지에 나온 키워드 ('덱 id\n키워드'). 셔플·착지 중인 칸은 빼 둠 (결과를 미리 알려 주지 않게)
const hitKeys = () => new Set(state.current.map(c => c.from + "\n" + c.word).filter(k => !state.spinSlots.includes(k)));
// 다시 그리지 않고 칩 하이라이트만 바꿈 (입력 중인 글자가 흐트러지지 않게)
export function refreshHits() {
  const hits = hitKeys();
  for (const chip of listEl.querySelectorAll(".chip")) chip.classList.toggle("hit", hits.has(chip.dataset.key));
}

const countText = d => {
  const all = deckWords(d).length, ok = usable(d).length;
  return ok === all ? `${all}개` : `${ok}/${all}개`;
};

function deckCard(d) {
  const li = el("li", { className: "deck-row" + (d.use ? " on" : " unused") + (d.use && d.fold ? " folded" : "") });
  li.style.setProperty("--dot", deckColor(d.id));
  const ok = usable(d).length;

  // 접기 (켠 덱만. 끈 덱은 자리만 차지해서 이름 위치를 맞춤)
  const fold = button({ className: "deck-fold", textContent: "▼", disabled: !d.use },
    d.fold ? `‘${d.name}’ 키워드 펼치기` : `‘${d.name}’ 키워드 접기`);
  fold.dataset.fk = "fold-" + d.id;
  fold.setAttribute("aria-expanded", String(d.use && !d.fold));
  fold.onclick = () => { d.fold = !d.fold; saveDecks(); render(); };

  // 이름: 입력 중엔 저장만, 다 고치면(change) 다시 그림. 비운 이름은 '이름 없는 덱'
  const name = el("input", { className: "deck-name", type: "text", maxLength: 20, value: d.name });
  name.dataset.fk = "name-" + d.id;
  name.setAttribute("aria-label", "덱 이름");
  name.addEventListener("input", () => { d.name = name.value.trim() || "이름 없는 덱"; saveDecks(); });
  name.addEventListener("change", () => { name.value = d.name; render(); });

  const cnt = el("small", { className: "deck-count", textContent: countText(d), title: "키워드 수" });
  const title = el("div", { className: "deck-title" });
  title.append(fold, name, cnt);

  // 장 수 − n장 +
  const max = Math.max(1, ok), v = Math.min(d.n, max);
  const stepBtn = (txt, delta, label) => {
    const b = button({ textContent: txt, disabled: !d.use || (delta < 0 ? v <= 1 : v >= max) }, `‘${d.name}’ ${label}`);
    b.dataset.fk = `${delta}-${d.id}`;
    b.onclick = () => { d.n = Math.min(max, Math.max(1, v + delta)); saveDecks(); render(); };
    return b;
  };
  const step = el("span", { className: "deck-step" });
  step.append(stepBtn("−", -1, "한 장 덜 뽑기"), el("b", { textContent: `${v}장` }), stepBtn("+", 1, "한 장 더 뽑기"));

  // 켜기 스위치. 다시 켜면 펼친 상태로
  const use = button({ className: "toggle mini deck-use", innerHTML: '<span class="sw"></span>' }, `‘${d.name}’ 덱에서 뽑기`);
  use.dataset.fk = "use-" + d.id;
  use.setAttribute("aria-pressed", String(d.use));
  use.onclick = () => { d.use = !d.use; if (d.use) d.fold = false; saveDecks(); render(); };

  const head = el("div", { className: "deck-head" });
  head.append(title, step, use);
  if (state.decks.length > 1) head.append(deleteButton(d));
  li.append(head);
  if (d.use && !d.fold) li.append(deckBody(d));
  return li;
}

function deleteButton(d) {
  const armed = armedDel === d.id;
  const del = button({ className: "deck-del" + (armed ? " armed" : ""), textContent: armed ? "삭제" : "×" },
    armed ? `한 번 더 누르면 ‘${d.name}’ 덱 삭제` : `‘${d.name}’ 덱 삭제`);
  del.dataset.fk = "del-" + d.id;
  del.onclick = () => {
    clearTimeout(armTimer);
    if (armed) {
      armedDel = null; deleteDeck(d); render(); toast(`‘${d.name}’ 덱을 지웠어요`);
    } else {
      armedDel = d.id;
      armTimer = setTimeout(() => { armedDel = null; render(); }, 3000);
      render();
    }
  };
  return del;
}

function deckBody(d) {
  const body = el("div", { className: "deck-edit" });

  // 키워드 입력
  const input = el("input", { className: "add-input", type: "text", autocomplete: "off", placeholder: "키워드 입력 후 Enter" });
  input.dataset.fk = "add-" + d.id;
  input.setAttribute("aria-label", `‘${d.name}’ 덱에 키워드 추가`);
  const addBtn = button({ className: "mini-btn", textContent: "추가" });
  bindAdd(input, addBtn, d);
  const add = el("div", { className: "chip-add" });
  add.append(input, addBtn);

  const chips = el("div", { className: "chips" });
  chips.setAttribute("aria-label", `‘${d.name}’ 덱의 키워드`);
  chips.append(...chipNodes(d));

  // 한꺼번에 편집: 입력 중엔 저장만, 다 고치면(change) 다시 그림
  const ta = el("textarea", { spellcheck: false, value: d.text, hidden: !bulkOpen.has(d.id), placeholder: "커피, 우주, 도서관\n줄바꿈이나 쉼표로 구분해서 적어요" });
  ta.dataset.fk = "bulk-" + d.id;
  ta.setAttribute("aria-label", `‘${d.name}’ 덱 키워드 한꺼번에 편집`);
  ta.addEventListener("input", () => { d.text = ta.value; saveDecks(); });
  ta.addEventListener("change", () => render());

  const bulk = button({ className: "linkbtn", textContent: bulkOpen.has(d.id) ? "편집 닫기" : "한꺼번에 편집" });
  bulk.dataset.fk = "bulkbtn-" + d.id;
  bulk.setAttribute("aria-expanded", String(bulkOpen.has(d.id)));
  bulk.onclick = () => { bulkOpen.has(d.id) ? bulkOpen.delete(d.id) : bulkOpen.add(d.id); render(); };

  const right = el("span", { className: "foot-right" });
  if (d.excluded.length) {
    const inc = button({ className: "linkbtn", textContent: "제외 모두 해제" });
    inc.onclick = () => { d.excluded = []; saveDecks(); render(); };
    right.append(inc);
  }
  // 비우기: 덱 키워드를 다 지우고, 이 덱에서 나온 쪽지도 지금 조합에서 뺌
  const clear = button({ className: "linkbtn", textContent: "비우기" });
  clear.onclick = () => {
    if (state.spinning) return;
    d.text = ""; d.excluded = []; saveDecks();
    removeSlips(c => c.from === d.id);
    render();
    listEl.querySelector(`[data-fk="add-${d.id}"]`)?.focus();
  };
  right.append(clear);

  const foot = el("div", { className: "pool-foot" });
  foot.append(bulk, right);
  body.append(add, chips, ta, foot);
  return body;
}

// 칩: 이름을 누르면 이번 뽑기에서 제외(줄 그어짐), ×는 덱에서 삭제(되돌리기 가능)
function chipNodes(d) {
  const words = deckWords(d);
  d.excluded = d.excluded.filter(w => words.includes(w));
  if (!words.length) return [el("span", { className: "chips-empty", textContent: "아직 키워드가 없어요." })];
  const hits = hitKeys();
  return words.map(w => {
    const off = d.excluded.includes(w), key = d.id + "\n" + w;
    const chip = el("span", { className: "chip" + (off ? " off" : "") + (hits.has(key) ? " hit" : "") });
    chip.dataset.key = key;
    const label = button({ className: "chip-label", title: off ? "뽑기에 다시 넣기" : "이번 뽑기에서 제외" });
    label.setAttribute("aria-pressed", String(!off));
    label.append(w);   // 사용자가 쓴 글은 textContent로
    label.onclick = () => { toggleExcluded(d, w); render(); };
    const x = button({ className: "chip-x", textContent: "×" }, `‘${w}’ 삭제`);
    x.onclick = () => {
      const undo = removeWord(d, w);
      render();
      toast(`‘${w}’를 뺐어요`, () => { undo(); render(); });
    };
    chip.append(label, x);
    return chip;
  });
}

// 키워드 입력: Enter·쉼표로 추가, 여러 개 붙여 넣으면 나눠서. 한글 조합 중 Enter는 무시
function bindAdd(input, addBtn, d) {
  const commit = () => {
    if (!input.value.trim()) return;
    const n = addWords(d, input.value);
    input.value = "";
    if (!n) toast("이미 덱에 있는 키워드예요");
    render();
  };
  input.addEventListener("keydown", e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") { e.preventDefault(); commit(); }
  });
  input.addEventListener("input", e => {
    if (e.isComposing) return;
    const m = input.value.match(/^([\s\S]*)[,;，、]([^,;，、]*)$/);
    if (m) { addWords(d, m[1]); input.value = m[2]; render(); }
  });
  input.addEventListener("paste", e => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!/[,\n;，、]/.test(text)) return;
    e.preventDefault();
    const n = addWords(d, input.value + "," + text);
    input.value = ""; render(); toast(`${n}개를 넣었어요`);
  });
  addBtn.onclick = () => { commit(); input.focus(); };
}

// + 새 덱: 바로 만들어 켜고 키워드 입력칸에 초점
$("deck-add").onclick = () => {
  const d = newDeck();
  render();
  listEl.querySelector(`[data-fk="add-${d.id}"]`)?.focus();
};
