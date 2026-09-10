// 교사·관리자용 편집 화면
const Editor = {
  onChange: null, // 저장 후 화면 갱신 콜백

  _set(path, value) {
    const parts = path.split(".");
    let obj = Trip.data;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    Trip.save();
    Editor.onChange?.();
  },

  // 입력칸 하나 만들기
  _field(path, value, { type = "text", ph = "", cls = "" } = {}) {
    return `<input class="${cls}" type="${type}" data-path="${path}" value="${String(value ?? "").replace(/"/g, "&quot;")}" placeholder="${ph}">`;
  },

  bind(root) {
    root.querySelectorAll("[data-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const v = input.type === "number" ? parseFloat(input.value) : input.value;
        Editor._set(input.dataset.path, v);
      });
    });
  },

  // ── 일정 편집 ─────────────────────────────────
  schedule(root) {
    const places = Trip.data.places;
    const rows = Trip.data.schedule.map((s, i) => `
      <div class="ed-row">
        <div class="ed-line">
          ${Editor._field(`schedule.${i}.day`, s.day, { type: "number", cls: "w-day" })}
          ${Editor._field(`schedule.${i}.time`, s.time, { type: "time", cls: "w-time" })}
          <button class="ed-del" data-del-slot="${i}">삭제</button>
        </div>
        ${Editor._field(`schedule.${i}.title`, s.title, { ph: "일정 이름" })}
        <select data-path="schedule.${i}.placeId">
          <option value="">장소 연결 안 함</option>
          ${places.map((p) => `<option value="${p.id}" ${p.id === s.placeId ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
        ${Editor._field(`schedule.${i}.note`, s.note, { ph: "메모 (선택)" })}
      </div>`).join("");

    root.innerHTML = rows + `<button class="btn ghost sm" id="ed-add-slot">일정 추가</button>`;
    Editor.bind(root);

    root.querySelectorAll("[data-del-slot]").forEach((b) =>
      b.addEventListener("click", () => {
        Trip.data.schedule.splice(+b.dataset.delSlot, 1);
        Trip.save(); Editor.schedule(root); Editor.onChange?.();
      }));

    root.querySelector("#ed-add-slot").addEventListener("click", () => {
      Trip.data.schedule.push({ day: Trip.days()[0] || 1, time: "09:00", title: "새 일정", placeId: null, note: "" });
      Trip.save(); Editor.schedule(root); Editor.onChange?.();
    });
  },

  // ── 연락처 편집 ───────────────────────────────
  contacts(root) {
    root.innerHTML = Trip.data.contacts.map((c, i) => `
      <div class="ed-row">
        <div class="ed-line">
          ${Editor._field(`contacts.${i}.label`, c.label, { ph: "구분" })}
          <button class="ed-del" data-del-contact="${i}">삭제</button>
        </div>
        ${Editor._field(`contacts.${i}.name`, c.name, { ph: "이름 (선택)" })}
        ${Editor._field(`contacts.${i}.phone`, c.phone, { type: "tel", ph: "전화번호" })}
      </div>`).join("") + `<button class="btn ghost sm" id="ed-add-contact">연락처 추가</button>`;

    Editor.bind(root);

    root.querySelectorAll("[data-del-contact]").forEach((b) =>
      b.addEventListener("click", () => {
        Trip.data.contacts.splice(+b.dataset.delContact, 1);
        Trip.save(); Editor.contacts(root); Editor.onChange?.();
      }));

    root.querySelector("#ed-add-contact").addEventListener("click", () => {
      Trip.data.contacts.push({ label: "새 연락처", name: "", phone: "" });
      Trip.save(); Editor.contacts(root); Editor.onChange?.();
    });
  },

  // ── 장소 편집 (관리자) ────────────────────────
  places(root, getCoords) {
    root.innerHTML = Trip.data.places.map((p, i) => `
      <div class="ed-row">
        <div class="ed-line">
          ${Editor._field(`places.${i}.name`, p.name, { ph: "장소 이름" })}
          <button class="ed-del" data-del-place="${i}">삭제</button>
        </div>
        ${Editor._field(`places.${i}.nameZh`, p.nameZh, { ph: "중국어 이름" })}
        ${Editor._field(`places.${i}.addressZh`, p.addressZh, { ph: "중국어 주소" })}
        <div class="ed-line">
          ${Editor._field(`places.${i}.lat`, p.lat, { type: "number", cls: "w-half" })}
          ${Editor._field(`places.${i}.lng`, p.lng, { type: "number", cls: "w-half" })}
        </div>
        <button class="btn ghost sm" data-here="${i}">지금 내 위치로 좌표 채우기</button>
        ${Editor._field(`places.${i}.note`, p.note, { ph: "주의사항 (선택)" })}
      </div>`).join("") + `<button class="btn ghost sm" id="ed-add-place">장소 추가</button>`;

    Editor.bind(root);

    root.querySelectorAll("[data-here]").forEach((b) =>
      b.addEventListener("click", () => {
        const c = getCoords();
        if (!c) return alert("아직 위치를 확인하지 못했습니다.");
        const i = +b.dataset.here;
        Trip.data.places[i].lat = +c.latitude.toFixed(6);
        Trip.data.places[i].lng = +c.longitude.toFixed(6);
        Trip.save(); Editor.places(root, getCoords); Editor.onChange?.();
      }));

    root.querySelectorAll("[data-del-place]").forEach((b) =>
      b.addEventListener("click", () => {
        Trip.data.places.splice(+b.dataset.delPlace, 1);
        Trip.save(); Editor.places(root, getCoords); Editor.onChange?.();
      }));

    root.querySelector("#ed-add-place").addEventListener("click", () => {
      Trip.data.places.push({
        id: "place-" + Date.now().toString(36),
        name: "새 장소", nameZh: "", addressZh: "", lat: 31.2304, lng: 121.4737, note: "",
      });
      Trip.save(); Editor.places(root, getCoords); Editor.onChange?.();
    });
  },

  // ── 인쇄용 계획표 ─────────────────────────────
  print() {
    const d = Trip.data;
    const rows = Trip.days().map((day) => `
      <h3>${day}일차</h3>
      <table>
        <tr><th>시각</th><th>일정</th><th>장소 (중국어)</th><th>메모</th></tr>
        ${Trip.slotsOf(day).map((s) => {
          const p = s.placeId ? Trip.place(s.placeId) : null;
          return `<tr><td>${s.time}</td><td>${s.title}</td>
            <td>${p ? `${p.name}<br><span class="zh">${p.nameZh}</span>` : "-"}</td>
            <td>${s.note || ""}</td></tr>`;
        }).join("")}
      </table>`).join("");

    const contacts = d.contacts.map((c) =>
      `<tr><td>${c.label}</td><td>${c.name || ""}</td><td>${c.phone || ""}</td></tr>`).join("");

    document.getElementById("print-area").innerHTML = `
      <h1>${d.title}</h1>
      <p class="sub">${d.subtitle}</p>
      ${rows}
      <h3>연락처</h3>
      <table><tr><th>구분</th><th>이름</th><th>전화</th></tr>${contacts}</table>
      <h3>중국 긴급번호</h3>
      <p>${d.emergency.map((e) => `${e.label} ${e.phone}`).join(" · ")}</p>`;

    window.print();
  },
};
