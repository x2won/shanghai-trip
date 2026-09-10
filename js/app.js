const el = (id) => document.getElementById(id);
const store = {
  get: (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const RING_C = 540.35;
const ICON = {
  pin: `<svg viewBox="0 0 24 24"><path d="M12 21.5s7-6.6 7-11.4a7 7 0 1 0-14 0c0 4.8 7 11.4 7 11.4Z"/><circle cx="12" cy="10" r="2.6"/></svg>`,
  chev: `<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`,
};

let coords = null, isDemo = false, heading = null;
let rally = null, lastLevel = null, activeDay = 1;
const notifiedSlots = new Set();

const meInfo = () => store.get("me");

// ══ 온보딩 ═════════════════════════════════════
function showOnboard() {
  el("onboard").classList.remove("hidden");
  el("ob-save").addEventListener("click", () => {
    const name = el("ob-name").value.trim();
    if (!name) return el("ob-name").focus();
    store.set("me", { grade: el("ob-grade").value.trim(), cls: el("ob-class").value.trim(), name });
    el("onboard").classList.add("hidden");
  });

  el("ob-staff").addEventListener("click", () => {
    el("ob-code-box").classList.toggle("hidden");
    el("ob-code").focus();
  });

  el("ob-code-ok").addEventListener("click", () => {
    const role = Auth.login(el("ob-code").value);
    if (!role) { el("ob-code").value = ""; return showBanner("코드가 맞지 않습니다."); }
    if (!meInfo()) store.set("me", { grade: "", cls: "", name: el("ob-name").value.trim() || Auth.label() });
    el("onboard").classList.add("hidden");
    applyRole();
    showTab("teacher");
    showBanner(`${Auth.label()} 모드로 들어왔습니다.`);
  });
}

// ══ 역할 적용 ══════════════════════════════════
function applyRole() {
  const staff = Auth.isStaff();
  el("role-pill").textContent = Auth.label();
  el("role-pill").classList.toggle("hidden", !staff);
  document.querySelector('.tab[data-tab="teacher"]').classList.toggle("hidden", !staff);
  el("mode-btn").classList.toggle("on", staff);
  el("card-places").classList.toggle("hidden", !Auth.can("editPlaces"));
  el("card-data").classList.toggle("hidden", !Auth.can("manageData"));
  el("edit-flag").textContent = Trip.edited ? "수정됨" : "원본";
  if (staff) buildEditors();
}

el("mode-btn").addEventListener("click", () => {
  if (!Auth.isStaff()) {
    const role = Auth.login(prompt("교사 코드를 입력하세요"));
    if (!role) return showBanner("코드가 맞지 않습니다.");
    applyRole(); showTab("teacher");
    return showBanner(`${Auth.label()} 모드로 들어왔습니다.`);
  }
  showTab("teacher");
});

el("logout-btn").addEventListener("click", () => {
  Auth.logout(); applyRole(); showTab("rally");
  showBanner("학생 모드로 돌아왔습니다.");
});

// ══ 탭 · 세그먼트 ══════════════════════════════
function showTab(name) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (name === "rally") setTimeout(() => MapView.resize(), 60);
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

el("t-seg").querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => {
    el("t-seg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll("[data-seg-panel]").forEach((p) =>
      p.classList.toggle("hidden", p.dataset.segPanel !== b.dataset.seg));
  }));

// ══ 배너 ═══════════════════════════════════════
function showBanner(text, actionLabel, onAction) {
  el("banner-text").textContent = text;
  const btn = el("banner-action");
  btn.textContent = actionLabel || "";
  btn.classList.toggle("hidden", !actionLabel);
  btn.onclick = () => { onAction?.(); hideBanner(); };
  el("banner").classList.remove("hidden");
}
const hideBanner = () => el("banner").classList.add("hidden");
el("banner-close").addEventListener("click", hideBanner);

