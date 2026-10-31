// 여러 곳에서 쓰는 작은 도구들. 다른 모듈을 가져오지 않음

export const $ = id => document.getElementById(id);

// localStorage. 키 앞에 "kwdraw:"가 붙고, 막혀 있어도 오류 없이 넘어감
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem("kwdraw:" + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("kwdraw:" + k, JSON.stringify(v)); } catch {} },
  remove(k) { try { localStorage.removeItem("kwdraw:" + k); } catch {} },
};
// 초기화해도 남기는 저장값. 이것 말고 아무것도 없으면 처음 방문
export const KEEP = new Set(["kwdraw:history", "kwdraw:theme", "kwdraw:motion"]);

// 다른 페이지 안에 끼워져 있으면(Artifact·미리보기) 주소 공유를 끔
export const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

// 애니메이션 최소화 여부는 <html data-motion>이 기준 (머리 스크립트·스위치가 정함)
export const reduced = () => document.documentElement.dataset.motion === "reduce";

export function rand(max) {
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max;
}
export const pickOne = list => list.length ? list[rand(list.length)] : undefined;
export const newId = () => Date.now().toString(36) + rand(1e6).toString(36);
export const stamp = () => {
  const t = new Date(), p = v => String(v).padStart(2, "0");
  return `${p(t.getMonth() + 1)}.${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
};

// 쉼표·줄바꿈 등으로 나눈 키워드 목록 (앞의 #·- 같은 글머리표는 뗌)
export const splitRaw = s => (s ?? "").split(/[,\n;，、]+/).map(raw => raw.trim().replace(/^[#\-*•·]+\s*/, "")).filter(Boolean);
// 대소문자만 다른 중복은 처음 것만 남김
export const uniq = list => {
  const seen = new Set();
  return list.filter(w => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
};

// 압정 아이콘 (쪽지 고정·기록 핀 고정이 같이 씀. 눌린 상태에선 CSS가 속을 채움)
export const ICON_PIN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
// 연필 아이콘 (기록 목록의 메모 남기기)
export const ICON_PENCIL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/></svg>';
// '이것만 다시' 순환 화살표 아이콘
export const ICON_REROLL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>';

// 알림. undo를 주면 '되돌리기' 버튼이 붙고 4초간 보임.
// 문구를 textContent로 넣은 뒤 버튼을 append하므로 순서를 바꾸지 말 것
let toastTimer;
export function toast(msg, undo) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  if (undo) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "되돌리기";
    b.onclick = () => { t.hidden = true; undo(); };
    t.append(b);
  }
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, undo ? 4000 : 1600);
}
