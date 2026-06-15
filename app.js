/**
 * 复训星球 — 页面渲染与交互
 */
import {
  ABILITIES, STATUS_OPTIONS, MOODS, ENERGY, COACHING_STYLES, PARENT_RESPONSE_PREFS,
  formatScore, formatDateKey, formatDateTime, calcAbilityScores, calcTotal, getGrade,
  scoreFromStatus, statusLabel, normalizeStatus,
  getMaterials, addMaterial, getMistakes, upsertMistakes, getTodayMistakes,
  addMaterialImages, updateMaterialImage, getMaterialImages, upsertPhotoMistakes, getPhotoMistakes,
  getTrainingSessions, getTodayRecord, upsertDailyRecord, getRecord,
  addCoachingAction, getCoachingActions, todayStatus, getPrivacy, savePrivacy,
  exportJson, importJson, exportCsv, clearAllData, migrateLegacyStorage, genCode, getStudentMember, updateMember, updateFamily,
  hasParentSentToday,
} from "./storage.js";
import {
  getSession, getCurrentUser, getCurrentRole, isLoggedIn, logout,
  registerFamily, loginWithCredentials, loginAsUser, joinWithCode, seedDemo,
  getFamily, getMembers, enterAsMember,
} from "./auth.js";
import {
  parseQuestionBank, parseDocxQuestionBank, buildMistakesFromAnswers,
  buildPhotoMistakes, photoImportStats, getMistakeReasonOptions,
} from "./questionParser.js";
import { compressImage, recognizeQuestionsFromImages } from "./ocrService.js";
import {
  createTrainingSession, getActiveSession, getCurrentQuestion, gradeTrainingAnswer,
  submitTrainingAnswer, pauseTraining, resumeTraining, exitTraining, trainingProgress,
  dismissRoundEnd, getTrainingEndStats, restoreActiveSession, getOrResumeTrainingSession,
} from "./trainingCoach.js";
import {
  sendHeartNotification, getNotifications, getUnreadCount, markAllRead, markRead,
  getRecentHearts, replyToNotification,
} from "./notifications.js";
import { buildParentSummary, trainingSummaryText } from "./parentSummary.js";
import { drawBarChart, drawRing } from "./charts.js";
import { navigate, parseRoute, guardRoute, updateBottomNav } from "./router.js";
import { generatePoster, sharePoster, downloadPoster } from "./poster.js";
import { APP_VERSION, APP_TAGLINE, MODULE_SLOGANS, SW_CACHE_ID, EMPTY_HINTS } from "./version.js";
import {
  showToast, showConfirm, initConfirmDialog,
  RegisterPageHero, RegisterNavHeader, bindStepBack, SectionTabs, bindSectionTabs,
  AvatarPickerHTML, bindAvatarPickers, FamilyBadgePickerHTML, bindFamilyBadgePicker,
  TagSelectHTML, bindTagSelects, SingleSelectHTML, InfoCard, FieldLabel,
  CoachingStyleCardsHTML, bindCoachingStyleCards, PasswordFieldHTML, bindPasswordFields,
  MemberFormCard, RegisterConfirmCard, renderAvatar, renderFamilyBadge,
  AVATAR_PRESETS, REG_PRESETS, WarnCard, RemindCard, EmptyCard,
} from "./components.js";

const $ = (s, r = document) => r.querySelector(s);
let pendingRecord = null;
let trainTab = "materials";
let checkinDraft = {};
let checkinOpenAbility = null;
let checkinAbilityEdited = false;
const CHECKIN_DRAFT_KEY = "fuxun-checkin-draft";
const CHECKIN_SEC_KEY = "fuxun-checkin-sec";

function persistCheckinDraft() {
  try {
    sessionStorage.setItem(CHECKIN_DRAFT_KEY, JSON.stringify({ ...checkinDraft, dateKey: formatDateKey() }));
  } catch { /* quota */ }
}

function loadPersistedCheckinDraft() {
  try {
    const raw = sessionStorage.getItem(CHECKIN_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d?.dateKey === formatDateKey() ? d : null;
  } catch { return null; }
}
let importMode = "paste";
let photoWizard = null;
let trainPlayPhase = "answer";
let trainPlayFeedback = null;

function resetPhotoWizard() {
  photoWizard = {
    step: 1,
    images: [],
    ocrText: "",
    ocrResult: null,
    parsed: null,
    material: null,
    mistakes: [],
    manualAnswers: {},
    meta: { title: "拍图导入资料", subject: "SAT Reading", sourceNote: "手机拍图" },
  };
}

function getPhotoWizard() {
  if (!photoWizard) resetPhotoWizard();
  return photoWizard;
}

function shell(title, sub, back, body, slogan = "") {
  const sl = slogan ? `<p class="page-slogan">${slogan}</p>` : "";
  return `<div class="page"><header class="page-head">${back ? `<button class="back-btn" data-back>${back}</button>` : ""}
    <div><p class="page-en">${sub || "复训星球"}</p><h1 class="page-title">${title}</h1>${sl}</div></header>${body}</div>`;
}

function tagsHTML(arr) {
  return (arr || []).map((t) => `<span class="tag">${t}</span>`).join("") || `<span class="tag tag--muted">暂无标签</span>`;
}

function tagList(raw) {
  if (Array.isArray(raw)) return raw;
  return String(raw || "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

/* ── Welcome / Auth ── */
function renderWelcome(root) {
  root.innerHTML = `<div class="page page--welcome">
    <div class="brand-hero"><span class="brand-badge">🪐</span>
      <h1>复训星球</h1>
      <p class="brand-sub">${APP_TAGLINE}</p>
      <span class="version-pill">${APP_VERSION}</span>
    </div>
    <div class="action-list">
      <button class="btn btn--primary btn--block" data-go="/register">注册新家庭</button>
      <button class="btn btn--ghost btn--block" data-go="/login">已有账号登录</button>
      <button class="btn btn--sun btn--block" data-demo>一键体验演示家庭</button>
    </div>
    <p class="hint welcome-hint">演示账号：demo@fuxun.local / demo1234<br>含 Daniel 家庭 + 5 道 SAT 题库（3 道错题待清零）</p></div>`;
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  $("[data-demo]", root).addEventListener("click", () => {
    seedDemo();
    showToast("演示数据已就绪：Daniel 的家庭 + SAT 题库");
    navigate("/home");
  });
}

function renderLogin(root) {
  root.innerHTML = shell("登录", "Welcome Back", "←", `<form class="form" id="f">
    <label class="field"><span>手机号 / 邮箱</span><input name="c" required /></label>
    <label class="field"><span>密码</span><input name="p" type="password" required /></label>
    <button class="btn btn--primary btn--block">登录</button></form>
    <p class="hint">演示：demo@fuxun.local / demo1234</p>`);
  $("[data-back]", root).onclick = () => navigate("/welcome");
  $("#f", root).onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = loginWithCredentials(fd.get("c"), fd.get("p"));
    if (!r.ok) return showToast(r.error, "error");
    if (r.needPick) return renderRolePick(root, r.users);
    navigate("/home");
  };
}

function renderRolePick(root, users) {
  root.innerHTML = shell("选择身份", "Pick Role", "←", `<div class="role-grid">${users.map((u) =>
    `<button class="role-card" data-u="${u.userId}"><span>${u.role === "father" ? "👨" : u.role === "mother" ? "👩" : "🧑‍🎓"}</span><strong>${u.name}</strong></button>`
  ).join("")}</div>`);
  $("[data-back]", root).onclick = () => navigate("/login");
  root.querySelectorAll("[data-u]").forEach((b) => b.addEventListener("click", () => { loginAsUser(b.dataset.u); navigate("/home"); }));
}

function renderJoin(root) {
  root.innerHTML = shell("邀请码加入", "Join", "←", `<form class="form" id="f">
    <label class="field"><span>邀请码</span><input name="code" required style="text-transform:uppercase" /></label>
    <label class="field"><span>姓名</span><input name="name" required /></label>
    <button class="btn btn--primary btn--block">加入</button></form>`);
  $("[data-back]", root).onclick = () => navigate("/welcome");
  $("#f", root).onsubmit = (e) => { e.preventDefault(); const fd = new FormData(e.target); const r = joinWithCode(fd.get("code"), fd.get("name")); if (!r.ok) showToast(r.error, "error"); else { showToast("加入成功"); navigate("/home"); } };
}

function renderRegister(root) {
  let step = 1;
  const d = {
    coachingStyle: "balance", parentResponsePref: "只鼓励我",
    badge: "🪐", badgeId: "planet", badgeType: "default", badgeValue: "planet",
  };
  const stepTitles = ["创建家庭", "家庭成员", "准备启航"];

  const collectForm = (form) => Object.fromEntries(new FormData(form));

  const paint = () => {
    if (step === 3 && !d.previewInviteCode) d.previewInviteCode = genCode();
    const nav = RegisterNavHeader({
      step, total: 3, stepTitle: stepTitles[step - 1],
      badgeEmoji: d.badge, badgeImage: d.badgeImage, showBack: step > 1,
    });
    let body = "";

    if (step === 1) {
      body = `<section class="card-block"><form id="s1" class="form">
        <label class="field">${FieldLabel("家庭名称", "Family Name")}
          <input name="familyName" required placeholder="例如：Daniel 的成长星球" value="${d.familyName || ""}" /></label>
        ${InfoCard("建议使用「孩子姓名 + 家庭名称」，方便以后区分家庭。如：Daniel 的成长星球、Ryan 的家庭星球。")}
        ${FamilyBadgePickerHTML({ value: d.badge || "🪐", imageValue: d.badgeImage || "", badgeId: d.badgeId, badgeType: d.badgeType, badgeValue: d.badgeValue })}
        <label class="field">${FieldLabel("家庭口号", "Family Motto")}
          <input name="motto" placeholder="错题清零，星球升级" value="${d.motto || ""}" /></label>
        <p class="field-hint">家庭口号会显示在家庭首页，也可用于成长海报。</p>
        ${CoachingStyleCardsHTML({ value: d.coachingStyle, options: COACHING_STYLES })}
        <label class="field">${FieldLabel("登录手机 / 邮箱", "Login")}
          <input name="contact" required value="${d.contact || ""}" /></label>
        ${PasswordFieldHTML({ minLength: 6 })}
        <button class="btn btn--primary btn--block">下一步：家庭成员</button></form></section>`;
    } else if (step === 2) {
      body = `<form id="s2" class="form member-form-stack">
        ${MemberFormCard("爸爸", "father", `
          <label class="field"><span>姓名</span><input name="dadName" placeholder="爸爸" value="${d.dadName || ""}" /></label>
          ${AvatarPickerHTML({ name: "dadAvatar", value: d.dadAvatar || "👨", imageValue: d.dadAvatarImage || "", label: "头像", presets: AVATAR_PRESETS.father, avatarType: d.dadAvatarType, avatarValue: d.dadAvatarValue })}
          ${TagSelectHTML({ name: "dadHobbies", label: "爱好", presets: REG_PRESETS.dadHobbies, selected: d.dadHobbies })}
          ${TagSelectHTML({ name: "dadTags", label: "性格标签", presets: REG_PRESETS.dadTags, selected: d.dadTags })}
          ${TagSelectHTML({ name: "dadCompanion", label: "陪伴方式", presets: REG_PRESETS.dadCompanion, selected: d.dadCompanion })}
        `)}
        ${MemberFormCard("妈妈", "mother", `
          <label class="field"><span>姓名</span><input name="momName" placeholder="妈妈" value="${d.momName || ""}" /></label>
          ${AvatarPickerHTML({ name: "momAvatar", value: d.momAvatar || "👩", imageValue: d.momAvatarImage || "", label: "头像", presets: AVATAR_PRESETS.mother, avatarType: d.momAvatarType, avatarValue: d.momAvatarValue })}
          ${TagSelectHTML({ name: "momHobbies", label: "爱好", presets: REG_PRESETS.momHobbies, selected: d.momHobbies })}
          ${TagSelectHTML({ name: "momTags", label: "性格标签", presets: REG_PRESETS.momTags, selected: d.momTags })}
          ${TagSelectHTML({ name: "momCompanion", label: "陪伴方式", presets: REG_PRESETS.momCompanion, selected: d.momCompanion })}
        `)}
        ${MemberFormCard("孩子", "student", `
          <label class="field"><span>姓名</span><input name="childName" required value="${d.childName || ""}" /></label>
          <label class="field"><span>昵称</span><input name="childNickname" value="${d.childNickname || ""}" /></label>
          ${AvatarPickerHTML({ name: "childAvatar", value: d.childAvatar || "🧑‍🎓", imageValue: d.childAvatarImage || "", label: "头像", presets: AVATAR_PRESETS.child, avatarType: d.childAvatarType, avatarValue: d.childAvatarValue })}
          <label class="field"><span>年级</span><input name="childGrade" placeholder="高二" value="${d.childGrade || ""}" /></label>
          <label class="field"><span>学校</span><input name="childSchool" value="${d.childSchool || ""}" /></label>
          ${TagSelectHTML({ name: "childHobbies", label: "爱好", presets: REG_PRESETS.childHobbies, selected: d.childHobbies })}
          ${TagSelectHTML({ name: "childTags", label: "性格标签", presets: REG_PRESETS.childTags, selected: d.childTags })}
          <label class="field"><span>当前学习目标</span><input name="learningGoal" value="${d.learningGoal || ""}" /></label>
          ${TagSelectHTML({ name: "childSubjects", label: "主要科目", presets: REG_PRESETS.childSubjects, selected: d.childSubjects })}
          ${SingleSelectHTML({ name: "parentResponsePref", label: "希望爸爸妈妈怎么回应", options: PARENT_RESPONSE_PREFS, value: d.parentResponsePref })}
        `)}
        <button class="btn btn--primary btn--block">下一步：确认创建</button></form>`;
    } else {
      const styleLabel = COACHING_STYLES.find((s) => s.id === d.coachingStyle)?.label || "平衡型";
      body = `${RegisterConfirmCard(d, styleLabel, d.previewInviteCode)}
        <button class="btn btn--primary btn--block btn--launch" id="finish">创建复训星球家庭</button>
        <p class="hint register-foot">创建后将进入家庭首页。你可以随时在「我的」中修改家庭资料和成员资料。</p>`;
    }

    root.innerHTML = `<div class="page page--register">${RegisterPageHero()}${nav}${body}</div>`;
    bindStepBack(root, () => { if (step > 1) { step--; paint(); } else navigate("/welcome"); });
    bindFamilyBadgePicker(root, (b) => { d.badge = b.emoji; d.badgeImage = b.image; d.badgeId = b.id; d.badgeType = b.type; d.badgeValue = b.value; });
    bindAvatarPickers(root);
    bindTagSelects(root);
    bindCoachingStyleCards(root);
    bindPasswordFields(root);

    $("#s1", root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = collectForm(e.target);
      if ((fd.password || "").length < 6) return showToast("密码至少 6 位", "error");
      Object.assign(d, fd);
      step = 2;
      paint();
    });
    $("#s2", root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = collectForm(e.target);
      if (!String(fd.childName || "").trim()) return showToast("请填写孩子姓名", "error");
      Object.assign(d, fd);
      step = 3;
      paint();
    });
    $("#finish", root)?.addEventListener("click", () => {
      const r = registerFamily(d);
      if (!r.ok) return showToast(r.error, "error");
      showToast("家庭创建成功，欢迎登陆复训星球！");
      navigate("/home");
    });
  };
  paint();
}

