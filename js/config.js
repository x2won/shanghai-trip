// 앱 설정
const CONFIG = {
  // 바이두 지도를 쓰려면 여기에 키를 입력하세요.
  // 발급: https://lbsyun.baidu.com  (百度地图开放平台 → 응용 만들기 → 브라우저단 JavaScript API)
  // 키가 비어 있으면 아래 STYLE의 일반 지도를 사용합니다.
  BAIDU_AK: "",

  // 바이두를 쓰지 않을 때의 지도 스타일
  //  "osm"      오픈스트리트맵 (기본, 키 불필요·중국에서도 접속됨)
  //  "esri"     조금 더 부드러운 지도 (키 불필요)
  //  "voyager"  카토 지도 — 별도 키가 있어야 하며 없으면 워터마크가 찍힘
  STYLE: "osm",

  // 인파를 감안한 도보 속도 (m/분). 시속 약 3km
  WALK_SPEED: 50,

  // 길 찾는 시간 등 여유분 (분)
  BUFFER_MIN: 5,

  // 집결지 도착으로 인정할 거리 (m)
  ARRIVE_RADIUS: 60,
};
