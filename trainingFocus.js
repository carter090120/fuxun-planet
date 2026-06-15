/**
 * 复训专注答题模式 — PWA / 全屏 / 横屏 / 通知屏蔽
 */
import { hideToast } from "./components.js";
import { navigate } from "./router.js";

let hintTimer = null;
let active = false;
let chromeBound = false;

/** 检测训练运行环境 */
export function detectTrainingEnvironment() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || !!window.navigator.standalone;
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const isIosSafariBrowser = isIOS && !isStandalone && (isSafari || !isChrome);
  const isAndroidChromeBrowser = isAndroid && isChrome && !isStandalone;
  const fullscreenEnabled = !!(
    document.fullscreenEnabled
    ?? document.webkitFullscreenEnabled
    ?? document.documentElement?.requestFullscreen
  );
  const orientationLockSupported = typeof screen.orientation?.lock === "function";

  return {
    isStandalone,
    isIOS,
    isAndroid,
    isIosSafariBrowser,
    isAndroidChromeBrowser,
    isBrowserMode: !isStandalone,
    fullscreenEnabled,
    orientationLockSupported,
    canHideBrowserChrome: isStandalone,
  };
}

export function isTrainingFocusMode() {
  return active || document.body.classList.contains("training-focus-mode");
}

function bindBrowserChromeOffset() {
  if (chromeBound || !window.visualViewport) return;
  chromeBound = true;
  const apply = () => {
    if (!document.body.classList.contains("training-focus-mode--browser")) return;
    const top = Math.max(0, Math.round(window.visualViewport.offsetTop || 0));
    document.documentElement.style.setProperty("--train-browser-chrome", `${top}px`);
  };
  window.visualViewport.addEventListener("resize", apply);
  window.visualViewport.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  apply();
}

function unbindBrowserChromeOffset() {
  document.documentElement.style.removeProperty("--train-browser-chrome");
}

export function enterTrainingFocusMode() {
  const env = detectTrainingEnvironment();
  if (!active) {
    active = true;
    window.__trainingFocusBlockToast = true;
    document.body.classList.add("training-focus-mode");
    if (env.isBrowserMode) {
      document.body.classList.add("training-focus-mode--browser");
      bindBrowserChromeOffset();
    }
    hideToast();
  }
  updateLandscapeHint();
}

export async function exitTrainingFocusMode() {
  if (!active && !document.body.classList.contains("training-focus-mode")) return;
  active = false;
  window.__trainingFocusBlockToast = false;
  document.body.classList.remove("training-focus-mode", "training-focus-mode--browser");
  unbindBrowserChromeOffset();
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

async function tryEnterFullscreenFromGesture() {
  const env = detectTrainingEnvironment();
  if (!env.fullscreenEnabled) return false;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return true;
    }
  } catch { /* CSS fallback */ }
  return false;
}

function tryLockLandscape() {
  try {
    screen.orientation?.lock?.("landscape").catch(() => {});
  } catch { /* ignore */ }
}

/** 用户点击「开始复训」时调用：提示安装 → 尝试全屏与横屏 */
export async function beginTrainingFromUserGesture() {
  const env = detectTrainingEnvironment();
  if (env.isBrowserMode) {
    const proceed = await showTrainInstallPrompt();
    if (!proceed) return false;
  }
  await tryEnterFullscreenFromGesture();
  tryLockLandscape();
  return true;
}