/* ── Home ── */
function renderHome(root) {
  const fam = getFamily();
  const members = getMembers().sort((a, b) => {
    const o = { father: 0, mother: 1, student: 2 };
    return o[a.role] - o[b.role];
  });
  const st = todayStatus();
  const unread = getUnreadCount();
  const roleLabels = { father: "爸爸", mother: "妈妈", student: "孩子" };

  root.innerHTML = `<div class="page">
    <header class="home-top"><div class="home-top__brand">${renderFamilyBadge(fam, "home-badge")}</div><div>
      <p class="home-brand">复训星球</p>
      <h1>${fam?.familyName || "我们的家庭"}</h1>
      <p class="home-motto">${fam?.motto || "每天进步一点点"}</p>
      <span class="home-date">${formatDateKey()}</span>
      <p class="page-slogan">${MODULE_SLOGANS.home}</p></div>
      <button class="btn btn--ghost btn--sm" id="logout-top">退出登录</button></header>
    ${!st.checkedIn && getCurrentRole() === "student" ? RemindCard(EMPTY_HINTS.checkin, "✅") : ""}
    ${unread && getCurrentRole() === "student" ? `<button type="button" class="alert-heart" data-go="/hearts">💛 你有 ${unread} 条爱心提醒，点击查看</button>` : ""}
    <div class="member-list">${members.map((m) => {
      const status = m.role === "student"
        ? (st.checkedIn ? `已打卡 ${formatScore(st.totalScore)}分` : "待打卡")
        : "陪伴中";
      return `<article class="member-card member-card--${m.role}">
        <div class="member-card__avatar">${renderAvatar(m, "member-card__avatar")}</div>
        <div class="member-card__body">
          <strong>${m.name}${m.nickname ? ` · ${m.nickname}` : ""}</strong>
          <span class="member-role">${roleLabels[m.role]}</span>
          <div class="tag-row">${tagsHTML(m.hobbies)}</div>
          <div class="tag-row">${tagsHTML(m.personalityTags?.length ? m.personalityTags : (m.coachingStyle || []))}</div>
          <p class="member-status">今日：${status}</p>
        </div>
        <button class="btn btn--primary btn--sm" data-enter="${m.memberId}">进入</button>
      </article>`;
    }).join("")}</div></div>`;

  $("#logout-top", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "退出登录", message: "确定要退出当前账号吗？", confirmText: "退出", danger: true })) {
      logout(); navigate("/welcome");
    }
  });
  root.querySelectorAll("[data-enter]").forEach((b) => b.addEventListener("click", () => {
    enterAsMember(b.dataset.enter);
    const role = getCurrentRole();
    if (role === "student") navigate("/checkin");
    else if (role === "father" || role === "mother") navigate("/coach");
    else navigate("/home");
  }));
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  if (unread && getCurrentRole() === "student") {
    const key = `fuxun-heart-toast-${formatDateKey()}`;
    if (!sessionStorage.getItem(key)) {
      const last = getNotifications().find((n) => n.type === "heart" && !n.read);
      if (last) showToast(last.message, "info");
      sessionStorage.setItem(key, "1");
    }
  }
}

/* ── Photo import wizard ── */
function photoStepBar(step) {
  const labels = ["拍图", "确认", "识别", "题库", "复训"];
  return `<div class="photo-steps">${labels.map((l, i) =>
    `<span class="photo-step ${i + 1 <= step ? "is-done" : ""} ${i + 1 === step ? "is-active" : ""}">${i + 1}. ${l}</span>`
  ).join("")}</div>`;
}

