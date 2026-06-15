import { isLoggedIn } from "./auth.js";

/** 复训星球 — 统一底部 5 栏导航 */
export const NAV_ITEMS = [
  { path: "/home", label: "首页", icon: "🏠", desc: "家庭首页" },
  { path: "/train", label: "复训", icon: "🪐", desc: "资料导入与错题清零" },
  { path: "/checkin", label: "打卡", icon: "✅", desc: "自我评分与成长复盘" },
  { path: "/coach", label: "优培", icon: "💛", desc: "父母陪伴与鼓励" },
  { path: "/profile", label: "我的", icon: "👤", desc: "资料与设置", badgeKey: "profile" },
];

const PUBLIC = new Set(["welcome", "register", "login", "join", "boot"]);

export function navigate(path) {
  window.location.hash = path.startsWith("#") ? path : `#${path}`;
}

export function parseRoute() {
  const parts = window.location.hash.slice(1).split("/").filter(Boolean);
  return { path: parts[0] || "boot", id: parts[1], sub: parts[2] };
}

export function isPublicRoute(path) {
  return PUBLIC.has(path)
    || path === "train-play"
    || path === "train-complete"
    || path === "poster"
    || path === "hearts"
    || path === "coach-parent"
    || path === "coach-honor";
}

export function guardRoute(path) {
  if (isPublicRoute(path)) return true;
  if (!isLoggedIn()) { navigate("/welcome"); return false; }
  return true;
}

export function isCoachWorkbenchRoute(route) {
  return route.path === "coach" && (route.id === "father" || route.id === "mother");
}

export function updateBottomNav(route, root, onNav, unreadCount = 0) {
  const nav = document.getElementById("bottom-nav");
  if (!nav) return;
  const hideNav = ["train-play", "train-complete", "poster", "hearts", "coach-parent", "coach-honor"];
  const show = isLoggedIn()
    && !PUBLIC.has(route.path)
    && !hideNav.includes(route.path)
    && !isCoachWorkbenchRoute(route);
  nav.classList.toggle("hidden", !show);
  document.body.classList.toggle("has-nav", show);
  if (!show) return;

  nav.innerHTML = NAV_ITEMS.map((it) => {
    const active = route.path === it.path.slice(1) || (it.path === "/home" && route.path === "home");
    const badge = it.badgeKey === "profile" && unreadCount > 0
      ? `<span class="nav-badge">${unreadCount > 9 ? "9+" : unreadCount}</span>`
      : "";
    return `<button class="nav-btn ${active ? "is-active" : ""}" data-nav="${it.path}" aria-label="${it.label}" title="${it.desc}">
      <span class="nav-btn__icon">${it.icon}${badge}</span>
      <span class="nav-btn__label">${it.label}</span></button>`;
  }).join("");

  nav.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => onNav(btn.dataset.nav));
  });
}