// ══ 위치 ═══════════════════════════════════════
function startGps() {
  if (!("geolocation" in navigator)) return useDemo("이 브라우저는 위치 기능을 지원하지 않습니다");
  navigator.geolocation.watchPosition(
    (pos) => {
      coords = pos.coords; isDemo = false;
      el("gps-note").textContent = "";
      el("map-note").classList.add("hidden");
      MapView.setMe(coords);
    },
    () => useDemo("위치 권한이 없어 데모 위치로 표시합니다"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function useDemo(reason) {
  if (isDemo) return;
  isDemo = true;
  const base = rally || { lat: 31.227, lng: 121.492 };
  coords = { latitude: base.lat - 0.006, longitude: base.lng - 0.0055, accuracy: 40 };
  el("gps-note").textContent = `${reason} · 실제 휴대폰에서는 GPS로 자동 표시됩니다`;
  el("map-note").textContent = "데모 위치입니다";
  el("map-note").classList.remove("hidden");
  MapView.setMe(coords);
}

function onOrientation(e) {
  if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === "number") heading = 360 - e.alpha;
}
window.addEventListener("deviceorientationabsolute", onOrientation, true);
window.addEventListener("deviceorientation", onOrientation, true);

// ══ 집결 ═══════════════════════════════════════
function setRally(next) {
  rally = next;
  Rally.save(next);
  lastLevel = null;
  el("rally-name").textContent = next.name;
  el("rally-at").textContent = Rally.formatTime(next.at);
  MapView.setTarget(next);
}

const RING_COLOR = {
  ok: "var(--ok)", soon: "var(--warn)", go: "var(--go)",
  late: "var(--danger)", arrived: "var(--ok)", unknown: "var(--line)",
};

function tick() {
  checkScheduleAlarm();
  if (!rally) return;
  const s = Rally.status(rally, coords);

  el("countdown").textContent = Rally.formatCountdown(s.msLeft);
  el("cd-label").textContent = s.msLeft < 0 ? "지난 시간" : "남은 시간";
  el("status").textContent = s.label;
  el("status").className = "status " + s.level;

  const ring = el("ring");
  ring.style.strokeDashoffset = RING_C * (1 - Rally.progress(rally));
  ring.style.stroke = RING_COLOR[s.level] || "var(--brand)";

  if (s.meters === undefined) return;

  el("distance").textContent = Geo.formatDistance(s.meters);
  el("walk").textContent = `도보 약 ${Math.max(1, Math.round(s.walkMin))}분`;
  el("compass").textContent = Geo.compass(s.bearing) + "쪽 방향";
  el("arrow").style.transform = `rotate(${heading === null ? s.bearing : s.bearing - heading}deg)`;

  const showDepart = s.level === "ok" || s.level === "soon";
  el("depart").classList.toggle("hidden", !showDepart);
  if (showDepart) el("depart").textContent = `${Rally.formatTime(s.departAt)}에 출발하면 정시 도착`;

  if (s.level !== lastLevel) {
    if (s.level === "soon") notify("곧 출발하세요", `${rally.name}까지 ${Geo.formatDistance(s.meters)}. ${Rally.formatTime(s.departAt)}에 출발하세요.`);
    if (s.level === "go") notify("지금 출발하세요", `${rally.name}까지 도보 약 ${Math.round(s.walkMin)}분입니다.`);
    if (s.level === "late") notify("집결 시간이 지났습니다", "선생님께 연락하고 집결지로 이동하세요.");
    lastLevel = s.level;
  }
}

// 다음 일정 10분 전 알림
function checkScheduleAlarm() {
  const next = Trip.nextSlot();
  if (!next) return;
  const now = new Date();
  const left = next.mins - (now.getHours() * 60 + now.getMinutes());
  const key = `${next.day}-${next.time}-${now.toDateString()}`;
  if (left <= 10 && left >= 0 && !notifiedSlots.has(key)) {
    notifiedSlots.add(key);
    notify(`${left}분 뒤 · ${next.title}`, next.note || `${next.time} 일정입니다.`);
  }
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, tag: title, renotify: true });
}