function renderPhotoWizard(panel, onDone) {
  const w = getPhotoWizard();
  const bindMeta = () => {
    panel.querySelectorAll("[data-meta]").forEach((el) => {
      el.addEventListener("input", () => { w.meta[el.dataset.meta] = el.value; });
    });
  };

  if (w.step === 1) {
    panel.innerHTML = `${photoStepBar(1)}
      <section class="card-block photo-card">
        <h3>📷 手机拍图导入</h3>
        <p class="hint">课后直接拍纸质题库，识别后生成今日题库与错题库。</p>
        <label class="field"><span>资料名称</span><input data-meta="title" value="${w.meta.title}" /></label>
        <label class="field"><span>科目</span><input data-meta="subject" value="${w.meta.subject}" /></label>
        <div class="photo-actions">
          <label class="btn btn--primary btn--block photo-btn">
            📸 拍照导入题库
            <input type="file" accept="image/*" capture="environment" hidden data-pick="camera" />
          </label>
          <label class="btn btn--ghost btn--block photo-btn">
            🖼 从相册选择
            <input type="file" accept="image/*" multiple hidden data-pick="album" />
          </label>
          <label class="btn btn--ghost btn--block photo-btn">
            ➕ 连续添加图片
            <input type="file" accept="image/*" multiple hidden data-pick="more" />
          </label>
        </div>
        ${w.images.length ? `<div class="photo-grid">${w.images.map((im) => `
          <figure class="photo-thumb" data-id="${im.id}">
            <img src="${im.preview}" alt="${im.fileName}" />
            <button type="button" class="photo-thumb__del" data-del="${im.id}">×</button>
          </figure>`).join("")}</div>` : `<p class="hint photo-empty">还没有图片，先拍一张试试</p>`}
        <button class="btn btn--sun btn--block" id="photo-next" ${w.images.length ? "" : "disabled"}>下一步：确认识别</button>
      </section>`;
    bindMeta();
    const addFiles = async (files) => {
      for (const file of files) {
        const { dataUrl } = await compressImage(file);
        w.images.push({ id: crypto.randomUUID(), preview: dataUrl, dataUrl, fileName: file.name, capturedAt: new Date().toISOString() });
      }
      renderPhotoWizard(panel, onDone);
    };
    panel.querySelectorAll("[data-pick]").forEach((inp) => {
      inp.addEventListener("change", async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = "";
        if (files.length) await addFiles(files);
      });
    });
    panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      w.images = w.images.filter((im) => im.id !== b.dataset.del);
      renderPhotoWizard(panel, onDone);
    }));
    $("#photo-next", panel)?.addEventListener("click", () => { w.step = 2; renderPhotoWizard(panel, onDone); });
    return;
  }

  if (w.step === 2) {
    panel.innerHTML = `${photoStepBar(2)}
      <section class="card-block photo-card">
        <h3>✅ 确认识别</h3>
        <p class="hint">检查图片是否清晰，可删除重拍。</p>
        <div class="photo-confirm-list">${w.images.map((im, idx) => `
          <article class="photo-confirm-card">
            <img src="${im.preview}" alt="${im.fileName}" />
            <div class="photo-confirm-card__meta">
              <strong>图片 ${idx + 1}</strong>
              <span>${im.fileName}</span>
              <div class="photo-confirm-card__acts">
                <label class="btn btn--ghost btn--sm photo-btn">重新拍
                  <input type="file" accept="image/*" capture="environment" hidden data-replace="${im.id}" />
                </label>
                <button type="button" class="btn btn--danger btn--sm" data-del="${im.id}">删除</button>
              </div>
            </div>
          </article>`).join("")}</div>
        <button class="btn btn--primary btn--block" id="photo-ocr">开始识别</button>
        <button class="btn btn--ghost btn--block" id="photo-back">返回拍图</button>
      </section>`;
    panel.querySelectorAll("[data-replace]").forEach((inp) => inp.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const { dataUrl } = await compressImage(file);
      const i = w.images.findIndex((x) => x.id === inp.dataset.replace);
      if (i !== -1) w.images[i] = { ...w.images[i], preview: dataUrl, dataUrl, fileName: file.name, capturedAt: new Date().toISOString() };
      renderPhotoWizard(panel, onDone);
    }));
    panel.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      w.images = w.images.filter((im) => im.id !== b.dataset.del);
      if (!w.images.length) w.step = 1;
      renderPhotoWizard(panel, onDone);
    }));
    $("#photo-back", panel)?.addEventListener("click", () => { w.step = 1; renderPhotoWizard(panel, onDone); });
    $("#photo-ocr", panel)?.addEventListener("click", async () => {
      w.step = 3;
      renderPhotoWizard(panel, onDone);
      const result = await recognizeQuestionsFromImages(w.images);
      w.ocrResult = result;
      w.ocrText = result.text || "";
      renderPhotoWizard(panel, onDone);
    });
    return;
  }

  if (w.step === 3) {
    if (!w.ocrResult) {
      panel.innerHTML = `${photoStepBar(3)}<div class="photo-loading card-block"><p>🔍 正在识别图片…</p><div class="photo-loading__bar"><i></i></div></div>`;
      return;
    }
    const incomplete = w.ocrResult.incomplete;
    panel.innerHTML = `${photoStepBar(3)}
      <section class="card-block photo-card">
        <h3>📝 OCR 识别结果</h3>
        ${InfoCard("当前为模拟识别，可手动修改文本。正式版将接入 AI OCR。")}
        ${incomplete ? WarnCard("识别不完整，请手动修改后继续。") : ""}
        ${w.ocrResult.markersDetected ? RemindCard("检测到可能的错题标记，请人工确认。") : ""}
        <label class="field"><span>识别文本（可编辑）</span>
          <textarea id="ocr-text" rows="10">${w.ocrText}</textarea></label>
        <button class="btn btn--primary btn--block" id="photo-parse">解析为题库</button>
        <button class="btn btn--ghost btn--block" id="photo-back">返回图片</button>
      </section>`;
    $("#ocr-text", panel)?.addEventListener("input", (e) => { w.ocrText = e.target.value; });
    $("#photo-back", panel)?.addEventListener("click", () => { w.step = 2; renderPhotoWizard(panel, onDone); });
    $("#photo-parse", panel)?.addEventListener("click", () => {
      const text = $("#ocr-text", panel)?.value || "";
      if (!text.trim()) return showToast("请先填写识别文本", "error");
      w.parsed = parseQuestionBank(text, w.meta);
      if (!w.parsed.questions.length) return showToast("未能解析出题目，请检查格式", "error");
      const user = getCurrentUser();
      const student = getStudentMember();
      const imageRecords = addMaterialImages(w.images.map((im) => ({
        familyId: user.familyId,
        studentId: student?.memberId,
        imageData: im.dataUrl,
        fileName: im.fileName,
        ocrText: text,
        parseStatus: "parsed",
        manualEditedText: text,
      })));
      w.material = addMaterial({
        ...w.parsed,
        familyId: user.familyId,
        studentId: student?.memberId,
        importedBy: user.name,
        importMethod: "photo",
        images: imageRecords.map((r) => ({ imageId: r.imageId, fileName: r.fileName })),
        ocrText: text,
        manualConfirmRequired: w.ocrResult?.markersDetected || w.ocrResult?.incomplete,
      });
      imageRecords.forEach((r) => updateMaterialImage(r.imageId, { materialId: w.material.materialId }));
      w.mistakes = buildPhotoMistakes(w.material, {}, {
        familyId: user.familyId,
        studentId: student?.memberId,
        imageId: imageRecords[0]?.imageId,
      });
      w.mistakes.forEach((m) => {
        if (m.studentAnswer) w.manualAnswers[m.questionId] = m.studentAnswer;
      });
      w.step = 4;
      renderPhotoWizard(panel, onDone);
    });
    return;
  }

  if (w.step === 4) {
    const stats = photoImportStats(w.mistakes);
    const firstImage = w.images[0]?.preview || "";
    panel.innerHTML = `${photoStepBar(4)}
      <div class="photo-stats">
        <div class="stat"><span>今日题库</span><strong>${stats.total}</strong></div>
        <div class="stat"><span>已识别答案</span><strong>${stats.answered}</strong></div>
        <div class="stat"><span>错题</span><strong>${stats.wrong}</strong></div>
        <div class="stat"><span>待确认</span><strong>${stats.pending}</strong></div>
      </div>
      <div class="photo-success">已生成今日题库，可以开始复训。</div>
      <div id="photo-q-list">${w.mistakes.map((m) => `
        <article class="photo-q-card ${!m.isCorrect ? "is-wrong" : ""}" data-q="${m.questionId}">
          <div class="photo-q-card__head">
            <strong>Q${m.number}</strong>
            <span class="tag">${m.questionType}</span>
            ${m.markerHint ? `<span class="tag tag--warn">${m.markerHint}</span>` : ""}
          </div>
          <p class="q-stem">${m.stem.slice(0, 100)}${m.stem.length > 100 ? "…" : ""}</p>
          <p>正确答案：<strong>${m.correctAnswer}</strong> · 孩子答案：<strong>${m.studentAnswer || "未填"}</strong></p>
          <p>${m.isCorrect ? "✅ 正确" : "❌ 错题"}${m.mistakeReason && !m.isCorrect ? ` · <span class="tag tag--reason">${m.mistakeReason}</span>` : ""}</p>
          <div class="photo-q-card__acts">
            ${firstImage ? `<button type="button" class="btn btn--ghost btn--sm" data-view-img>查看原图</button>` : ""}
            <button type="button" class="btn btn--ghost btn--sm" data-edit-ocr>修改识别结果</button>
          </div>
          <div class="photo-answer-pick ${m.studentAnswer ? "" : "is-open"}" data-ans-pick>
            <span>手动选择孩子答案</span>
            <div class="photo-abcd">${["A", "B", "C", "D"].map((k) =>
              `<button type="button" class="photo-abcd__btn ${w.manualAnswers[m.questionId] === k ? "is-picked" : ""}" data-pick="${k}">${k}</button>`
            ).join("")}</div>
          </div>
        </article>`).join("")}</div>
      <button class="btn btn--green btn--block" id="photo-train">生成复训项目</button>
      <button class="btn btn--ghost btn--block" id="photo-reocr">重新识别</button>`;

    panel.querySelectorAll("[data-view-img]").forEach((b) => b.addEventListener("click", () => {
      const dlg = document.createElement("dialog");
      dlg.className = "modal photo-modal";
      dlg.innerHTML = `<div class="modal__box"><img src="${firstImage}" class="photo-modal__img" /><form method="dialog"><button class="btn btn--primary btn--block">关闭</button></form></div>`;
      document.body.appendChild(dlg);
      dlg.showModal();
      dlg.addEventListener("close", () => dlg.remove());
    }));
    panel.querySelectorAll("[data-edit-ocr]").forEach((b) => b.addEventListener("click", () => { w.step = 3; renderPhotoWizard(panel, onDone); }));
    panel.querySelectorAll(".photo-q-card").forEach((card) => {
      const qid = card.dataset.q;
      card.querySelectorAll("[data-pick]").forEach((btn) => btn.addEventListener("click", () => {
        w.manualAnswers[qid] = btn.dataset.pick;
        const user = getCurrentUser();
        const student = getStudentMember();
        w.mistakes = buildPhotoMistakes(w.material, w.manualAnswers, {
          familyId: user.familyId,
          studentId: student?.memberId,
        });
        renderPhotoWizard(panel, onDone);
      }));
    });
    $("#photo-reocr", panel)?.addEventListener("click", () => { w.step = 2; w.ocrResult = null; renderPhotoWizard(panel, onDone); });
    $("#photo-train", panel)?.addEventListener("click", () => {
      const user = getCurrentUser();
      const student = getStudentMember();
      w.mistakes = buildPhotoMistakes(w.material, w.manualAnswers, {
        familyId: user.familyId,
        studentId: student?.memberId,
      });
      w.mistakes.forEach((m) => {
        m.familyId = user.familyId;
        m.studentId = student?.memberId;
        if (m.needManualConfirm && m.studentAnswer) m.needManualConfirm = false;
      });
      upsertPhotoMistakes(w.mistakes);
      upsertMistakes(w.mistakes);
      const wrong = w.mistakes.filter((x) => !x.isCorrect);
      if (wrong.length) createTrainingSession(w.mistakes, w.material);
      w.step = 5;
      showToast(wrong.length ? `已生成复训项目，${wrong.length} 道错题待清零` : "全部正确，无需复训");
      onDone(wrong.length > 0);
    });
    return;
  }

  panel.innerHTML = `${photoStepBar(5)}
    <div class="complete-card">
      <h2>🎉 拍图导入完成</h2>
      <p>今日题库已就绪，可以开始一题一屏复训。</p>
      <button class="btn btn--primary btn--block" id="go-play">开始 Kahoot 复训</button>
      <button class="btn btn--ghost btn--block" id="go-reset">继续拍图导入</button>
    </div>`;
  $("#go-play", panel)?.addEventListener("click", () => onDone(true));
  $("#go-reset", panel)?.addEventListener("click", () => { resetPhotoWizard(); renderPhotoWizard(panel, onDone); });
}

