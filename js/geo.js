const Geo = {
  toRad: (deg) => (deg * Math.PI) / 180,
  toDeg: (rad) => (rad * 180) / Math.PI,

  // 두 좌표 사이 거리 (미터)
  distance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = Geo.toRad(lat2 - lat1);
    const dLon = Geo.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(Geo.toRad(lat1)) * Math.cos(Geo.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // 출발점에서 목적지를 향하는 방위각 (0=북, 90=동)
  bearing(lat1, lon1, lat2, lon2) {
    const dLon = Geo.toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(Geo.toRad(lat2));
    const x =
      Math.cos(Geo.toRad(lat1)) * Math.sin(Geo.toRad(lat2)) -
      Math.sin(Geo.toRad(lat1)) * Math.cos(Geo.toRad(lat2)) * Math.cos(dLon);
    return (Geo.toDeg(Math.atan2(y, x)) + 360) % 360;
  },

  compass(bearing) {
    const names = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
    return names[Math.round(bearing / 45) % 8];
  },

  formatDistance(meters) {
    return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
  },
};
