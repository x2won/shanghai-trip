// 지도 — 바이두(키가 있을 때) 또는 일반 지도
const MapView = {
  STYLES: {
    osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    esri: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    voyager: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  },
  CACHE: "tiles-v2",
  ZOOMS: [13, 14, 15, 16],

  provider: "leaflet",
  map: null,
  layer: null,
  tileUrl: null,
  tileErrors: 0,
  me: null,
  target: null,
  line: null,
  accuracy: null,
  follow: true,
  onProviderChange: null,

  async init() {
    if (CONFIG.BAIDU_AK) {
      try {
        await MapView._initBaidu();
        MapView.provider = "baidu";
        return;
      } catch {
        /* 바이두 로드 실패 시 일반 지도로 넘어간다 */
      }
    }
    MapView._initLeaflet();
  },

  // ── 일반 지도 (Leaflet) ─────────────────────────────
  _initLeaflet() {
    MapView.provider = "leaflet";
    MapView.tileUrl = MapView.STYLES[CONFIG.STYLE] || MapView.STYLES.osm;

    MapView.map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
    }).setView([31.2304, 121.4737], 12);

    MapView.layer = L.tileLayer(MapView.tileUrl, { maxZoom: 19, crossOrigin: true }).addTo(MapView.map);

    // 지도 서버가 막혀 있으면 오픈스트리트맵으로 자동 전환
    MapView.layer.on("tileerror", () => {
      MapView.tileErrors++;
      if (MapView.tileErrors === 6 && MapView.tileUrl !== MapView.STYLES.osm) {
        MapView.tileUrl = MapView.STYLES.osm;
        MapView.layer.setUrl(MapView.tileUrl);
        MapView.onProviderChange?.("지도 서버 연결이 원활하지 않아 기본 지도로 전환했습니다");
      }
    });

    MapView.map.on("dragstart zoomstart", () => { MapView.follow = false; });
  },

  _meIcon() {
    return L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13], html: `<div class="m-me"></div>` });
  },

  _targetIcon(name) {
    return L.divIcon({
      className: "",
      iconSize: [34, 44],
      iconAnchor: [17, 42],
      html: `<div class="m-pin"><span></span></div><div class="m-label">${name}</div>`,
    });
  },

  // ── 바이두 지도 ─────────────────────────────────────
  _initBaidu() {
    return new Promise((resolve, reject) => {
      const cb = "__baiduReady";
      window[cb] = () => {
        const map = new BMapGL.Map("map");
        map.centerAndZoom(new BMapGL.Point(121.4737, 31.2304), 12);
        map.enableScrollWheelZoom(true);
        map.addEventListener("dragstart", () => { MapView.follow = false; });
        MapView.map = map;
        resolve();
      };
      const s = document.createElement("script");
      s.src = `https://api.map.baidu.com/api?v=1.0&type=webgl&ak=${CONFIG.BAIDU_AK}&callback=${cb}`;
      s.onerror = reject;
      setTimeout(() => reject(new Error("timeout")), 8000);
      document.head.appendChild(s);
    });
  },

  _bdPoint(lat, lng) {
    const p = Coords.wgsToBd(lat, lng);
    return new BMapGL.Point(p.lng, p.lat);
  },

  // ── 공통 API ────────────────────────────────────────
  setMe(coords) {
    if (!MapView.map) return;

    if (MapView.provider === "baidu") {
      const pt = MapView._bdPoint(coords.latitude, coords.longitude);
      if (!MapView.me) {
        MapView.me = new BMapGL.Circle(pt, 12, {
          strokeColor: "#ffffff", strokeWeight: 3, fillColor: "#2563eb", fillOpacity: 1,
        });
        MapView.map.addOverlay(MapView.me);
      } else {
        MapView.me.setCenter(pt);
      }
    } else {
      const pos = [coords.latitude, coords.longitude];
      if (!MapView.me) MapView.me = L.marker(pos, { icon: MapView._meIcon(), zIndexOffset: 500 }).addTo(MapView.map);
      else MapView.me.setLatLng(pos);

      if (coords.accuracy) {
        if (!MapView.accuracy) {
          MapView.accuracy = L.circle(pos, {
            radius: coords.accuracy, color: "#2563eb", weight: 1, opacity: 0.35,
            fillColor: "#2563eb", fillOpacity: 0.08,
          }).addTo(MapView.map);
        } else {
          MapView.accuracy.setLatLng(pos).setRadius(coords.accuracy);
        }
      }
    }

    MapView._drawLine();
    if (MapView.follow) MapView.fit();
  },

  setTarget(t) {
    if (!MapView.map || !t) return;

    if (MapView.provider === "baidu") {
      const pt = MapView._bdPoint(t.lat, t.lng);
      if (MapView.target) MapView.map.removeOverlay(MapView.target);
      MapView.target = new BMapGL.Marker(pt);
      MapView.map.addOverlay(MapView.target);
      MapView.target.setLabel(new BMapGL.Label(t.name, { offset: new BMapGL.Size(14, -6) }));
    } else {
      const pos = [t.lat, t.lng];
      if (MapView.target) MapView.target.remove();
      MapView.target = L.marker(pos, { icon: MapView._targetIcon(t.name), zIndexOffset: 400 }).addTo(MapView.map);
    }

    MapView._drawLine();
    if (MapView.follow) MapView.fit();
  },

  _drawLine() {
    if (MapView.provider !== "leaflet" || !MapView.me || !MapView.target) return;
    const pts = [MapView.me.getLatLng(), MapView.target.getLatLng()];
    if (!MapView.line) {
      MapView.line = L.polyline(pts, {
        color: "#2563eb", weight: 3, opacity: 0.55, dashArray: "7 7", lineCap: "round",
      }).addTo(MapView.map);
    } else {
      MapView.line.setLatLngs(pts);
    }
  },

  fit() {
    if (!MapView.map) return;

    if (MapView.provider === "baidu") {
      const pts = [];
      if (MapView.me) pts.push(MapView.me.getCenter());
      if (MapView.target) pts.push(MapView.target.getPosition());
      if (pts.length > 1) MapView.map.setViewport(pts, { margins: [40, 30, 40, 30] });
      else if (pts.length === 1) MapView.map.centerAndZoom(pts[0], 17);
      return;
    }

    const pts = [];
    if (MapView.me) pts.push(MapView.me.getLatLng());
    if (MapView.target) pts.push(MapView.target.getLatLng());
    if (pts.length > 1) {
      MapView.map.fitBounds(L.latLngBounds(pts), { padding: [42, 42], maxZoom: 17, animate: true });
    } else if (pts.length === 1) {
      MapView.map.setView(pts[0], 16, { animate: true });
    }
  },

  recenter() {
    MapView.follow = true;
    MapView.fit();
  },

  resize() {
    if (MapView.provider === "leaflet" && MapView.map) MapView.map.invalidateSize();
  },

  // ── 오프라인 지도 미리받기 ──────────────────────────
  tileXY(lat, lng, z) {
    const n = 2 ** z;
    const latRad = (lat * Math.PI) / 180;
    return {
      x: Math.floor(((lng + 180) / 360) * n),
      y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
    };
  },

  tileList(places) {
    const urls = new Set();
    const tpl = MapView.tileUrl || MapView.STYLES.osm;
    places.forEach((p) => {
      MapView.ZOOMS.forEach((z) => {
        const { x, y } = MapView.tileXY(p.lat, p.lng, z);
        const r = z >= 15 ? 1 : 0;
        for (let dx = -r; dx <= r; dx++)
          for (let dy = -r; dy <= r; dy++)
            urls.add(tpl.replace("{z}", z).replace("{x}", x + dx).replace("{y}", y + dy));
      });
    });
    return [...urls];
  },

  async prefetch(places, onProgress) {
    if (MapView.provider === "baidu") throw new Error("바이두 지도는 미리 저장할 수 없습니다");
    if (!("caches" in window)) throw new Error("이 브라우저는 오프라인 저장을 지원하지 않습니다");

    const cache = await caches.open(MapView.CACHE);
    const urls = MapView.tileList(places);
    let done = 0, failed = 0;

    for (const url of urls) {
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: "cors" });
          if (res.ok) await cache.put(url, res.clone());
          else failed++;
        }
      } catch { failed++; }
      onProgress(++done, urls.length);
      await new Promise((r) => setTimeout(r, 35));
    }
    return { done, failed, total: urls.length };
  },
};