/* ── Train module ── */
function renderTrain(root) {
  const tabs = [
    { id: "materials", label: "今日资料" },
    { id: "mistakes", label: "错题识别" },
    { id: "play", label: "强化训练" },
    { id: "score", label: "训练成绩" },
  ];
  const mats = getMaterials();
  const todayMat = mats[0];
  const mistakes = todayMat ? getMistakes().filter((m) => m.materialId === todayMat.materialId) : [];
  const user = getCurrentUser();
  const session = restoreActiveSession(user?.familyId, todayMat?.materialId)
    || getTrainingSessions().find((t) => t.dateKey === formatDateKey());
  const prog = session ? trainingProgress(session) : null;

  root.innerHTML = shell("复训", "Retrain Planet", "", `
    ${SectionTabs(tabs.map((t) => ({ id: t.id, label: t.label })), trainTab)}
    <div id="train-panel"></div>`, MODULE_SLOGANS.train);

  const panel = $("#train-panel", root);
  const renderPanel = () => {
    if (trainTab === "materials") {
      const modes = [
        { id: "paste", icon: "📋", label: "粘贴题库" },
        { id: "txt", icon: "📄", label: "上传 TXT" },
        { id: "docx", icon: "📝", label: "Word 导入" },
        { id: "photo", icon: "📷", label: "手机拍图" },
      ];
      panel.innerHTML = `
        <div class="import-modes">${modes.map((m) =>
          `<button type="button" class="import-mode ${importMode === m.id ? "is-active" : ""}" data-mode="${m.id}">
            <span>${m.icon}</span><strong>${m.label}</strong></button>`
        ).join("")}</div>
        <div id="import-panel"></div>
        ${mats.length ? `<p class="hint">最近：${mats[0].title} · ${mats[0].questions?.length || 0} 题 · ${mats[0].importMethod === "photo" ? "拍图导入" : "文本导入"}</p>` : EmptyCard(EMPTY_HINTS.trainNoMaterial, "📚")}`;
      const sub = $("#import-panel", panel);
      panel.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
        importMode = b.dataset.mode;
        panel.querySelectorAll(".import-mode").forEach((x) => x.classList.toggle("is-active", x.dataset.mode === importMode));
        renderImportSub(sub);
      }));
      const renderImportSub = (target) => {
        if (importMode === "photo") {
          renderPhotoWizard(target, (goPlay) => {
            if (goPlay) { trainTab = "play"; render(); }
            else renderPanel();
          });
          return;
        }
        if (importMode === "docx") {
          target.innerHTML = `<section class="card-block"><h3>📝 Word 导入（预留）</h3>
            ${InfoCard("Word 解析将在云端版启用。请使用 TXT 或拍图导入题库。")}
            <label class="onboard-upload"><span>📝</span><span><strong>选择 Word 文件</strong><br><small>.docx（暂不可用）</small></span>
              <input type="file" accept=".docx" hidden id="docx-pick" /></label></section>`;
          $("#docx-pick", target)?.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const r = await parseDocxQuestionBank(file);
            showToast(r.message, "info");
          });
          return;
        }
        const isTxt = importMode === "txt";
        target.innerHTML = `<form class="form card-block" id="import-f">
          <label class="field"><span>资料名称</span><input name="title" placeholder="SAT 阅读 Passage 1" /></label>
          <label class="field"><span>科目</span><input name="subject" value="SAT Reading" /></label>
          <label class="field"><span>来源说明</span><input name="sourceNote" placeholder="课后题库 / 错题讲义" /></label>
          ${isTxt ? "" : `<label class="field"><span>粘贴题库</span><textarea name="text" rows="5" placeholder="1. 题干...&#10;A. ...&#10;答案：C&#10;孩子答案：B"></textarea></label>`}
          ${isTxt ? `<label class="onboard-upload"><span>📄</span><span><strong>上传 TXT 文件</strong></span><input type="file" name="file" accept=".txt,text/plain" hidden /></label>` : ""}
          <button class="btn btn--primary btn--block">导入今日资料</button></form>`;
        $("#import-f", target).onsubmit = async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          let text = fd.get("text");
          const file = e.target.file?.files?.[0];
          if (file) text = await file.text();
          if (!String(text).trim()) return showToast(isTxt ? "请上传 TXT 文件" : "请粘贴题目", "error");
          const parsed = parseQuestionBank(text, { title: fd.get("title"), subject: fd.get("subject"), sourceNote: fd.get("sourceNote") });
          const user = getCurrentUser();
          const student = getStudentMember();
          addMaterial({
            ...parsed,
            familyId: user.familyId,
            studentId: student?.memberId,
            importedBy: user.name,
            importMethod: isTxt ? "txt" : "text",
          });
          showToast(`已导入 ${parsed.questions.length} 道题`);
          render();
        };
      };
      renderImportSub(sub);
    } else if (trainTab === "mistakes") {
      if (!todayMat) { panel.innerHTML = EmptyCard(EMPTY_HINTS.trainNoMaterial, "📚"); return; }
      const existing = mistakes.length ? mistakes : buildMistakesFromAnswers(
        { ...todayMat, materialId: todayMat.materialId },
        Object.fromEntries(todayMat.questions.map((q) => [q.questionId, q.studentAnswer || ""])),
      );
      const answers = {};
      const reasons = {};
      const joinSet = new Set();
      existing.forEach((m) => {
        answers[m.questionId] = m.studentAnswer || "";
        reasons[m.questionId] = m.mistakeReason || "";
        if (!m.isCorrect && m.studentAnswer) joinSet.add(m.questionId);
      });

      const totalQ = todayMat.questions.length;
      const answeredQ = Object.values(answers).filter(Boolean).length;
      const wrongQ = existing.filter((m) => !m.isCorrect && m.studentAnswer).length;
      const pendingQ = totalQ - answeredQ;
      const joinedQ = joinSet.size;

      panel.innerHTML = `
        <div class="mist-stats stat-grid">
          <div class="stat"><span>今日题库总数</span><strong>${totalQ}</strong></div>
          <div class="stat"><span>已识别答案数</span><strong>${todayMat.questions.filter((q) => q.answerKey || q.answer).length}</strong></div>
          <div class="stat"><span>已识别孩子答案</span><strong>${answeredQ}</strong></div>
          <div class="stat"><span>已识别错题数</span><strong>${wrongQ}</strong></div>
          <div class="stat"><span>待确认题数</span><strong>${pendingQ}</strong></div>
          <div class="stat"><span>已加入复训</span><strong>${joinedQ}</strong></div>
        </div>
        <div id="mist-list">${todayMat.questions.map((q) => {
          const m = existing.find((x) => x.questionId === q.questionId);
          const child = answers[q.questionId] || "";
          const correctKey = q.answerKey || q.answer || "";
          const noKey = !correctKey;
          const noChild = !child;
          let compare = "待确认";
          let isWrong = false;
          if (noKey) compare = "未识别正确答案";
          else if (noChild) compare = "未识别孩子答案";
          else {
            isWrong = m ? !m.isCorrect : false;
            compare = isWrong ? "答案不一致 · 错题" : "答案一致 · 正确";
          }
          const reasonOpts = getMistakeReasonOptions(q.type);
          const reason = reasons[q.questionId] || m?.mistakeReason || reasonOpts[0];
          const joined = joinSet.has(q.questionId);
          return `<article class="compare-card ${isWrong ? "is-wrong" : ""}" data-qid="${q.questionId}">
            <div class="compare-card__head"><strong>第 ${q.number} 题</strong><span class="tag">${q.type}</span></div>
            <p class="q-stem">${q.stem.slice(0, 160)}${q.stem.length > 160 ? "…" : ""}</p>
            <div class="compare-row"><span>正确答案</span><strong>${correctKey || "—"}</strong></div>
            <div class="compare-row"><span>孩子答案</span><strong data-child-val="${q.questionId}">${child || "—"}</strong></div>
            <div class="compare-row compare-row--result" data-status="${q.questionId}">
              ${noKey ? WarnCard("未识别正确答案，请补充后再比对。", "📋") : ""}
              ${!noKey && noChild ? RemindCard("未识别孩子答案，请选择 A/B/C/D。", "✏️") : ""}
              ${!noKey && !noChild ? `<span class="compare-badge ${isWrong ? "is-wrong" : "is-ok"}">${compare}</span>` : ""}
            </div>
            ${!noKey ? `<div class="photo-abcd">${["A", "B", "C", "D"].map((k) =>
              `<button type="button" class="photo-abcd__btn ${child === k ? "is-picked" : ""}" data-pick="${k}" data-q="${q.questionId}">${k}</button>`
            ).join("")}</div>` : ""}
            ${isWrong ? `<label class="field"><span>错因标签</span>
              <select data-reason="${q.questionId}">${reasonOpts.map((r) =>
                `<option value="${r}" ${reason === r ? "selected" : ""}>${r}</option>`
              ).join("")}</select></label>` : ""}
            <details class="compare-exp"><summary>查看解析</summary><p>${q.explanation || "回到原文定位关键句。"}</p></details>
            <label class="toggle q-join"><input type="checkbox" data-join="${q.questionId}" ${joined ? "checked" : ""} ${!isWrong ? "disabled" : ""} /><span>加入复训</span></label>
          </article>`;
        }).join("")}</div>
        <button class="btn btn--primary btn--block" id="mist-save">确认错题并生成复训</button>`;

      const refreshCard = (qid) => {
        const q = todayMat.questions.find((x) => x.questionId === qid);
        const child = answers[qid] || "";
        const key = (q.answerKey || "").toUpperCase();
        const noKey = !key;
        const card = panel.querySelector(`[data-qid="${qid}"]`);
        const join = panel.querySelector(`[data-join="${qid}"]`);
        let isWrong = false;
        if (!noKey && child) {
          isWrong = child.toUpperCase() !== key;
          if (isWrong) joinSet.add(qid);
          else joinSet.delete(qid);
        }
        card?.classList.toggle("is-wrong", isWrong);
        const st = panel.querySelector(`[data-status="${qid}"]`);
        if (st) {
          if (noKey) st.innerHTML = WarnCard("未识别正确答案，请补充后再比对。", "📋");
          else if (!child) st.innerHTML = RemindCard("未识别孩子答案，请选择 A/B/C/D。", "✏️");
          else st.innerHTML = `<span class="compare-badge ${isWrong ? "is-wrong" : "is-ok"}">${isWrong ? "答案不一致 · 错题" : "答案一致 · 正确"}</span>`;
        }
        const cv = panel.querySelector(`[data-child-val="${qid}"]`);
        if (cv) cv.textContent = child || "—";
        if (join) { join.checked = isWrong; join.disabled = !isWrong; }
        card?.querySelectorAll("[data-pick]").forEach((b) => b.classList.toggle("is-picked", b.dataset.pick === child));
      };

      panel.querySelectorAll("[data-pick]").forEach((btn) => btn.addEventListener("click", () => {
        answers[btn.dataset.q] = btn.dataset.pick;
        refreshCard(btn.dataset.q);
      }));
      panel.querySelectorAll("[data-reason]").forEach((sel) => sel.addEventListener("change", () => {
        reasons[sel.dataset.reason] = sel.value;
      }));
      panel.querySelectorAll("[data-join]").forEach((cb) => cb.addEventListener("change", () => {
        if (cb.checked) joinSet.add(cb.dataset.join);
        else joinSet.delete(cb.dataset.join);
      }));

      $("#mist-save", panel)?.addEventListener("click", () => {
        const list = buildMistakesFromAnswers({ ...todayMat, materialId: todayMat.materialId }, answers);
        const user = getCurrentUser();
        list.forEach((m) => {
          m.familyId = user.familyId;
          m.studentId = getStudentMember()?.memberId;
          if (reasons[m.questionId]) m.mistakeReason = reasons[m.questionId];
        });
        const wrongOnes = list.filter((m) => !m.isCorrect);
        const pool = wrongOnes.filter((m) => joinSet.has(m.questionId));
        const finalPool = pool.length ? pool : wrongOnes;
        upsertMistakes(list);
        const wrong = finalPool.length;
        showToast(wrong ? `已标记 ${wrong} 道错题，可开始复训` : "全部正确，无需复训");
        if (wrong) {
          getOrResumeTrainingSession(finalPool, { ...todayMat, familyId: user.familyId, studentId: getStudentMember()?.memberId });
          trainTab = "play";
        } else trainTab = "score";
        root.querySelectorAll(".section-tabs__btn").forEach((x) => x.classList.toggle("is-active", x.dataset.tab === trainTab));
        renderPanel();
      });
    } else if (trainTab === "play") {
      const wrong = mistakes.filter((m) => !m.isCorrect);
      if (!wrong.length) {
        panel.innerHTML = `${EmptyCard(EMPTY_HINTS.trainNoMistakes, "🎉")}
          <button class="btn btn--ghost btn--block" data-go-score>查看训练成绩</button>`;
        $("[data-go-score]", panel)?.addEventListener("click", () => {
          trainTab = "score";
          root.querySelectorAll(".section-tabs__btn").forEach((x) => x.classList.toggle("is-active", x.dataset.tab === "score"));
          renderPanel();
        });
        return;
      }
      const uPlay = getCurrentUser();
      const active = restoreActiveSession(uPlay?.familyId, todayMat?.materialId);
      panel.innerHTML = `<p class="hint">剩余错题 <strong>${active?.pool?.length ?? wrong.length}</strong> 道</p>
        <button class="btn btn--primary btn--block" id="start-play">开始 Kahoot 复训</button>
        ${active ? `<button class="btn btn--ghost btn--block" id="resume-play">继续训练</button>` : ""}`;
      $("#start-play", panel)?.addEventListener("click", () => {
        const u = getCurrentUser();
        const resumed = restoreActiveSession(u?.familyId, todayMat?.materialId);
        if (!resumed) getOrResumeTrainingSession(mistakes, { ...todayMat, familyId: u.familyId, studentId: getStudentMember()?.memberId });
        navigate("/train-play");
      });
      $("#resume-play", panel)?.addEventListener("click", () => {
        const u = getCurrentUser();
        restoreActiveSession(u?.familyId, todayMat?.materialId);
        navigate("/train-play");
      });
    } else if (trainTab === "score") {
      const wrongCount = mistakes.filter((m) => !m.isCorrect).length;
      panel.innerHTML = session ? `<div class="stat-grid">
        <div class="stat"><span>正确率</span><strong>${prog.accuracy}%</strong></div>
        <div class="stat"><span>连续答对</span><strong>${prog.streak}</strong></div>
        <div class="stat"><span>剩余错题</span><strong>${prog.remaining}</strong></div>
        <div class="stat"><span>训练状态</span><strong>${session.status === "completed" ? "完成" : "进行中"}</strong></div>
      </div>
      ${session.status === "completed" ? `<div class="complete-card"><h2>🎉 复训完成</h2><p>今日错题已清零</p></div>` : ""}
      <canvas id="acc-ring" width="280" height="160"></canvas>
      ${wrongCount ? `<canvas id="type-chart" width="320" height="180"></canvas>` : ""}` : EmptyCard(EMPTY_HINTS.trainNoScore, "📊");
      if (session) {
        setTimeout(() => drawRing($("#acc-ring", panel), prog.accuracy, "正确率"), 0);
        const types = {};
        mistakes.filter((m) => !m.isCorrect).forEach((m) => { types[m.questionType] = (types[m.questionType] || 0) + 1; });
        const labels = Object.keys(types); const vals = Object.values(types);
        if (labels.length) setTimeout(() => drawBarChart($("#type-chart", panel), labels, vals), 0);
      }
    }
  };

  bindSectionTabs(root, (id) => { trainTab = id; renderPanel(); root.querySelectorAll(".section-tabs__btn").forEach((x) => x.classList.toggle("is-active", x.dataset.tab === trainTab)); });
  renderPanel();
}