async function askNotify() {
  if (!("Notification" in window)) return showBanner("이 브라우저는 알림을 지원하지 않습니다.");
  const r = await Notification.requestPermission();
  if (r === "granted") notify("알림이 켜졌습니다", "출발 시각과 일정을 미리 알려드립니다.");
}

el("locate-btn").addEventListener("click", () => MapView.recenter());

// ══ 링크 공유 ══════════════════════════════════
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showBanner(`${label}가 복사되었습니다. 위챗 단체방에 붙여넣으세요.`);
  } catch {
    prompt(`${label}를 길게 눌러 복사하세요`, text);
  }
}

function shareMyLocation() {
  if (!coords) return showBanner("아직 위치를 확인하지 못했습니다. 잠시 후 다시 시도하세요.");
  const m = meInfo();
  const who = m ? `${m.grade || ""} ${m.cls || ""} ${m.name}`.trim() : "학생";
  copyText(Rally.encodeMyLocation(coords, who), "내 위치 링크");
}
el("share-btn").addEventListener("click", shareMyLocation);
el("sos-share").addEventListener("click", shareMyLocation);
el("sos-card").addEventListener("click", () => openSheet(sheetPhrase(Trip.data.phrases[0])));

// 링크로 들어온 내용 처리
function handleIncomingLink() {
  const hash = location.hash;

  const n = hash.match(/#n=(.+)/);
  if (n) {
    history.replaceState(null, "", location.pathname);
    const raw = decodeURIComponent(n[1]);
    const at = +raw.slice(0, raw.indexOf("|"));
    const text = raw.slice(raw.indexOf("|") + 1);
    showNotice({ text, at: at || Date.now() });
    notify("선생님 공지", text);
    return;
  }

  const m = hash.match(/#me=(.+)/);
  if (m && MapView.provider === "leaflet") {
    const [lat, lng, ts, ...rest] = decodeURIComponent(m[1]).split(",");
    history.replaceState(null, "", location.pathname);
    const who = rest.join(",") || "학생";
    L.marker([+lat, +lng], {
      icon: L.divIcon({ className: "", iconSize: [34, 44], iconAnchor: [17, 42],
        html: `<div class="m-pin" style="background:linear-gradient(135deg,#9775fa,#7048e8)"><span></span></div>
               <div class="m-label">${who} · ${Rally.formatTime(+ts)}</div>` }),
    }).addTo(MapView.map);
    MapView.follow = false;
    MapView.map.setView([+lat, +lng], 16);
    showTab("rally");
    showBanner(`${who} 님이 보낸 위치를 지도에 표시했습니다.`);
  }
}

function showNotice(n) {
  store.set("notice", n);
  el("notice-text").textContent = n.text;
  el("notice-time").textContent = Rally.formatTime(n.at);
  el("notice-card").classList.remove("hidden");
}

// ══ 바텀 시트 ══════════════════════════════════
function openSheet(html) {
  el("sheet-body").innerHTML = html;
  el("sheet").classList.remove("hidden");
}
const closeSheet = () => el("sheet").classList.add("hidden");
el("sheet-close").addEventListener("click", closeSheet);
document.querySelector(".sheet-back").addEventListener("click", closeSheet);

const sheetPlace = (p) => `
  <div class="sheet-zh">${p.nameZh}</div>
  <div class="sheet-ko">${p.name}</div>
  <div class="sheet-addr">${p.addressZh}</div>
  ${p.note ? `<p class="sheet-note">${p.note}</p>` : ""}`;

const sheetPhrase = (p) => `<div class="sheet-zh">${p.zh}</div><div class="sheet-ko">${p.ko}</div>`;

// ══ 일정 ═══════════════════════════════════════
function renderSchedule() {
  const days = Trip.days();
  if (!days.includes(activeDay)) activeDay = days[0] || 1;

  el("daybar").innerHTML = days
    .map((d) => `<button data-day="${d}" class="${d === activeDay ? "on" : ""}">${d}일차</button>`).join("");
  el("daybar").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { activeDay = +b.dataset.day; renderSchedule(); }));

  const slots = Trip.slotsOf(activeDay);
  const nowIdx = Trip.currentIndex(slots);

  el("timeline").innerHTML = slots.map((s, i) => {
    const p = s.placeId ? Trip.place(s.placeId) : null;
    const cls = i === nowIdx ? "now" : i < nowIdx ? "done" : "";
    return `<div class="slot ${cls}">
      <div class="dot"></div>
      <div class="slot-body">
        <div class="time">${s.time}</div>
        <div>
          <strong>${s.title}${i === nowIdx ? `<span class="now-tag">지금</span>` : ""}</strong>
          ${p ? `<div class="zh">${p.nameZh}</div>` : ""}
          ${s.note ? `<div class="sub">${s.note}</div>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  el("schedule-notice").textContent = Trip.data.notice || "";
}

// ══ 장소 ═══════════════════════════════════════
function renderPlaces() {
  el("place-list").innerHTML = Trip.data.places.map((p) => {
    const d = coords ? Geo.formatDistance(Geo.distance(coords.latitude, coords.longitude, p.lat, p.lng)) : "—";
    return `<div class="place" data-place="${p.id}">
      <div class="place-ic">${ICON.pin}</div>
      <div class="body"><strong>${p.name}</strong><div class="zh">${p.nameZh}</div></div>
      <div class="dist">${d}</div>
    </div>`;
  }).join("");

  el("place-list").querySelectorAll(".place").forEach((n) =>
    n.addEventListener("click", () => openSheet(sheetPlace(Trip.place(n.dataset.place)))));
}

// ══ 비상 ═══════════════════════════════════════
function renderHelp() {
  el("contact-list").innerHTML = Trip.data.contacts.map((c) => `
    <div class="row">
      <div class="k">${c.label}${c.name ? `<span>${c.name}</span>` : ""}</div>
      ${c.phone ? `<a href="tel:${c.phone}">${c.phone}</a>` : `<span class="empty">번호 미입력</span>`}
    </div>`).join("");

  el("emergency-list").innerHTML = Trip.data.emergency.map((e) => `
    <div class="row"><div class="k">${e.label}</div><a href="tel:${e.phone}">${e.phone}</a></div>`).join("");

  el("phrase-list").innerHTML = Trip.data.phrases.map((p, i) => `
    <div class="phrase" data-phrase="${i}">
      <div class="t"><div class="ko">${p.ko}</div><div class="zh">${p.zh}</div></div>
      <div class="go-ic">${ICON.chev}</div>
    </div>`).join("");

  el("phrase-list").querySelectorAll(".phrase").forEach((n) =>
    n.addEventListener("click", () => openSheet(sheetPhrase(Trip.data.phrases[+n.dataset.phrase]))));
}

// ══ 교사: 집결 · 공지 ══════════════════════════
function fillTeacher() {
  el("t-place").innerHTML = `<option value="here">지금 내 위치</option>` +
    Trip.data.places.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");

  el("t-quick").innerHTML = [15, 30, 60, 90].map((m) => `<button data-min="${m}">${m}분 뒤</button>`).join("");
  el("t-quick").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      const t = new Date(Date.now() + +b.dataset.min * 60000);
      el("t-time").value = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    }));

  const presets = ["도착했습니다", "10분 뒤 출발합니다", "집합 시간이 바뀌었습니다", "점심 시간입니다", "인원 확인합니다"];
  el("n-quick").innerHTML = presets.map((p) => `<button>${p}</button>`).join("");
  el("n-quick").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { el("n-text").value = b.textContent; }));
}

