// 화면 전체를 상태에 맞춰 다시 그림. 상태를 바꾼 곳은 이것 하나만 부르면 됨
import { state } from "./state.js";
import { renderDecks } from "./view-decks.js";
import { renderControls, buildSlips, renderCombo } from "./view-stage.js";
import { renderHistory } from "./view-history.js";
import { syncUrl } from "./share.js";

// 마우스·손가락을 누르고 있는 동안엔 다시 그리기를 미뤘다가 클릭이 끝난 뒤에 그림.
// 입력 칸(덱 이름·한꺼번에 편집)은 칸 밖을 누르는 순간 change가 일어나는데, 그때 다시 그리면
// 누르던 버튼이 새로 바뀌거나 위치가 밀려서 클릭이 사라졌음
let pressing = false, pending = null;
document.addEventListener("pointerdown", () => { pressing = true; }, true);
const release = () => {
  pressing = false;
  // click은 pointerup 바로 뒤에 오므로, 그 다음 차례에 그림
  if (pending) setTimeout(() => { const p = pending; pending = null; if (p) draw(p); }, 0);
};
document.addEventListener("pointerup", release, true);
document.addEventListener("pointercancel", release, true);

// landed: 방금 뽑혀 착지 효과를 줄 쪽지 번호 (뽑기가 끝날 때만)
export function render({ landed } = {}) {
  if (pressing) { pending = { landed: landed ?? pending?.landed }; return; }
  pending = null;
  draw({ landed });
}

function draw({ landed }) {
  renderDecks();
  renderControls();
  // 셔플 중엔 쪽지를 다시 그리지 않음. 다시 그리면 결과가 미리 보임 (끝날 때 뽑기가 그림)
  if (!state.spinning) buildSlips(landed);
  renderCombo();
  renderHistory();
  syncUrl();
}