function renderTrainPlay(root) {
  const mats = getMaterials();
  const mat = mats[0];
  const user = getCurrentUser();
  let session = restoreActiveSession(user?.familyId, mat?.materialId);
  if (!session && mat) {
    const mistakes = getMistakes().filter((m) => m.materialId === mat.materialId);
    session = getOrResumeTrainingSession(mistakes, { ...mat, familyId: user?.familyId, studentId: getStudentMember()?.memberId });
  }
  if (!session || session.status === "completed" || !session.pool?.length) {
    trainPlayPhase = "answer";
    trainPlayFeedback = null;
    navigate("/train-complete");
    return;
  }

  if (session.paused) {
    root.innerHTML = shell("训练暂停", "Paused", "", `<div class="pause-card">
      ${InfoCard("进度已保存，随时可以继续训练。")}
      <button class="btn btn--primary btn--block" id="resume">继续训练</button>
      <button class="btn btn--ghost btn--block" id="exit">退出训练</button>
      <button class="btn btn--ghost btn--block" data-go="/train">返回复训首页</button></div>`);
    $("#resume", root).onclick = () => { resumeTraining(session); render(); };
    $("#exit", root).onclick = async () => {
      if (await showConfirm({ title: "退出训练", message: "退出后进度会保存，确定退出吗？", confirmText: "退出" })) {
        exitTraining(session); navigate("/train");
      }
    };
    const goBtn = $("[data-go]", root);
    if (goBtn) goBtn.onclick = () => navigate("/train");
    return;
  }

  if (session.showRoundEnd) {
    const last = session.roundResults?.at(-1) || session.currentRound;
    const acc = last?.answered ? Math.round((last.correct / last.answered) * 100) : 0;
    root.innerHTML = shell("本轮成绩", "Round Complete", "", `<div class="complete-card card-block">
      <h2>第 ${last?.roundNumber || session.stats.rounds} 轮结束</h2>
      <div class="stat-grid">
        <div class="stat"><span>本轮题数</span><strong>${last?.answered || 0}</strong></div>
        <div class="stat"><span>答对</span><strong>${last?.correct || 0}</strong></div>
        <div class="stat"><span>答错</span><strong>${last?.wrong || 0}</strong></div>
        <div class="stat"><span>正确率</span><strong>${acc}%</strong></div>
      </div>
      <p class="hint">剩余错题 ${session.pool.length} 道，将进入下一轮错题池。</p>
      <button class="btn btn--primary btn--block" id="next-round">继续下一轮</button></div>`);
    $("#next-round", root).onclick = () => {
      session = dismissRoundEnd(session);
      trainPlayPhase = "answer";
      render();
    };
    return;
  }

  const mistakes = getMistakes().filter((m) => m.materialId === mat?.materialId);
  const { mistake, question, qid } = getCurrentQuestion(session, mistakes, mat) || {};
  const prog = trainingProgress(session);
  const opts = question?.options?.length ? question.options : [
    { key: "A", text: "A" }, { key: "B", text: "B" }, { key: "C", text: "C" }, { key: "D", text: "D" },
  ];
  const qNum = mistake?.number || (prog.done + 1);
  const showFb = trainPlayPhase === "feedback" && trainPlayFeedback;

  root.innerHTML = `<div class="page page--kahoot">
    <div class="kahoot-top">
      <button class="back-btn" id="pause">⏸ 暂停</button>
      <button class="back-btn" id="home-train">复训首页</button>
      <span>Q${qNum} · ${mistake?.questionType || ""} · 剩 ${prog.remaining} 错题</span>
      <button class="back-btn" id="quit">退出</button>
    </div>
    <div class="kahoot-progress"><i style="width:${prog.roundProgress}%"></i></div>
    <p class="kahoot-meta">第 ${prog.rounds} 轮 · 正确率 ${prog.accuracy}% · 🔥${prog.streak}</p>
    <h2 class="kahoot-stem">${question?.stem || mistake?.stem || ""}</h2>
    <div class="kahoot-opts" id="opts">${opts.slice(0, 4).map((o) =>
      `<button class="kahoot-opt" data-a="${o.key}" ${showFb ? "disabled" : ""}><span>${o.key}</span>${o.text || o.key}</button>`
    ).join("")}</div>
    <div id="feedback" class="kahoot-feedback ${showFb ? "" : "hidden"} ${showFb?.ok ? "is-correct" : showFb ? "is-wrong" : ""}">
      ${showFb ? (showFb.ok
        ? `<strong>正确！</strong><p>正确答案：${showFb.key}</p><p>${showFb.explanation}</p>`
        : `<strong>再想想</strong><p>正确答案：${showFb.key}</p><p>${showFb.explanation}</p><p class="hint">错因提醒：${showFb.reason}</p>`) : ""}
    </div>
    <div class="train-footer">
      <button class="btn btn--primary btn--block" id="next-q" ${showFb ? "" : "disabled"}>下一题</button>
      <button class="btn btn--ghost btn--block" id="toggle-exp" ${showFb ? "" : "disabled"}>查看解析</button>
      <div class="train-footer__nav">
        <button class="btn btn--ghost btn--sm" data-go="/checkin">转到打卡</button>
        <button class="btn btn--ghost btn--sm" data-go="/coach">转到优培</button>
      </div>
    </div></div>`;

  $("#pause", root).onclick = () => { pauseTraining(session); render(); };
  $("#home-train", root).onclick = () => navigate("/train");
  $("#quit", root).onclick = async () => {
    if (await showConfirm({ title: "退出训练", message: "退出后进度会保存，确定退出吗？", confirmText: "退出" })) {
      exitTraining(session); navigate("/train");
    }
  };
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));

  if (!showFb) {
    root.querySelectorAll(".kahoot-opt").forEach((btn) => btn.addEventListener("click", () => {
      const ok = gradeTrainingAnswer(question, mistake, btn.dataset.a);
      const key = (mistake?.correctAnswer || question?.answerKey || "").toString().toUpperCase();
      trainPlayFeedback = {
        ok, key, answer: btn.dataset.a,
        explanation: mistake?.explanation || question?.explanation || "回到原文定位关键句。",
        reason: mistake?.mistakeReason || "注意审题与证据对应。",
        qid, mistake, sessionId: session.sessionId,
      };
      trainPlayPhase = "feedback";
      render();
    }));
  }

  $("#next-q", root)?.addEventListener("click", () => {
    if (trainPlayFeedback) {
      session = getActiveSession() || session;
      session = submitTrainingAnswer(session, trainPlayFeedback.qid, trainPlayFeedback.answer, trainPlayFeedback.ok, trainPlayFeedback.mistake);
    }
    trainPlayPhase = "answer";
    trainPlayFeedback = null;
    if (!session?.pool?.length || session.status === "completed") {
      navigate("/train-complete");
      return;
    }
    if (session.showRoundEnd) render();
    else render();
  });

  $("#toggle-exp", root)?.addEventListener("click", () => {
    const fb = $("#feedback", root);
    if (fb) fb.classList.toggle("is-expanded");
    showToast(trainPlayFeedback?.explanation || "暂无解析", "info");
  });
}

function renderTrainComplete(root) {
  const mat = getMaterials()[0];
  const session = getTrainingSessions().find((t) => t.dateKey === formatDateKey() && t.status === "completed")
    || getActiveSession();
  const mistakes = mat ? getMistakes().filter((m) => m.materialId === mat.materialId) : [];
  const stats = getTrainingEndStats(session, mistakes);

  root.innerHTML = shell("复训完成", "Mission Clear", "←", `
    <div class="complete-card card-block">
      <h2>${stats.zeroMistakes ? "🎉 错题已清零！" : "本轮训练结束"}</h2>
      <div class="stat-grid">
        <div class="stat"><span>本次训练题数</span><strong>${stats.totalQuestions}</strong></div>
        <div class="stat"><span>答对题数</span><strong>${stats.correctCount}</strong></div>
        <div class="stat"><span>答错题数</span><strong>${stats.wrongCount}</strong></div>
        <div class="stat"><span>正确率</span><strong>${stats.accuracy}%</strong></div>
        <div class="stat"><span>训练轮次</span><strong>${stats.rounds}</strong></div>
        <div class="stat"><span>最高连对</span><strong>${stats.maxStreak}</strong></div>
        <div class="stat"><span>高频错因</span><strong>${stats.topReason}</strong></div>
        <div class="stat"><span>最弱题型</span><strong>${stats.weakType}</strong></div>
      </div>
      ${InfoCard(stats.tomorrowTip)}
      <div class="action-list">
        <button class="btn btn--primary btn--block" id="again">再练一轮</button>
        <button class="btn btn--ghost btn--block" data-go="/train">查看错题解析</button>
        <button class="btn btn--sun btn--block" data-go="/checkin">去打卡</button>
        <button class="btn btn--ghost btn--block" data-go="/coach">去优培</button>
      </div>
    </div>`);

  $("[data-back]", root).onclick = () => navigate("/train");
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  $("#again", root)?.addEventListener("click", () => {
    const wrong = mistakes.filter((m) => !m.isCorrect);
    if (!wrong.length) return showToast("今日已无错题，太棒了！", "info");
    if (mat) createTrainingSession(wrong, mat);
    trainPlayPhase = "answer";
    navigate("/train-play");
  });
}

/* ── Check-in ── */
function getAbilityFormItems(existing, draftForm) {
  const map = { ...draftForm };
  existing?.abilities?.forEach((a) => a.items.forEach((i) => { if (!map[i.id]) map[i.id] = i.status; }));
  return map;
}

function abilityModuleGridHTML(items) {
  const abs = calcAbilityScores(items);
  return `<div class="ability-module-grid">${ABILITIES.map((ab) => {
    const scored = abs.find((a) => a.id === ab.id);
    const score = scored?.score || 0;
    const rate = ab.max ? score / ab.max : 0;
    const allRated = ab.items.every((it) => items[it.id]);
    const status = rate >= 0.85 && allRated ? "已完成" : allRated ? "已填写" : rate > 0 ? "进行中" : "待填写";
    return `<article class="ability-module-card">
      <div class="ability-module-card__icon">${ab.icon}</div>
      <div class="ability-module-card__body">
        <strong>${ab.name}</strong>
        <span class="ability-module-card__score" data-sc="${ab.id}">${formatScore(score)} / ${ab.max}</span>
        <span class="ability-module-card__status">${status}</span>
        <div class="ability-module-card__bar"><i style="width:${Math.round(rate * 100)}%"></i></div>
      </div>
      <button type="button" class="btn btn--ghost btn--sm" data-open-ab="${ab.id}">进入填写</button>
    </article>`;
  }).join("")}</div>`;
}

function abilityModuleDetailHTML(abId, items) {
  const ab = ABILITIES.find((a) => a.id === abId);
  if (!ab) return "";
  const body = ab.items.map((it) => {
    const st = normalizeStatus(items[it.id] || "full");
    return `<div class="score-item"><div class="score-item__head"><p>${it.label}</p><span>满分${it.max}</span></div>
      <div class="status-group status-group--four">${STATUS_OPTIONS.map((o) =>
        `<label class="status-btn"><input type="radio" name="${it.id}" value="${o.id}" ${st === o.id ? "checked" : ""} /><span>${o.label}</span></label>`
      ).join("")}</div></div>`;
  }).join("");
  return `<section class="ability-detail card-block">
    <button type="button" class="btn btn--ghost btn--sm" data-close-ab>← 返回能力列表</button>
    <h3>${ab.icon} ${ab.name}</h3>
    ${body}
  </section>`;
}

function collectAbilityForm(root) {
  const items = checkinDraft.abilityForm || {};
  ABILITIES.forEach((ab) => ab.items.forEach((it) => {
    const inp = root.querySelector(`input[name="${it.id}"]:checked`);
    if (inp) items[it.id] = inp.value;
  }));
  checkinDraft.abilityForm = items;
  return items;
}