el("t-make").addEventListener("click", () => {
  const time = el("t-time").value;
  if (!time) return showBanner("집결 시각을 입력하세요.");

  const pick = el("t-place").value;
  let lat, lng, defaultName;
  if (pick === "here") {
    if (!coords) return showBanner("아직 위치를 확인하지 못했습니다.");
    lat = coords.latitude; lng = coords.longitude; defaultName = "집결 장소";
  } else {
    const p = Trip.place(pick);
    lat = p.lat; lng = p.lng; defaultName = p.name;
  }

  const [h, m] = time.split(":").map(Number);
  const at = new Date();
  at.setHours(h, m, 0, 0);
  if (at.getTime() < Date.now()) at.setDate(at.getDate() + 1);

  setRally({ name: el("t-name").value.trim() || defaultName, lat, lng, at: at.getTime(), from: Date.now() });
  el("t-link").value = Rally.encodeLink(rally);
  el("t-result").classList.remove("hidden");
});

el("t-copy").addEventListener("click", () => el("t-link").value && copyText(el("t-link").value, "집결 링크"));

el("n-make").addEventListener("click", () => {
  const text = el("n-text").value.trim();
  if (!text) return showBanner("공지 내용을 입력하세요.");
  const payload = encodeURIComponent(`${Date.now()}|${text}`);
  el("n-link").value = `${location.origin}${location.pathname}#n=${payload}`;
  el("n-result").classList.remove("hidden");
  showNotice({ text, at: Date.now() });
});

