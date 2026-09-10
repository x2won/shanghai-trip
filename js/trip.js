// 여행 데이터 — 원본 파일 + 교사가 수정한 내용
const Trip = {
  data: null,      // 실제로 화면에 쓰는 데이터
  original: null,  // data/trip.json 원본 (되돌리기용)
  edited: false,

  async load() {
    try {
      const res = await fetch("data/trip.json", { cache: "no-cache" });
      Trip.original = await res.json();
      localStorage.setItem("tripBase", JSON.stringify(Trip.original));
    } catch {
      const cached = localStorage.getItem("tripBase");
      if (cached) Trip.original = JSON.parse(cached);
    }

    const mine = localStorage.getItem("tripEdited");
    if (mine) {
      try { Trip.data = JSON.parse(mine); Trip.edited = true; }
      catch { Trip.data = Trip.original; }
    } else {
      Trip.data = Trip.original;
    }
    return Trip.data;
  },

  save() {
    localStorage.setItem("tripEdited", JSON.stringify(Trip.data));
    Trip.edited = true;
  },

  reset() {
    localStorage.removeItem("tripEdited");
    Trip.data = JSON.parse(JSON.stringify(Trip.original));
    Trip.edited = false;
  },

  export() { return JSON.stringify(Trip.data, null, 2); },

  import(text) {
    const parsed = JSON.parse(text);
    if (!parsed.places || !parsed.schedule) throw new Error("places와 schedule이 있어야 합니다");
    Trip.data = parsed;
    Trip.save();
  },

  place(id) { return Trip.data?.places.find((p) => p.id === id) || null; },

  days() { return [...new Set(Trip.data.schedule.map((s) => s.day))].sort((a, b) => a - b); },

  slotsOf(day) {
    return Trip.data.schedule
      .filter((s) => s.day === day)
      .sort((a, b) => a.time.localeCompare(b.time));
  },

  currentIndex(slots, now = new Date()) {
    const mins = now.getHours() * 60 + now.getMinutes();
    let idx = -1;
    slots.forEach((s, i) => {
      const [h, m] = s.time.split(":").map(Number);
      if (h * 60 + m <= mins) idx = i;
    });
    return idx;
  },

  // 오늘 일정 중 아직 오지 않은 가장 가까운 항목
  nextSlot(now = new Date()) {
    const mins = now.getHours() * 60 + now.getMinutes();
    let best = null;
    Trip.data.schedule.forEach((s) => {
      const [h, m] = s.time.split(":").map(Number);
      const t = h * 60 + m;
      if (t > mins && (!best || t < best.mins)) best = { ...s, mins: t };
    });
    return best;
  },
};