function renderCheckin(root) {
  const existing = getTodayRecord();
  const persisted = loadPersistedCheckinDraft();
  if (persisted) {
    checkinDraft = { ...persisted };
  } else if (!Object.keys(checkinDraft).length) {
    checkinDraft = {
      studyContent: existing?.studyContent, completedTasks: existing?.completedTasks,
      mood: existing?.mood, energy: existing?.energy, stress: existing?.stress,
      highlight: existing?.highlight, reflection: existing?.reflection,
      tomorrowPlan: existing?.tomorrowPlan, noteToSelf: existing?.noteToSelf,
      abilityForm: getAbilityFormItems(existing, {}),
    };
  }
  if (!checkinDraft.abilityForm) {
    checkinDraft.abilityForm = getAbilityFormItems(existing, checkinDraft.abilityForm || {});
  }

  const sections = ["study", "ability", "reflect", "poster"];
  let sec = sessionStorage.getItem(CHECKIN_SEC_KEY) || "study";
  if (!sections.includes(sec)) sec = "study";
  const paint = () => {
    let body = "";
    if (sec === "study") {
      body = `<form class="form card-block" id="study-f"><h3>📖 今日学习</h3>
        <label class="field"><span>今天学了什么</span><textarea name="study" rows="2">${checkinDraft.studyContent || ""}</textarea></label>
        <label class="field"><span>完成了什么</span><textarea name="tasks" rows="2">${checkinDraft.completedTasks || ""}</textarea></label>
        <label class="field"><span>心情</span><select name="mood">${MOODS.map((m) => `<option ${checkinDraft.mood === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
        <label class="field"><span>精力</span><select name="energy">${ENERGY.map((e) => `<option ${checkinDraft.energy === e ? "selected" : ""}>${e}</option>`).join("")}</select></label>
        <label class="field"><span>压力感</span><select name="stress">${["低", "中", "高"].map((s) => `<option ${checkinDraft.stress === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        <button class="btn btn--primary btn--block" type="button" data-next="ability">下一步：能力打卡</button></form>`;
    } else if (sec === "ability") {
      const items = checkinDraft.abilityForm;
      const abs = calcAbilityScores(items);
      const total = calcTotal(abs);
      const g = getGrade(total);
      body = `<div class="checkin-live-score"><strong id="live-total">${formatScore(total)}</strong><span id="live-grade">${g.letter} ${g.label}</span></div>
        <form id="checkin-f">
          ${checkinOpenAbility ? abilityModuleDetailHTML(checkinOpenAbility, items) : abilityModuleGridHTML(items)}
          <button class="btn btn--primary btn--block" type="button" data-next="reflect">下一步：成长复盘</button>
        </form>`;
    } else if (sec === "reflect") {
      body = `<form class="form card-block" id="reflect-f"><h3>📝 成长复盘</h3>
        <label class="field"><span>今日亮点</span><textarea name="highlight" rows="2">${checkinDraft.highlight || ""}</textarea></label>
        <label class="field"><span>学习心得</span><textarea name="reflection" rows="3">${checkinDraft.reflection || ""}</textarea></label>
        <label class="field"><span>明日计划</span><textarea name="plan" rows="2">${checkinDraft.tomorrowPlan || ""}</textarea></label>
        <label class="field"><span>给明天自己的话</span><textarea name="note" rows="2">${checkinDraft.noteToSelf || ""}</textarea></label>
        <button class="btn btn--primary btn--block" type="button" id="submit-checkin">完成打卡并生成海报</button></form>`;
    } else if (sec === "poster") {
      body = existing?.posterDataUrl
        ? `<img src="${existing.posterDataUrl}" class="poster-preview" alt="成长海报" />
           <button class="btn btn--primary btn--block" data-go="/poster/${existing.recordId}">查看海报</button>`
        : EmptyCard(EMPTY_HINTS.poster, "🖼️");
    }

    const checkTabs = sections.map((s) => ({ id: s, label: { study: "今日学习", ability: "能力打卡", reflect: "成长复盘", poster: "生成海报" }[s] }));
    root.innerHTML = shell("打卡", "Daily Growth", "", `
      <div class="checkin-sticky">${SectionTabs(checkTabs, sec)}</div>
      <div class="checkin-body">${body}</div>`, MODULE_SLOGANS.checkin);
    root.querySelector(".page")?.classList.add("page--checkin");

    bindSectionTabs(root, (id) => {
      if (sec === "study") {
        const sf = $("#study-f", root);
        if (sf) {
          const fd = new FormData(sf);
          checkinDraft = { ...checkinDraft, studyContent: fd.get("study"), completedTasks: fd.get("tasks"), mood: fd.get("mood"), energy: fd.get("energy"), stress: fd.get("stress") };
          persistCheckinDraft();
        }
      }
      if (sec === "ability") collectAbilityForm(root);
      sec = id;
      sessionStorage.setItem(CHECKIN_SEC_KEY, id);
      if (id !== "ability") {
        checkinOpenAbility = null;
        checkinAbilityEdited = false;
      }
      paint();
    });

    const saveStudyDraft = () => {
      const sf = $("#study-f", root);
      if (!sf) return;
      const fd = new FormData(sf);
      checkinDraft = { ...checkinDraft, studyContent: fd.get("study"), completedTasks: fd.get("tasks"), mood: fd.get("mood"), energy: fd.get("energy"), stress: fd.get("stress") };
      persistCheckinDraft();
      showToast("今日学习已保存");
    };
    $("#study-f", root)?.addEventListener("change", saveStudyDraft);

    root.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
      const sf = $("#study-f", root);
      if (sf) {
        const fd = new FormData(sf);
        checkinDraft = { ...checkinDraft, studyContent: fd.get("study"), completedTasks: fd.get("tasks"), mood: fd.get("mood"), energy: fd.get("energy"), stress: fd.get("stress") };
      }
      if (sec === "ability") collectAbilityForm(root);
      persistCheckinDraft();
      sec = b.dataset.next;
      sessionStorage.setItem(CHECKIN_SEC_KEY, sec);
      if (b.dataset.next !== "ability") {
        checkinOpenAbility = null;
        checkinAbilityEdited = false;
      }
      paint();
    }));

    if (sec === "ability") {
      const form = $("#checkin-f", root);
      const upd = () => {
        const items = collectAbilityForm(root);
        const abs = calcAbilityScores(items);
        const total = calcTotal(abs);
        const g = getGrade(total);
        const lt = $("#live-total", root);
        const lg = $("#live-grade", root);
        if (lt) lt.textContent = formatScore(total);
        if (lg) lg.textContent = `${g.letter} ${g.label}`;
        abs.forEach((a) => {
          const el = root.querySelector(`[data-sc="${a.id}"]`);
          if (el) el.textContent = `${formatScore(a.score)}/${a.max}`;
        });
        persistCheckinDraft();
        if (checkinOpenAbility && checkinAbilityEdited) {
          const ab = ABILITIES.find((a) => a.id === checkinOpenAbility);
          const done = ab?.items.every((it) => items[it.id]);
          if (done) {
            showToast("这一项完成了，继续下一项。");
            checkinOpenAbility = null;
            checkinAbilityEdited = false;
            setTimeout(() => paint(), 400);
          }
        }
      };
      form?.addEventListener("change", () => {
        checkinAbilityEdited = true;
        upd();
      });
      form?.querySelectorAll("[data-open-ab]").forEach((b) => b.addEventListener("click", () => {
        collectAbilityForm(root);
        checkinOpenAbility = b.dataset.openAb;
        checkinAbilityEdited = false;
        paint();
      }));
      $("[data-close-ab]", root)?.addEventListener("click", () => {
        collectAbilityForm(root);
        checkinOpenAbility = null;
        paint();
      });
      upd();
    }

    $("#submit-checkin", root)?.addEventListener("click", () => {
      const rf = $("#reflect-f", root);
      if (rf) {
        const fd = new FormData(rf);
        checkinDraft = { ...checkinDraft, highlight: fd.get("highlight"), reflection: fd.get("reflection"), tomorrowPlan: fd.get("plan"), noteToSelf: fd.get("note") };
      }
      const items = checkinDraft.abilityForm || getAbilityFormItems(existing, {});
      const abilities = calcAbilityScores(items);
      const totalScore = calcTotal(abilities);
      const grade = getGrade(totalScore);
      const student = getStudentMember();
      const user = getCurrentUser();
      const session = getTrainingSessions().find((t) => t.dateKey === formatDateKey());
      const parentSummary = buildParentSummary(
        { ...checkinDraft, abilities, totalScore, grade },
        {
          mistakeCount: getTodayMistakes().length,
          trainingDone: session?.status === "completed",
          trainingSummary: trainingSummaryText(session),
          parentResponsePref: student?.parentResponsePref,
        },
      );
      pendingRecord = {
        recordId: existing?.recordId || crypto.randomUUID(),
        familyId: user.familyId, studentId: student?.memberId,
        dateKey: formatDateKey(), dateTime: formatDateTime(),
        abilities, totalScore, grade, parentSummary,
        trainingSummary: parentSummary.trainingSummary,
        ...checkinDraft,
        childName: student?.name,
        avatarEmoji: student?.avatar || student?.avatarValue,
        familyName: getFamily()?.familyName,
        encouragement: pickEncouragement(grade, checkinDraft.mood),
      };
      persistCheckinDraft();
      sessionStorage.removeItem(CHECKIN_DRAFT_KEY);
      showToast("打卡已保存");
      $("#privacy-dialog").showModal();
    });
    root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(`/poster/${existing.recordId}`)));
  };
  paint();
}

/* ── Coach (优培) ── */
const CARD_STYLES = ["阳光鼓励", "温暖陪伴", "目标加油", "幽默轻松", "深情支持"];
const REWARD_TYPES = ["精神鼓励", "物质奖励", "亲子活动", "明日特权", "学习方法卡"];
const STAR_LABELS = ["今日努力程度", "今日专注程度", "今日复盘态度", "今日情绪管理", "家长总评"];

function renderCoachSummary(student, st) {
  return `<div class="coach-summary card-block">
    <h3>${student?.name || "孩子"} 今日状态</h3>
    <div class="stat-grid">
      <div class="stat"><span>打卡状态</span><strong>${st.checkedIn ? "已打卡" : "未打卡"}</strong></div>
      <div class="stat"><span>今日总分</span><strong>${st.checkedIn ? formatScore(st.totalScore) : "—"}</strong></div>
      <div class="stat"><span>今日错题</span><strong>${st.mistakeCount}</strong></div>
      <div class="stat"><span>复训进度</span><strong>${st.trainingProgress}</strong></div>
      <div class="stat"><span>今日心情</span><strong>${st.mood || "—"}</strong></div>
      <div class="stat"><span>收到鼓励</span><strong>${st.hasEncouragement ? "已收到" : "暂无"}</strong></div>
    </div>
    <p class="hint">明日计划：${st.tomorrowPlan || "—"}</p>
  </div>`;
}

function renderParentEntryCard(member, role, readonly = false) {
  if (!member) return "";
  const label = role === "father" ? "爸爸优培卡" : "妈妈优培卡";
  const sent = hasParentSentToday(role);
  const tip = role === "mother"
    ? "今天可以先看孩子的计划和心情，再帮他整理一个明天的小目标。"
    : "今天可以先认可孩子的努力，再指出一个关键方法，不要一次说太多。";
  return `<article class="coach-card coach-card--${role}">
    <div class="coach-card__head">${renderAvatar(member, "coach-card__avatar")}
      <div><h3>${label}</h3><strong>${member.name}</strong>
      <div class="tag-row">${tagsHTML(member.personalityTags)}</div></div>
    </div>
    ${readonly ? `<p class="hint">今日是否已发送鼓励：${sent ? "是" : "否"}</p>` : `<p class="hint">${tip}</p><p class="hint">今日鼓励：${sent ? "已发送 ✓" : "尚未发送"}</p>
    <button class="btn btn--primary btn--block" data-enter-coach="${role}">进入${role === "father" ? "爸爸" : "妈妈"}优培</button>`}
  </article>`;
}

function renderParentSummaryCard(rec) {
  if (!rec?.parentSummary) return "";
  const ps = rec.parentSummary;
  const tags = ps.tags || {};
  return `<section class="card-block parent-summary">
    <h3>家长今日摘要</h3>
    <div class="stat-grid">
      <div class="stat"><span>今日总分</span><strong>${formatScore(ps.totalScore)}</strong></div>
      <div class="stat"><span>今日等级</span><strong>${ps.grade?.letter || "—"}</strong></div>
      <div class="stat"><span>今日错题</span><strong>${ps.mistakeCount}</strong></div>
      <div class="stat"><span>复训</span><strong>${ps.trainingDone ? "已完成" : "未完成"}</strong></div>
    </div>
    <p class="hint">心情 ${ps.mood || "—"} · 精力 ${ps.energy || "—"} · 压力 ${ps.stress || "—"}</p>
    <div class="summary-tags">
      <article class="summary-tag"><h4>学习总览</h4><p>${tags.overview || ""}</p></article>
      <article class="summary-tag"><h4>今日优点</h4><p>${tags.strengths || ""}</p></article>
      <article class="summary-tag"><h4>明日计划</h4><p>${tags.tomorrow || ""}</p></article>
      <article class="summary-tag"><h4>建议回应</h4><p>${tags.parentResponse || ps.parentAdvice || ""}</p></article>
    </div>
    <p class="hint">系统建议：${ps.parentAdvice || ""}</p>
  </section>`;
}

function renderCoach(root) {
  const role = getCurrentRole();
  const st = todayStatus();
  const student = getStudentMember();
  const father = getMembers().find((m) => m.role === "father");
  const mother = getMembers().find((m) => m.role === "mother");
  const recentHearts = getRecentHearts();

  let extra = "";
  if (role === "student") {
    if (!st.hasEncouragement) {
      extra += EmptyCard(EMPTY_HINTS.hearts, "💛");
    }
    if (recentHearts.length) {
      extra += `<section class="card-block"><h3>最近收到的爱心</h3>${recentHearts.map((h) =>
        `<div class="heart-card"><strong>${h.message}</strong><p>${h.cardTitle || ""}</p><p>${h.cardText}</p></div>`
      ).join("")}<button class="btn btn--ghost btn--block" data-go="/hearts">查看全部爱心消息</button></section>`;
    }
    extra += `<div class="member-list">${renderParentEntryCard(father, "father", true)}${renderParentEntryCard(mother, "mother", true)}</div>`;
  } else {
    extra += renderParentSummaryCard(getTodayRecord());
    extra += renderParentEntryCard(role === "father" ? father : mother, role);
  }

  root.innerHTML = shell("优培", "Quality Parenting", "", `${renderCoachSummary(student, st)}${extra}`, MODULE_SLOGANS.coach);
  root.querySelectorAll("[data-enter-coach]").forEach((b) => b.addEventListener("click", () => navigate(`/coach-parent/${b.dataset.enterCoach}`)));
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
}