el("n-copy").addEventListener("click", () => el("n-link").value && copyText(el("n-link").value, "공지 링크"));

// ══ 교사: 인원 점검 ════════════════════════════
function renderRoster() {
  const list = store.get("roster", []);
  el("roster").innerHTML = list.map((r, i) => `
    <div class="roster-item ${r.on ? "on" : ""}" data-i="${i}">
      <div class="dot2">${ICON.check}</div>
      <span class="nm">${r.name}</span>
      <button class="del" data-del="${i}">삭제</button>
    </div>`).join("") || `<p class="small" style="margin:8px 0 0">아직 명단이 없습니다.</p>`;

  el("roster-count").textContent = `${list.filter((r) => r.on).length} / ${list.length}`;

  el("roster").querySelectorAll(".roster-item").forEach((n) =>
    n.addEventListener("click", (e) => {
      if (e.target.dataset.del !== undefined) return;
      const l = store.get("roster", []);
      l[+n.dataset.i].on = !l[+n.dataset.i].on;
      store.set("roster", l); renderRoster();
    }));

  el("roster").querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const l = store.get("roster", []);
      l.splice(+b.dataset.del, 1);
      store.set("roster", l); renderRoster();
    }));
}

el("r-add").addEventListener("click", () => {
  const name = el("r-name").value.trim();
  if (!name) return;
  const l = store.get("roster", []);
  l.push({ name, on: false });
  store.set("roster", l);
  el("r-name").value = "";
  renderRoster();
});
el("r-name").addEventListener("keydown", (e) => { if (e.key === "Enter") el("r-add").click(); });

el("r-reset").addEventListener("click", () => {
  store.set("roster", store.get("roster", []).map((r) => ({ ...r, on: false })));
  renderRoster();
});

el("r-paste").addEventListener("click", () => {
  const text = prompt("이름을 줄바꿈이나 쉼표로 구분해 붙여넣으세요");
  if (!text) return;
  const names = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const l = store.get("roster", []);
  names.forEach((name) => l.push({ name, on: false }));
  store.set("roster", l);
  renderRoster();
  showBanner(`${names.length}명을 명단에 추가했습니다.`);
});

