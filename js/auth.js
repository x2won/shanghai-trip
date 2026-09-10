// 역할 구분
//
// 서버가 없는 앱이라 코드가 앱 파일 안에 들어 있다. 마음먹고 찾으면 볼 수 있으므로
// 이건 "보안"이 아니라 학생이 실수로 편집 화면에 들어가는 것을 막는 장치다.
// 진짜 잠금이 필요하면 서버가 있어야 한다.
const Auth = {
  role: "student", // student | teacher | admin

  load() {
    Auth.role = localStorage.getItem("role") || "student";
    return Auth.role;
  },

  set(role) {
    Auth.role = role;
    localStorage.setItem("role", role);
  },

  // 코드를 확인해 역할을 올린다
  login(code) {
    const a = Trip.data?.access || {};
    const input = String(code || "").trim();
    if (!input) return null;
    if (a.adminCode && input === String(a.adminCode)) { Auth.set("admin"); return "admin"; }
    if (a.teacherCode && input === String(a.teacherCode)) { Auth.set("teacher"); return "teacher"; }
    return null;
  },

  logout() { Auth.set("student"); },

  isStaff: () => Auth.role !== "student",
  isAdmin: () => Auth.role === "admin",

  label: () => ({ student: "학생", teacher: "교사", admin: "관리자" }[Auth.role]),

  // 권한 표
  can(action) {
    const rules = {
      rally: ["teacher", "admin"],      // 집결 지정
      notice: ["teacher", "admin"],     // 공지 보내기
      roster: ["teacher", "admin"],     // 인원 점검
      editSchedule: ["teacher", "admin"],
      editContacts: ["teacher", "admin"],
      print: ["teacher", "admin"],
      editPlaces: ["admin"],            // 장소·좌표는 관리자만
      manageData: ["admin"],            // 내보내기·불러오기·초기화
    };
    return (rules[action] || []).includes(Auth.role);
  },
};