function renderCoachParent(root, parentRole) {
  const role = parentRole || getCurrentRole();
  if (role !== "father" && role !== "mother") { navigate("/coach"); return; }
  const member = getMembers().find((m) => m.role === role);
  const student = getStudentMember();
  const label = role === "father" ? "爸爸" : "妈妈";
  const tip = role === "mother"
    ? RemindCard("今天可以先看孩子的计划和心情，再帮他整理一个明天的小目标。")
    : RemindCard("今天可以先认可孩子的努力，再指出一个关键方法，不要一次说太多。");

  root.innerHTML = shell(`${label}优培`, "Parent Coaching", "←", `
    <div class="coach-card coach-card--${role}">
      <div class="coach-card__head">${renderAvatar(member, "coach-card__avatar")}
        <div><h3>${member?.name || label}</h3><div class="tag-row">${tagsHTML(member?.personalityTags)}</div></div>
      </div>
    </div>
    ${tip}
    <div class="coach-actions">
      <button class="coach-btn" data-act="praise">👏 认可成绩</button>
      <button class="coach-btn" data-act="method">💡 给方法</button>
      <button class="coach-btn" data-act="stars">⭐ 评分</button>
      <button class="coach-btn" data-act="card">💌 鼓励贺卡</button>
    </div>
    <div id="coach-form" class="coach-form hidden"></div>`);

  $("[data-back]", root).onclick = () => navigate("/coach");

  const box = $("#coach-form", root);
  root.querySelectorAll(".coach-btn").forEach((btn) => btn.addEventListener("click", () => {
    box.classList.remove("hidden");
    const act = btn.dataset.act;
    if (act === "praise") {
      box.innerHTML = `<form class="form" id="cf">
        <label class="field"><span>我看见你的一个进步</span><textarea name="progress" rows="2"></textarea></label>
        <label class="field"><span>今天最值得肯定的地方</span><textarea name="praise" rows="2"></textarea></label>
        <label class="field"><span>我想对你说的一句话</span><textarea name="word" rows="2"></textarea></label>
        <button class="btn btn--primary btn--block">发送认可</button></form>`;
      $("#cf", box).onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        saveCoach(role, "praise", { progress: fd.get("progress"), praise: fd.get("praise"), word: fd.get("word") });
        showToast("认可已发送"); box.classList.add("hidden"); render();
      };
    } else if (act === "method") {
      box.innerHTML = `<form class="form" id="cf">
        <label class="field"><span>我看到你今天卡住的地方</span><textarea name="stuck" rows="2"></textarea></label>
        <label class="field"><span>我建议你试试这个方法</span><textarea name="method" rows="2"></textarea></label>
        <label class="field"><span>明天可以先做这一步</span><textarea name="step" rows="2"></textarea></label>
        <button class="btn btn--primary btn--block">发送方法</button></form>`;
      $("#cf", box).onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        saveCoach(role, "method", { stuck: fd.get("stuck"), method: fd.get("method"), step: fd.get("step") });
        showToast("方法建议已发送"); box.classList.add("hidden"); render();
      };
    } else if (act === "stars") {
      box.innerHTML = `<form class="form" id="cf">${STAR_LABELS.map((lb, i) =>
        `<label class="field"><span>${lb}</span><div class="star-row">${[1, 2, 3, 4, 5].map((n) =>
          `<button type="button" class="star-btn" data-dim="${i}" data-s="${n}">⭐${n}</button>`
        ).join("")}</div><input type="hidden" name="star${i}" value="3" /></label>`
      ).join("")}<button class="btn btn--primary btn--block">提交评分</button></form>`;
      const stars = [3, 3, 3, 3, 3];
      box.querySelectorAll(".star-btn").forEach((s) => s.addEventListener("click", () => {
        stars[Number(s.dataset.dim)] = Number(s.dataset.s);
        box.querySelector(`[name="star${s.dataset.dim}"]`).value = s.dataset.s;
      }));
      $("#cf", box).onsubmit = (e) => {
        e.preventDefault();
        saveCoach(role, "stars", { dimensions: STAR_LABELS.map((lb, i) => ({ label: lb, stars: stars[i] })) });
        showToast("评分已发送"); box.classList.add("hidden"); render();
      };
    } else if (act === "card") {
      box.innerHTML = `<form class="form" id="cf">
        <label class="field"><span>贺卡标题</span><input name="title" placeholder="今天也很棒" /></label>
        <label class="field"><span>贺卡内容</span><textarea name="content" rows="3"></textarea></label>
        <label class="field"><span>贺卡风格</span><select name="style">${CARD_STYLES.map((s) => `<option>${s}</option>`).join("")}</select></label>
        <label class="field"><span>奖励类型</span><select name="reward" id="reward-type">${REWARD_TYPES.map((s) => `<option>${s}</option>`).join("")}</select></label>
        <div id="reward-extra" class="hidden">
          <label class="field"><span>奖励名称</span><input name="rewardName" /></label>
          <label class="field"><span>奖励条件</span><input name="rewardCond" /></label>
          <label class="toggle"><input type="checkbox" name="fulfilled" /><span>是否已兑现</span></label>
        </div>
        <button class="btn btn--sun btn--block">发送鼓励贺卡</button></form>`;
      const rt = $("#reward-type", box);
      const extra = $("#reward-extra", box);
      rt?.addEventListener("change", () => extra.classList.toggle("hidden", rt.value !== "物质奖励"));
      $("#cf", box).onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
          title: fd.get("title"), content: fd.get("content"),
          style: fd.get("style"), reward: fd.get("reward"),
          rewardName: fd.get("rewardName"), rewardCond: fd.get("rewardCond"),
          fulfilled: fd.get("fulfilled") === "on",
        };
        saveCoach(role, "card", payload);
        const users = requireUsers();
        const su = users.find((u) => u.memberId === student?.memberId);
        if (su) {
          sendHeartNotification({
            toUserId: su.userId, fromRole: role, fromName: member?.name,
            cardTitle: payload.title || "来自家人的鼓励",
            cardText: payload.content,
            cardStyle: payload.style,
            rewardType: payload.reward,
            rewardName: payload.rewardName,
            rewardCondition: payload.rewardCond,
            rewardFulfilled: payload.fulfilled,
          });
        }
        showToast(`爱心已发送！孩子将看到：你收到${label}的爱心了`);
        box.classList.add("hidden");
        render();
      };
    }
  }));
}

function renderHearts(root) {
  const notes = getNotifications().filter((n) => n.type === "heart");
  const replies = ["谢谢爸爸", "谢谢妈妈", "我明天继续努力", "我想再试一次"];

  root.innerHTML = shell("爱心消息", "Heart Inbox", "←", notes.length
    ? `<div class="heart-list">${notes.map((n) => {
      const from = n.fromRole === "father" ? "爸爸" : "妈妈";
      return `<article class="heart-msg ${n.read ? "" : "is-unread"}">
        <div class="heart-msg__head">${renderAvatar(getMembers().find((m) => m.role === n.fromRole), "heart-msg__av")}
          <div><strong>来自${from}</strong><span class="hint">${formatDateTime(new Date(n.createdAt))}</span></div>
          ${n.read ? "" : `<span class="tag">未读</span>`}
        </div>
        <h4>${n.cardTitle || n.message}</h4>
        <p>${n.cardText}</p>
        <p class="hint">奖励：${n.rewardType || "精神鼓励"}</p>
        ${n.reply ? `<p class="hint">已回复：${n.reply}</p>` : `<div class="heart-replies">${replies.map((r) =>
          `<button type="button" class="btn btn--ghost btn--sm" data-reply="${n.notificationId}" data-text="${r}">${r}</button>`
        ).join("")}</div>`}
      </article>`;
    }).join("")}</div>`
    : EmptyCard(EMPTY_HINTS.hearts, "💛"));

  $("[data-back]", root).onclick = () => navigate("/profile");
  root.querySelectorAll("[data-reply]").forEach((b) => b.addEventListener("click", () => {
    replyToNotification(b.dataset.reply, b.dataset.text);
    showToast("回复已保存");
    render();
  }));
  notes.filter((n) => !n.read).forEach((n) => markRead(n.notificationId));
}

function requireUsers() {
  try {
    return JSON.parse(localStorage.getItem("fuxun-planet-v1") || "{}").users || [];
  } catch {
    return [];
  }
}

function saveCoach(role, type, content) {
  const user = getCurrentUser();
  const student = getStudentMember();
  addCoachingAction({
    familyId: user.familyId, studentId: student?.memberId,
    parentRole: role, type, content: typeof content === "string" ? content : JSON.stringify(content),
    payload: typeof content === "object" ? content : { text: content },
  });
}

