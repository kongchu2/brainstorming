// 뽑기. 켠 덱마다 정한 장 수만큼, 모든 키워드는 같은 확률
import { state } from "./state.js";
import { $, rand, pickOne, reduced, toast } from "./util.js";
import { getDeck, usable, drawDecks, want } from "./decks.js";
import { newEntry, switchEntry } from "./entry.js";
import { buildSlips, newQuestion } from "./view-stage.js";
import { refreshHits } from "./view-decks.js";
import { render } from "./render.js";

const SPIN_MS = 520, STAGGER_MS = 140, FRAME_MS = 55;
const comboKey = words => words.filter(Boolean).sort().join("\n");   // 순서 무관
let hitTimer;

// 뽑을 칸을 만듦. targets 없이 부르면 전체 뽑기: 고정한 쪽지는 남기고 나머지 칸을 비움
function plan(targets) {
  if (targets) {
    const slots = state.current.map(c => ({ ...c }));
    return { slots, targets: targets.filter(i => usable(getDeck(slots[i]?.from)).length) };
  }
  const slots = [];
  for (const d of drawDecks()) {
    const pw = usable(d);
    const locked = state.current.filter(c => c.locked && c.from === d.id && pw.includes(c.word)).slice(0, want(d));
    slots.push(...locked, ...Array.from({ length: want(d) - locked.length }, () => ({ word: "", from: d.id, locked: false })));
  }
  return { slots, targets: slots.map((c, i) => c.word ? -1 : i).filter(i => i >= 0) };
}

// targets 칸을 무작위로 채운 새 쪽지 목록. 한 조합 안에서는 같은 키워드가 두 번 안 나옴.
// '이것만 다시'는 그 칸에 있던 단어를 피함(다른 후보가 없으면 허용). 전체 뽑기는 빈 칸이라 해당 없음
function fill(slots, targets) {
  const out = slots.map(c => ({ ...c }));
  const taken = new Set(out.filter((_, i) => !targets.includes(i)).map(c => c.word));
  for (const i of targets) {
    const { from, word: prev } = out[i];
    const pw = usable(getDeck(from)).filter(w => !taken.has(w));
    const others = pw.filter(w => w !== prev);
    const w = pickOne(others.length ? others : pw) ?? prev;
    out[i] = { word: w, from, locked: false };
    if (w) taken.add(w);
  }
  return out;
}

// targets: 다시 뽑을 칸 번호 ('이것만 다시'). 없으면 전체 뽑기.
// sample: 처음 방문·초기화 때의 예시 뽑기 (메모·★ 없이 다음으로 넘어가면 기록에 안 남김)
export function draw(targets, sample = false) {
  if (state.spinning) return;
  const p = plan(targets);
  if (!p.slots.length || (targets && !p.targets.length)) return;

  // 이미 나온 조합 제외: 기록·지금 조합과 키워드 묶음이 같으면 최대 100번 다시 뽑음
  let next = fill(p.slots, p.targets), exhausted = false;
  if (state.skipSeen) {
    const seen = new Set([...state.history, ...(state.entry ? [state.entry] : [])].map(h => comboKey(h.words)));
    for (let i = 0; i < 100 && seen.has(comboKey(next.map(c => c.word))); i++) next = fill(p.slots, p.targets);
    exhausted = seen.has(comboKey(next.map(c => c.word)));
  }
  // 뽑을 키워드가 없어 빈 칸은 빼고, 다시 뽑는 칸 번호도 빠진 칸만큼 당김
  const kept = next.map((c, i) => c.word ? i : -1).filter(i => i >= 0);
  const landed = p.targets.map(i => kept.indexOf(i)).filter(i => i >= 0);
  next = next.filter(c => c.word);

  const finish = () => {
    state.current = next; state.spinning = false;
    switchEntry(newEntry({ sample }));   // 이전 조합은 기록으로
    newQuestion();
    render({ landed });
    // 덱 칩 하이라이트는 착지 애니메이션이 끝난 뒤에 (시간은 CSS에서 읽음)
    if (state.spinSlots.length) {
      const s = $("slips").querySelector(".slip.landed");
      const ms = s && !reduced() ? parseFloat(getComputedStyle(s).animationDuration) * 1000 || 0 : 0;
      hitTimer = setTimeout(() => { state.spinSlots = []; refreshHits(); }, ms);
    }
    if (exhausted) toast("아직 안 나온 조합을 찾지 못해 이미 나온 조합을 보여줘요");
  };

  clearTimeout(hitTimer);   // 앞선 뽑기의 하이라이트 대기를 정리
  state.spinSlots = landed.map(i => next[i].from + "\n" + next[i].word);
  if (reduced()) return finish();

  // 짧은 셔플 연출: 칸마다 시간차를 두고 멈춤. 셔플 중엔 render()가 쪽지를 다시 그리지 않음
  state.current = next.map(c => ({ ...c }));
  buildSlips();
  state.spinning = true;
  render();
  const els = [...$("slips").children];
  landed.forEach(i => els[i]?.classList.add("spinning"));
  const start = performance.now();
  const tick = now => {
    if (reduced()) return finish();   // 뽑는 도중 애니메이션 최소화를 켜면 바로 멈춤
    let alive = false;
    landed.forEach((i, k) => {
      if (now - start >= SPIN_MS + k * STAGGER_MS) return;
      alive = true;
      const pw = usable(getDeck(next[i].from));
      if (pw.length) els[i].querySelector(".word").textContent = pw[rand(pw.length)];
    });
    alive ? setTimeout(() => requestAnimationFrame(tick), FRAME_MS) : finish();
  };
  requestAnimationFrame(tick);
}