export function requestFocusFullscreen() {
  tryEnterFullscreenFromGesture().then((ok) => {
    showTrainHint(ok ? "已进入专注模式" : "已切换专注布局");
  });
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

export function getInstallGuideHTML() {
  return `<section class="install-guide card-block">
    <h3>如何获得全屏训练体验？</h3>
    <p class="hint install-guide__note">普通 Safari / Chrome 标签页<strong>无法</strong>用代码隐藏浏览器地址栏。请安装到主屏幕后，从桌面图标打开复训星球。</p>
    <article class="install-guide__platform">
      <h4>📱 iPhone</h4>
      <ol>
        <li>用 Safari 打开复训星球</li>
        <li>点击底部分享按钮</li>
        <li>选择「添加到主屏幕」</li>
        <li>从桌面图标打开复训星球</li>
        <li>再进入复训 → 开始复训</li>
      </ol>
    </article>
    <article class="install-guide__platform">
      <h4>🤖 Android</h4>
      <ol>
        <li>用 Chrome 打开复训星球</li>
        <li>点击右上角菜单 ⋮</li>
        <li>选择「安装应用」或「添加到主屏幕」</li>
        <li>从桌面图标打开</li>
        <li>再进入复训训练</li>
      </ol>
    </article>
    <p class="hint">独立 App 模式下不显示浏览器地址栏，训练页可使用全屏布局。</p>
  </section>`;
}

function ensureInstallDialog() {
  let dlg = document.getElementById("train-install-dialog");
  if (dlg) return dlg;
  dlg = document.createElement("dialog");
  dlg.id = "train-install-dialog";
  dlg.className = "modal train-install-dialog";
  dlg.innerHTML = `<div class="modal__box">
    <h2>建议安装到主屏幕后训练</h2>
    <p class="modal__msg">从桌面图标打开复训星球，可以隐藏浏览器地址栏，获得更专注的答题体验。</p>
    <p class="hint train-install-dialog__warn">普通网页模式无法强制隐藏浏览器顶栏，红色地址栏属于浏览器外壳，不是 App 内容。</p>
    <div id="train-install-guide-slot" class="hidden"></div>
    <div class="modal__actions modal__actions--stack">
      <button type="button" class="btn btn--primary btn--block" id="train-install-continue">知道了，继续训练</button>
      <button type="button" class="btn btn--sun btn--block" id="train-install-how">查看安装方法</button>
    </div>
    <button type="button" class="btn btn--ghost btn--block train-install-dialog__back hidden" id="train-install-back">返回</button>
  </div>`;
  document.body.appendChild(dlg);
  return dlg;
}

/** 普通浏览器进入训练前轻提示；standalone 直接通过 */
export function showTrainInstallPrompt() {
  const env = detectTrainingEnvironment();
  if (!env.isStandalone) {
    return new Promise((resolve) => {
      const dlg = ensureInstallDialog();
      const guideSlot = dlg.querySelector("#train-install-guide-slot");
      const backBtn = dlg.querySelector("#train-install-back");
      const actions = dlg.querySelector(".modal__actions");
      const continueBtn = dlg.querySelector("#train-install-continue");
      const howBtn = dlg.querySelector("#train-install-how");

      const resetView = () => {
        guideSlot.classList.add("hidden");
        guideSlot.innerHTML = "";
        backBtn.classList.add("hidden");
        actions.classList.remove("hidden");
        dlg.querySelector("h2").textContent = "建议安装到主屏幕后训练";
        dlg.querySelector(".modal__msg").classList.remove("hidden");
        dlg.querySelector(".train-install-dialog__warn").classList.remove("hidden");
      };

      const onContinue = () => {
        dlg.close();
        cleanup();
        resolve(true);
      };
      const onHow = () => {
        guideSlot.innerHTML = getInstallGuideHTML();
        guideSlot.classList.remove("hidden");
        dlg.querySelector(".modal__msg").classList.add("hidden");
        dlg.querySelector(".train-install-dialog__warn").classList.add("hidden");
        actions.classList.add("hidden");
        backBtn.classList.remove("hidden");
        dlg.querySelector("h2").textContent = "安装到主屏幕";
      };
      const onBack = () => resetView();
      const cleanup = () => {
        continueBtn.removeEventListener("click", onContinue);
        howBtn.removeEventListener("click", onHow);
        backBtn.removeEventListener("click", onBack);
        dlg.removeEventListener("close", onClose);
      };
      const onClose = () => { cleanup(); resolve(false); };

      resetView();
      continueBtn.addEventListener("click", onContinue);
      howBtn.addEventListener("click", onHow);
      backBtn.addEventListener("click", onBack);
      dlg.addEventListener("close", onClose);
      dlg.showModal();
    });
  }
  return Promise.resolve(true);
}

export function openInstallGuidePage() {
  navigate("/profile/install");
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