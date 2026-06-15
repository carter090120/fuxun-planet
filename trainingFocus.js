/**
 * 复训专注答题模式 — 全屏 / 横屏 / 通知屏蔽
 */
import { hideToast } from "./components.js";

let hintTimer = null;
let active = false;

export function isTrainingFocusMode() {
  return active || document.body.classList.contains("training-focus-mode");
}

export function enterTrainingFocusMode() {
  if (!active) {
    active = true;
    window.__trainingFocusBlockToast = true;
    document.body.classList.add("training-focus-mode");
    hideToast();
    tryEnterFullscreen();
    tryLockLandscape();
  }
  updateLandscapeHint();
}

export async function exitTrainingFocusMode() {
  if (!active && !document.body.classList.contains("training-focus-mode")) return;
  active = false;
  window.__trainingFocusBlockToast = false;
  document.body.classList.remove("training-focus-mode");
  hideTrainHint();
  closeParseDrawer();
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch { /* ignore */ }
  try {
    screen.orientation?.unlock?.();
  } catch { /* ignore */ }
}

function tryEnterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* CSS fallback */ }
}

export function requestFocusFullscreen() {
  tryEnterFullscreen();
  showTrainHint("已进入专注模式");
}

function tryLockLandscape() {
  try {
    screen.orientation?.lock?.("landscape").catch(() => {});
  } catch { /* ignore */ }
}

export function updateLandscapeHint() {
  const el = document.getElementById("train-landscape-hint");
  if (!el || !isTrainingFocusMode()) return;
  const landscape = window.innerWidth > window.innerHeight;
  el.classList.toggle("hidden", landscape);
}

export function showTrainHint(message, ms = 2000) {
  if (!message) return;
  let el = document.getElementById("train-focus-hint");
  if (!el) {
    el = document.createElement("div");
    el.id = "train-focus-hint";
    el.className = "train-focus__hint";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("is-show");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove("is-show"), ms);
}

export function hideTrainHint() {
  clearTimeout(hintTimer);
  document.getElementById("train-focus-hint")?.classList.remove("is-show");
}

export function openParseDrawer(contentHtml) {
  let dlg = document.getElementById("train-parse-drawer");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "train-parse-drawer";
    dlg.className = "train-parse-drawer";
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = contentHtml;
  if (!dlg.open) dlg.showModal();
}

export function closeParseDrawer() {
  const dlg = document.getElementById("train-parse-drawer");
  if (dlg?.open) dlg.close();
}