// ══ 편집 화면 ══════════════════════════════════
function buildEditors() {
  if (!Auth.isStaff()) return;
  Editor.onChange = () => {
    renderSchedule(); renderPlaces(); renderHelp(); fillTeacher();
    el("edit-flag").textContent = Trip.edited ? "수정됨" : "원본";
  };
  Editor.schedule(el("ed-schedule"));
  Editor.contacts(el("ed-contacts"));
  if (Auth.can("editPlaces")) Editor.places(el("ed-places"), () => coords);
}

el("print-btn").addEventListener("click", () => Editor.print());

el("d-export").addEventListener("click", () => {
  el("d-text").value = Trip.export();
  copyText(Trip.export(), "설정 데이터");
});

el("d-import").addEventListener("click", () => {
  const text = el("d-text").value.trim();
  if (!text) return showBanner("불러올 내용을 붙여넣으세요.");
  try {
    Trip.import(text);
    buildEditors(); Editor.onChange();
    showBanner("불러왔습니다.");
  } catch (e) {
    showBanner("형식이 올바르지 않습니다: " + e.message);
  }
});

el("d-reset").addEventListener("click", () => {
  if (!confirm("수정한 내용을 모두 버리고 원본으로 되돌릴까요?")) return;
  Trip.reset();
  buildEditors(); Editor.onChange();
  showBanner("원본으로 되돌렸습니다.");
});

// ══ 지도 미리받기 ══════════════════════════════
el("prefetch-btn").addEventListener("click", async () => {
  const btn = el("prefetch-btn");
  btn.disabled = true;
  el("prefetch-bar").classList.remove("hidden");
  try {
    const r = await MapView.prefetch(Trip.data.places, (done, total) => {
      el("prefetch-fill").style.width = `${(done / total) * 100}%`;
      el("prefetch-status").textContent = `받는 중… ${done} / ${total}`;
    });
    el("prefetch-status").textContent = r.failed
      ? `지도 ${r.total - r.failed}조각 저장 완료. ${r.failed}개는 실패했습니다. 다시 눌러 이어받을 수 있습니다.`
      : `완료. 지도 ${r.total}조각을 저장했습니다. 이제 인터넷이 없어도 지도가 보입니다.`;
    el("prefetch-badge").textContent = "완료";
  } catch (e) {
    el("prefetch-status").textContent = "받기 실패: " + e.message;
  }
  btn.disabled = false;
});

// ══ 시작 ═══════════════════════════════════════
(async function start() {
  await Trip.load();
  if (!Trip.data) {
    document.querySelector("main").innerHTML = `<p class="foot">여행 정보를 불러오지 못했습니다.</p>`;
    return;
  }

  Auth.load();
  if (!meInfo()) showOnboard();

  el("trip-title").textContent = Trip.data.title;
  el("trip-sub").textContent = Trip.data.subtitle;
  el("ob-title").textContent = Trip.data.title;

  MapView.onProviderChange = (msg) => showBanner(msg);
  await MapView.init();

  const loaded = Rally.load();
  if (loaded) setRally(loaded);
  else {
    const p = Trip.data.places[0];
    const at = new Date(); at.setMinutes(at.getMinutes() + 40, 0, 0);
    setRally({ name: p.name + " (예시)", lat: p.lat, lng: p.lng, at: at.getTime(), from: Date.now() });
  }

  const saved = store.get("notice");
  if (saved && Date.now() - saved.at < 12 * 3600 * 1000) showNotice(saved);

  renderSchedule(); renderPlaces(); renderHelp(); fillTeacher(); renderRoster();
  applyRole();

  startGps();
  setTimeout(() => { if (!coords) useDemo("위치를 확인하지 못해 데모 위치로 표시합니다"); }, 4000);
  handleIncomingLink();

  tick();
  setInterval(tick, 1000);
  setInterval(renderPlaces, 15000);

  if ("Notification" in window && Notification.permission === "default") {
    setTimeout(() => showBanner("출발 시각과 일정을 미리 알려드릴까요?", "알림 켜기", askNotify), 1200);
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
})();
