// 중국 좌표계 변환
//
// 휴대폰 GPS는 WGS-84 좌표를 준다. 그런데 중국 지도(바이두·고덕)는 법적으로 어긋나게 만든
// 좌표계를 쓴다. 변환하지 않으면 실제 위치에서 300~500m 벗어난 곳에 찍힌다.
//   WGS-84 → GCJ-02 (고덕·텐센트) → BD-09 (바이두)
const Coords = {
  A: 6378245.0,
  EE: 0.00669342162296594323,
  X_PI: (Math.PI * 3000.0) / 180.0,

  // 중국 밖에서는 변환하지 않는다
  outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  },

  wgsToGcj(lat, lng) {
    if (Coords.outOfChina(lat, lng)) return { lat, lng };
    let dLat = Coords._transformLat(lng - 105.0, lat - 35.0);
    let dLng = Coords._transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - Coords.EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / (((Coords.A * (1 - Coords.EE)) / (magic * sqrtMagic)) * Math.PI);
    dLng = (dLng * 180.0) / ((Coords.A / sqrtMagic) * Math.cos(radLat) * Math.PI);
    return { lat: lat + dLat, lng: lng + dLng };
  },

  gcjToBd(lat, lng) {
    const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * Coords.X_PI);
    const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * Coords.X_PI);
    return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 };
  },

  wgsToBd(lat, lng) {
    const g = Coords.wgsToGcj(lat, lng);
    return Coords.gcjToBd(g.lat, g.lng);
  },

  _transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
    ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
    return ret;
  },

  _transformLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
    ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
    ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
    return ret;
  },
};