/* ── Profile ── */
function parentProfileForm(member, role, prefix) {
  if (!member) return "";
  const presets = role === "father" ? REG_PRESETS.dadTags : REG_PRESETS.momTags;
  const hobbies = role === "father" ? REG_PRESETS.dadHobbies : REG_PRESETS.momHobbies;
  const companion = role === "father" ? REG_PRESETS.dadCompanion : REG_PRESETS.momCompanion;
  return `<form class="form card-block" id="${prefix}-f"><h3>${role === "father" ? "爸爸" : "妈妈"}资料</h3>
    <label class="field"><span>姓名</span><input name="name" value="${member.name || ""}" /></label>
    ${AvatarPickerHTML({ name: `${prefix}Avatar`, value: member.avatar || (role === "father" ? "👨" : "👩"), imageValue: member.avatarImage || "", label: "头像", presets: AVATAR_PRESETS[role] })}
    ${TagSelectHTML({ name: `${prefix}Hobbies`, label: "爱好", presets: hobbies, selected: member.hobbies })}
    ${TagSelectHTML({ name: `${prefix}Tags`, label: "性格标签", presets: presets, selected: member.personalityTags })}
    ${TagSelectHTML({ name: `${prefix}Companion`, label: "陪伴方式", presets: companion, selected: member.coachingStyle })}
    <label class="field"><span>默认鼓励风格</span><select name="encourageStyle">${CARD_STYLES.map((s) => `<option ${member.defaultEncourageStyle === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <button class="btn btn--ghost btn--block">保存${role === "father" ? "爸爸" : "妈妈"}资料</button></form>`;
}

function renderProfile(root) {
  const user = getCurrentUser();
  const fam = getFamily();
  const student = getStudentMember();
  const father = getMembers().find((m) => m.role === "father");
  const mother = getMembers().find((m) => m.role === "mother");
  const priv = getPrivacy();
  const unread = getUnreadCount();
  const styleLabel = COACHING_STYLES.find((s) => s.id === fam?.coachingStyle)?.label || "平衡型";

  root.innerHTML = shell("我的", "Profile & Settings", "", `
    <p class="version-pill">${APP_VERSION}</p>
    <button class="btn btn--sun btn--block" data-go="/hearts">💛 爱心消息${unread ? ` (${unread})` : ""}</button>
    <form class="form card-block" id="fam-f"><h3>家庭资料</h3>
      <label class="field"><span>家庭名称</span><input name="familyName" value="${fam?.familyName || ""}" /></label>
      ${FamilyBadgePickerHTML({ value: fam?.badge || "🪐", imageValue: fam?.badgeImage || "", badgeId: fam?.badgeId, badgeType: fam?.badgeType, badgeValue: fam?.badgeValue })}
      <label class="field"><span>家庭口号</span><input name="motto" value="${fam?.motto || ""}" /></label>
      <label class="field"><span>家庭陪伴风格</span><select name="coachingStyle">${COACHING_STYLES.map((s) => `<option value="${s.id}" ${fam?.coachingStyle === s.id ? "selected" : ""}>${s.label}</option>`).join("")}</select></label>
      <p class="field-hint">当前：${styleLabel}</p>
      <button class="btn btn--ghost btn--block">保存家庭资料</button></form>
    ${parentProfileForm(father, "father", "dad")}
    ${parentProfileForm(mother, "mother", "mom")}
    <form class="form card-block" id="stu-f"><h3>孩子资料</h3>
      <label class="field"><span>姓名</span><input name="name" value="${student?.name || ""}" /></label>
      <label class="field"><span>昵称</span><input name="nickname" value="${student?.nickname || ""}" /></label>
      ${AvatarPickerHTML({ name: "childAvatar", value: student?.avatar || "🧑‍🎓", imageValue: student?.avatarImage || "", label: "头像", presets: AVATAR_PRESETS.child })}
      <label class="field"><span>年级</span><input name="grade" value="${student?.grade || ""}" /></label>
      <label class="field"><span>学校</span><input name="school" value="${student?.school || ""}" /></label>
      ${TagSelectHTML({ name: "childHobbies", label: "爱好", presets: REG_PRESETS.childHobbies, selected: student?.hobbies })}
      ${TagSelectHTML({ name: "childTags", label: "性格标签", presets: REG_PRESETS.childTags, selected: student?.personalityTags })}
      <label class="field"><span>学习目标</span><input name="learningGoal" value="${student?.learningGoal || ""}" /></label>
      ${TagSelectHTML({ name: "childSubjects", label: "主要科目", presets: REG_PRESETS.childSubjects, selected: student?.subjectFocus })}
      ${SingleSelectHTML({ name: "parentResponsePref", label: "希望爸爸妈妈怎么回应", options: PARENT_RESPONSE_PREFS, value: student?.parentResponsePref })}
      <button class="btn btn--ghost btn--block">保存孩子资料</button></form>
    <div class="card-block"><h3>隐私设置</h3>
      <label class="toggle"><input type="checkbox" id="p-sc" ${priv.showScores !== false ? "checked" : ""} /><span>海报显示分数</span></label>
      <label class="toggle"><input type="checkbox" id="p-loc" ${priv.showLocation !== false ? "checked" : ""} /><span>海报显示地点</span></label>
      <label class="toggle"><input type="checkbox" id="p-selfie" ${priv.showSelfie !== false ? "checked" : ""} /><span>海报显示头像</span></label>
      <label class="toggle"><input type="checkbox" id="p-mood" ${priv.allowHideMood !== false ? "checked" : ""} /><span>允许孩子隐藏心情</span></label>
      <label class="toggle"><input type="checkbox" id="p-mist" ${priv.allowParentMistakeDetail !== false ? "checked" : ""} /><span>允许家长查看错题明细</span></label>
      <label class="toggle"><input type="checkbox" id="p-export" ${priv.allowExport !== false ? "checked" : ""} /><span>允许导出数据</span></label>
    </div>
    <div class="card-block"><h3>数据管理</h3>
      <div class="action-list">
        <button class="btn btn--ghost btn--block" id="ex-j">导出 JSON</button>
        <button class="btn btn--ghost btn--block" id="ex-c">导出 CSV</button>
        <label class="btn btn--ghost btn--block">导入 JSON<input type="file" id="im-j" accept="application/json" hidden /></label>
        <button class="btn btn--ghost btn--block" id="seed">重置演示数据</button>
        <button class="btn btn--danger btn--block" id="clear">清空本地数据</button>
        <button class="btn btn--danger btn--block" id="logout">退出登录</button>
      </div>
    </div>`, MODULE_SLOGANS.profile);

  bindAvatarPickers(root);
  bindFamilyBadgePicker(root);
  bindTagSelects(root);
  root.querySelector("[data-go]")?.addEventListener("click", () => navigate("/hearts"));

  const saveParent = (e, member, prefix) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateMember(member.memberId, {
      name: fd.get("name"),
      avatar: fd.get(`${prefix}Avatar`),
      avatarImage: fd.get(`${prefix}AvatarImage`) || "",
      avatarType: fd.get(`${prefix}AvatarType`) || "emoji",
      avatarValue: fd.get(`${prefix}AvatarValue`) || fd.get(`${prefix}Avatar`),
      hobbies: tagList(fd.get(`${prefix}Hobbies`)),
      personalityTags: tagList(fd.get(`${prefix}Tags`)),
      coachingStyle: tagList(fd.get(`${prefix}Companion`)),
      defaultEncourageStyle: fd.get("encourageStyle"),
    });
    showToast("资料已保存");
  };
  $("#dad-f", root)?.addEventListener("submit", (e) => father && saveParent(e, father, "dad"));
  $("#mom-f", root)?.addEventListener("submit", (e) => mother && saveParent(e, mother, "mom"));

  $("#fam-f", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateFamily(fam.familyId, {
      familyName: fd.get("familyName"),
      motto: fd.get("motto"),
      familyMotto: fd.get("motto"),
      coachingStyle: fd.get("coachingStyle"),
      badge: fd.get("badge"),
      badgeImage: fd.get("badgeImage") || "",
      badgeId: fd.get("badgeId"),
      badgeType: fd.get("badgeType"),
      badgeValue: fd.get("badgeValue"),
      familyBadge: fd.get("badge"),
    });
    showToast("家庭资料已保存");
  });
  $("#stu-f", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateMember(student.memberId, {
      name: fd.get("name"),
      nickname: fd.get("nickname"),
      grade: fd.get("grade"),
      school: fd.get("school"),
      avatar: fd.get("childAvatar"),
      avatarImage: fd.get("childAvatarImage") || "",
      avatarType: fd.get("childAvatarType"),
      avatarValue: fd.get("childAvatarValue"),
      hobbies: tagList(fd.get("childHobbies")),
      personalityTags: tagList(fd.get("childTags")),
      learningGoal: fd.get("learningGoal"),
      subjectFocus: tagList(fd.get("childSubjects")),
      parentResponsePref: fd.get("parentResponsePref"),
    });
    showToast("孩子资料已保存");
  });
  const savePriv = () => savePrivacy({
    showScores: $("#p-sc", root).checked,
    showLocation: $("#p-loc", root).checked,
    showSelfie: $("#p-selfie", root).checked,
    allowHideMood: $("#p-mood", root).checked,
    allowParentMistakeDetail: $("#p-mist", root).checked,
    allowExport: $("#p-export", root).checked,
  });
  ["#p-sc", "#p-loc", "#p-selfie", "#p-mood", "#p-mist", "#p-export"].forEach((s) => $(s, root)?.addEventListener("change", savePriv));
  $("#ex-j", root)?.addEventListener("click", () => {
    if (!getPrivacy().allowExport) return showToast("导出功能已在隐私设置中关闭", "error");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    a.download = "fuxun-export.json";
    a.click();
  });
  $("#ex-c", root)?.addEventListener("click", () => {
    if (!getPrivacy().allowExport) return showToast("导出功能已在隐私设置中关闭", "error");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportCsv()], { type: "text/csv" }));
    a.download = "fuxun-records.csv";
    a.click();
  });
  $("#im-j", root)?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (f) { importJson(await f.text()); showToast("导入成功"); render(); }
  });
  $("#seed", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "重置演示数据", message: "将恢复演示家庭样例数据，确定继续吗？", confirmText: "重置" })) {
      seedDemo(); showToast("演示数据已重置：Daniel 家庭 + SAT 题库"); navigate("/home");
    }
  });
  $("#clear", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "清空本地数据", message: "所有家庭、复训、打卡数据将被删除，不可恢复。", confirmText: "清空", danger: true })) {
      clearAllData(); navigate("/welcome");
    }
  });
  $("#logout", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "退出登录", message: "确定退出当前账号？", confirmText: "退出", danger: true })) {
      logout(); navigate("/welcome");
    }
  });
}

function renderPoster(root, id) {
  const record = getRecord(id);
  if (!record) { root.innerHTML = shell("海报", "", "←", `<p class="empty">记录不存在</p>`); return; }
  const priv = { ...getPrivacy(), ...record.privacy };
  root.innerHTML = shell("成长海报", "Growth Poster", "←", `
    <div class="poster-wrap"><img id="pimg" /></div>
    <button class="btn btn--primary btn--block" id="save">保存图片</button>
    <button class="btn btn--sun btn--block" id="share">分享</button>`);
  $("[data-back]", root).onclick = () => navigate("/checkin");
  (async () => {
    record.posterDataUrl = await generatePoster(record, priv, getFamily());
    upsertDailyRecord(record);
    $("#pimg", root).src = record.posterDataUrl;
  })();
  $("#save", root).onclick = () => downloadPoster(record.posterDataUrl, `复训星球-${record.dateKey}.png`);
  $("#share", root).onclick = () => sharePoster(record.posterDataUrl, `复训星球-${record.dateKey}.png`);
}

function pickEncouragement(grade, mood) {
  if (mood?.includes("压力")) return "有压力也没关系，说出来就很勇敢。";
  return grade.letter.startsWith("A") ? "今天节奏很棒，复训星球为你点赞！" : "坚持就是成长，明天继续加油！";
}

/* ── Router ── */
function checkSwUpdate() {
  const key = "fuxun-sw-ver";
  const prev = localStorage.getItem(key);
  const bar = document.getElementById("sw-update-bar");
  if (prev && prev !== SW_CACHE_ID) bar?.classList.remove("hidden");
  if (!prev || prev === SW_CACHE_ID) localStorage.setItem(key, SW_CACHE_ID);
}

function renderBoot() {
  try {
    migrateLegacyStorage();
    checkSwUpdate();
    if (isLoggedIn()) {
      const u = getCurrentUser();
      restoreActiveSession(u?.familyId);
      navigate("/home");
    } else {
      navigate("/welcome");
    }
  } catch (err) {
    console.error("[复训星球] renderBoot failed", err);
    logout();
    navigate("/welcome");
    render();
  }
}

const ROUTES = {
  boot: renderBoot, welcome: renderWelcome, login: renderLogin, join: renderJoin,
  register: renderRegister, home: renderHome, train: renderTrain, "train-play": renderTrainPlay,
  "train-complete": renderTrainComplete, checkin: renderCheckin, coach: renderCoach,
  "coach-parent": renderCoachParent, hearts: renderHearts, profile: renderProfile,
  poster: (r, id) => renderPoster(r, id),
};

function formatBootErrorDetail(err) {
  const name = err?.name || "Error";
  const msg = err?.message || String(err || "未知错误");
  const stack = (err?.stack || msg).split("\n").slice(0, 5).join("\n");
  return [
    `名称: ${name}`,
    `信息: ${msg}`,
    "",
    "Stack (前 5 行):",
    stack,
    "",
    `URL: ${location.href}`,
    `版本: ${APP_VERSION}`,
  ].join("\n");
}

export function showBootError(err) {
  const root = document.getElementById("app-root");
  if (!root) return;
  const detail = formatBootErrorDetail(err);
  root.innerHTML = `<div class="page page--error"><div class="error-card">
    <h1>复训星球加载失败</h1>
    <p>页面加载遇到问题，请刷新或清除缓存后重试。</p>
    <pre class="error-card__detail">${detail.replace(/</g, "&lt;")}</pre>
    <button class="btn btn--primary btn--block" type="button" id="err-reload">重新加载</button>
    <button class="btn btn--ghost btn--block" type="button" id="err-clear">清除本地缓存并重启</button>
  </div></div>`;
  root.querySelector("#err-reload")?.addEventListener("click", () => location.reload());
  root.querySelector("#err-clear")?.addEventListener("click", () => clearClientCachesAndRestart());
}

async function clearClientCachesAndRestart() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  location.href = `${location.pathname}?v=9`;
}

function render() {
  try {
    const route = parseRoute();
    if (!guardRoute(route.path)) return;
    const root = $("#app-root");
    if (!root) return;
    const fn = ROUTES[route.path] || renderBoot;
    if (route.path === "poster") fn(root, route.id);
    else if (route.path === "coach-parent") fn(root, route.id || getCurrentRole());
    else fn(root);
    updateBottomNav(route, root, navigate, getUnreadCount());
  } catch (err) {
    console.error("[复训星球] render failed", err);
    showBootError(err);
  }
}

function bindGlobalHandlers() {
  $("#privacy-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingRecord) return;
    try {
      pendingRecord.privacy = {
        showSelfie: $("#p-selfie").checked,
        showLocation: $("#p-location").checked,
        showScores: $("#p-scores").checked,
      };
      pendingRecord.posterDataUrl = await generatePoster(pendingRecord, pendingRecord.privacy, getFamily());
      upsertDailyRecord(pendingRecord);
      const id = pendingRecord.recordId;
      pendingRecord = null;
      $("#privacy-dialog").close();
      showToast("海报已生成");
      navigate(`/poster/${id}`);
    } catch (err) {
      showBootError(err);
    }
  });
  $("#p-cancel")?.addEventListener("click", () => $("#privacy-dialog").close());
  initConfirmDialog();
  $("#sw-refresh")?.addEventListener("click", () => {
    localStorage.setItem("fuxun-sw-ver", SW_CACHE_ID);
    window.location.reload();
  });
  window.addEventListener("hashchange", render);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("./service-worker.js?v=9");
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          document.getElementById("sw-update-bar")?.classList.remove("hidden");
          reg.waiting?.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (navigator.serviceWorker.controller && !window.__fuxunReloading) {
        window.__fuxunReloading = true;
        window.location.reload();
      }
    });
  } catch { /* offline file open */ }
}

export async function initApp() {
  window.onerror = (_msg, _src, _line, _col, err) => {
    showBootError(err || new Error(String(_msg)));
    return true;
  };
  window.addEventListener("unhandledrejection", (e) => {
    showBootError(e.reason || new Error("Unhandled promise rejection"));
  });

  bindGlobalHandlers();
  await registerServiceWorker();

  try {
    const hash = window.location.hash;
    if (!hash || hash === "#" || hash === "#/boot") {
      renderBoot();
    } else {
      render();
    }
  } catch (err) {
    console.error("[复训星球] boot failed", err);
    showBootError(err);
  }
}