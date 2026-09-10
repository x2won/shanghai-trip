// 집결 로직: 링크 인코딩/디코딩, 출발 시각 역산
const Rally = {
  current: null, // { name, lat, lng, at(ms), from(ms) }

  save(rally) {
    Rally.current = rally;
    localStorage.setItem("rally", JSON.stringify(rally));
  },

  load() {
    const fromLink = Rally.decodeLink(location.hash);
    if (fromLink) {
      Rally.save(fromLink);
      history.replaceState(null, "", location.pathname);
      return fromLink;
    }
    const stored = localStorage.getItem("rally");
    if (stored) Rally.current = JSON.parse(stored);
    return Rally.current;
  },

  // #r=위도,경도,집결시각,장소명
  encodeLink(rally) {
    const payload = [rally.lat.toFixed(6), rally.lng.toFixed(6), rally.at, rally.name].join(",");
    return `${location.origin}${location.pathname}#r=${encodeURIComponent(payload)}`;
  },

  decodeLink(hash) {
    const m = hash.match(/#r=(.+)/);
    if (!m) return null;
    const [lat, lng, at, ...rest] = decodeURIComponent(m[1]).split(",");
    if (!lat || !lng || !at) return null;
    return { lat: +lat, lng: +lng, at: +at, name: rest.join(",") || "집결 장소", from: Date.now() };
  },

  encodeMyLocation(coords, who) {
    const payload = [coords.latitude.toFixed(6), coords.longitude.toFixed(6), Date.now(), who].join(",");
    return `${location.origin}${location.pathname}#me=${encodeURIComponent(payload)}`;
  },

  status(rally, coords, now = Date.now()) {
    const msLeft = rally.at - now;
    const minLeft = msLeft / 60000;

    if (!coords) return { level: "unknown", label: "위치 확인 중", minLeft, msLeft };

    const meters = Geo.distance(coords.latitude, coords.longitude, rally.lat, rally.lng);
    const walkMin = meters / CONFIG.WALK_SPEED;
    const slack = minLeft - walkMin - CONFIG.BUFFER_MIN; // 출발까지 남은 분

    let level, label;
    if (meters < CONFIG.ARRIVE_RADIUS && minLeft >= 0) {
      level = "arrived"; label = "집결지에 도착했습니다";
    } else if (minLeft < 0) {
      level = "late";
      label = meters < CONFIG.ARRIVE_RADIUS ? "도착했습니다" : "집결 시간이 지났습니다";
    } else if (slack <= 0) {
      level = "go"; label = "지금 출발하세요";
    } else if (slack <= 15) {
      level = "soon"; label = `${Math.ceil(slack)}분 뒤 출발하세요`;
    } else {
      level = "ok"; label = "여유 있습니다";
    }

    return {
      level, label, meters, walkMin, slack, minLeft, msLeft,
      bearing: Geo.bearing(coords.latitude, coords.longitude, rally.lat, rally.lng),
      departAt: rally.at - (walkMin + CONFIG.BUFFER_MIN) * 60000,
    };
  },

  // 남은 시간 비율 (링 게이지용)
  progress(rally, now = Date.now()) {
    const total = rally.at - (rally.from || rally.at - 3600000);
    if (total <= 0) return 0;
    return Math.max(0, Math.min(1, (rally.at - now) / total));
  },

  formatCountdown(ms) {
    const late = ms < 0;
    const t = Math.floor(Math.abs(ms) / 1000);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const body = h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
    return late ? `+${body}` : body;
  },

  formatTime(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
};
