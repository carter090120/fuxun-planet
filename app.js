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
  exportJson, importJson, exportCsv, clearAllData, migrateLegacyStorage, genCode, getStudentMember, getMember, updateMember, updateFamily,
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
import { drawBarChart, drawRing, drawGrowthKline, drawInvestmentKline } from "./charts.js";
import { getGrowthMarket, formatChange, GROWTH_DISCLAIMER, getLevelName } from "./growthMarket.js";
import {
  getParentWalletForViewer, getStudentWalletForViewer, getPointTransactionsForViewer,
  getWalletSummary, rewardStudent, deductStudent,
} from "./pointLedger.js";
import { getHonorItems } from "./honorItems.js";
import {
  FATHER_REWARD_SCENARIOS, FATHER_MEDAL_TYPES, FATHER_REWARD_POINTS,
  buildFatherChildSnapshot, buildFatherAiSuggestion, getFatherTodayWalletStats,
  submitFatherReward, submitFatherSpecialPerformance, canFatherAfford,
} from "./fatherWorkbench.js";
import {
  MOTHER_COMPANION_SCENARIOS, MOTHER_BADGE_TYPES, MOTHER_REWARD_POINTS, FAMILY_REWARD_TYPES,
  buildMotherChildSnapshot, buildMotherAiSuggestion, getMotherTodayWalletStats,
  submitMotherReward, submitMotherSpecialPerformance, canMotherAfford,
} from "./motherWorkbench.js";
import {
  specialPerformanceHTML, readSpecialPerformanceFromForm, formatSpecialPerformanceSummary,
  SPECIAL_CATEGORIES, getSuggestedPoints,
} from "./specialPerformance.js";
import {
  enterTrainingFocusMode, exitTrainingFocusMode, showTrainHint, updateLandscapeHint,
  requestFocusFullscreen, openParseDrawer, closeParseDrawer,
  beginTrainingFromUserGesture, getInstallGuideHTML, detectTrainingEnvironment,
} from "./trainingFocus.js";
import { navigate, parseRoute, guardRoute, updateBottomNav } from "./router.js";
import {
  SYSTEM_ROLE_OPTIONS, DEFAULT_PARENT_SYSTEM_ROLES, FAMILY_ROLE_LABELS,
  formatMemberRoleLine, getMemberEntryPath, getMemberEntryLabel,
  getParentWorkbenchMeta, getMemberSystemRoles,
} from "./memberRoles.js";
import { generatePoster, sharePoster, downloadPoster } from "./poster.js";
import { APP_VERSION, APP_TAGLINE, MODULE_SLOGANS, SW_CACHE_ID, EMPTY_HINTS } from "./version.js";
import {
  showToast, hideToast, showConfirm, initConfirmDialog,
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
          ${TagSelectHTML({ name: "dadSystemRoles", label: "系统角色（可选，可多选）", presets: SYSTEM_ROLE_OPTIONS, selected: d.dadSystemRoles || DEFAULT_PARENT_SYSTEM_ROLES.father })}
          ${TagSelectHTML({ name: "dadTags", label: "性格标签", presets: REG_PRESETS.dadTags, selected: d.dadTags })}
          ${TagSelectHTML({ name: "dadCompanion", label: "陪伴方式", presets: REG_PRESETS.dadCompanion, selected: d.dadCompanion })}
        `)}
        ${MemberFormCard("妈妈", "mother", `
          <label class="field"><span>姓名</span><input name="momName" placeholder="妈妈" value="${d.momName || ""}" /></label>
          ${AvatarPickerHTML({ name: "momAvatar", value: d.momAvatar || "👩", imageValue: d.momAvatarImage || "", label: "头像", presets: AVATAR_PRESETS.mother, avatarType: d.momAvatarType, avatarValue: d.momAvatarValue })}
          ${TagSelectHTML({ name: "momHobbies", label: "爱好", presets: REG_PRESETS.momHobbies, selected: d.momHobbies })}
          ${TagSelectHTML({ name: "momSystemRoles", label: "系统角色（可选，可多选）", presets: SYSTEM_ROLE_OPTIONS, selected: d.momSystemRoles || DEFAULT_PARENT_SYSTEM_ROLES.mother })}
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

function renderMemberHomeCard(m, st, gm) {
  const familyRole = FAMILY_ROLE_LABELS[m.role] || m.role;
  const sysRoles = getMemberSystemRoles(m);
  if (m.role === "student") {
    const subjects = m.subjectFocus?.length ? m.subjectFocus : ["SAT Reading", "Math", "English"];
    const planetLevel = gm?.level || "成长星球";
    const taskParts = [];
    if (st.checkedIn) taskParts.push(`已打卡 ${formatScore(st.totalScore)}分`);
    else taskParts.push("待打卡");
    taskParts.push(st.trainingDone ? "复训完成" : st.trainingProgress);
    return `<article class="member-card member-card--student">
      <div class="member-card__avatar">${renderAvatar(m, "member-card__avatar")}</div>
      <div class="member-card__body">
        <strong>${m.name}${m.nickname ? ` · ${m.nickname}` : ""}</strong>
        <span class="member-role">${familyRole}</span>
        <div class="tag-row">${tagsHTML(["成长星球", planetLevel])}</div>
        <div class="tag-row tag-row--muted">${tagsHTML(subjects)}</div>
        <p class="member-status">今日：${taskParts.join(" · ")}</p>
      </div>
      <button class="btn btn--primary btn--sm" data-enter="${m.memberId}" data-role="${m.role}">${getMemberEntryLabel(m)}</button>
    </article>`;
  }
  const hobbyLine = m.hobbies?.length ? m.hobbies : [];
  return `<article class="member-card member-card--${m.role}">
    <div class="member-card__avatar">${renderAvatar(m, "member-card__avatar")}</div>
    <div class="member-card__body">
      <strong>${m.name}</strong>
      <span class="member-role">${familyRole}</span>
      <div class="tag-row">${tagsHTML(sysRoles)}</div>
      ${hobbyLine.length ? `<div class="tag-row tag-row--muted">${tagsHTML(hobbyLine)}</div>` : ""}
      <p class="member-status">今日：陪伴中</p>
    </div>
    <button class="btn btn--primary btn--sm" data-enter="${m.memberId}" data-role="${m.role}">${getMemberEntryLabel(m)}</button>
  </article>`;
}

/* ── Home ── */
function renderHome(root) {
  const fam = getFamily();
  const user = getCurrentUser();
  const student = getStudentMember();
  const gm = getGrowthMarket(user?.familyId, student?.memberId);
  const members = getMembers().sort((a, b) => {
    const o = { father: 0, mother: 1, student: 2 };
    return o[a.role] - o[b.role];
  });
  const st = todayStatus();
  const unread = getUnreadCount();
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
    <div class="member-list">${members.map((m) => renderMemberHomeCard(m, st, gm)).join("")}</div></div>`;

  $("#logout-top", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "退出登录", message: "确定要退出当前账号吗？", confirmText: "退出", danger: true })) {
      logout(); navigate("/welcome");
    }
  });
  root.querySelectorAll("[data-enter]").forEach((b) => b.addEventListener("click", () => {
    const member = getMember(b.dataset.enter);
    if (!member || !enterAsMember(b.dataset.enter)) return;
    navigate(getMemberEntryPath(member));
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
      <button class="btn btn--primary btn--block" id="go-play">开始复训</button>
      <button class="btn btn--ghost btn--block" id="go-reset">继续拍图导入</button>
    </div>`;
  $("#go-play", panel)?.addEventListener("click", async () => {
    if (await beginTrainingFromUserGesture()) onDone(true);
  });
  $("#go-reset", panel)?.addEventListener("click", () => { resetPhotoWizard(); renderPhotoWizard(panel, onDone); });
}

/* ── Train module ── */
async function startTrainPlayFlow(prepareSession) {
  if (!(await beginTrainingFromUserGesture())) return;
  prepareSession?.();
  navigate("/train-play");
}

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
          <button class="btn btn--primary btn--block">${isTxt ? "导入资料" : "解析题库"}</button></form>`;
        $("#import-f", target).onsubmit = async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          let text = fd.get("text");
          const file = e.target.file?.files?.[0];
          if (file) text = await file.text();
          if (!String(text).trim()) {
            if (isTxt) return showToast("请上传 TXT 文件", "error");
            return showToast("请粘贴题目", "error");
          }
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
      const canResume = active?.pool?.length && (active.paused || active.status === "paused_exit");
      panel.innerHTML = `<p class="hint">剩余错题 <strong>${active?.pool?.length ?? wrong.length}</strong> 道</p>
        <p class="train-start-sub">像课堂闯关一样，把错题清零。</p>
        <button class="btn btn--primary btn--block" id="start-play">开始复训</button>
        ${canResume ? `<button class="btn btn--ghost btn--block" id="resume-play">继续训练</button>` : ""}`;
      $("#start-play", panel)?.addEventListener("click", () => startTrainPlayFlow(() => {
        const u = getCurrentUser();
        const resumed = restoreActiveSession(u?.familyId, todayMat?.materialId);
        if (!resumed) {
          getOrResumeTrainingSession(mistakes, {
            ...todayMat, familyId: u.familyId, studentId: getStudentMember()?.memberId,
          });
        }
      }));
      $("#resume-play", panel)?.addEventListener("click", () => startTrainPlayFlow(() => {
        const u = getCurrentUser();
        restoreActiveSession(u?.familyId, todayMat?.materialId);
      }));
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

function bindTrainExit(session) {
  return async () => {
    if (await showConfirm({ title: "退出训练", message: "当前复训进度会保存，确定退出吗？", confirmText: "退出" })) {
      exitTraining(session);
      await exitTrainingFocusMode();
      showTrainHint("已退出训练", 1500);
      navigate("/train");
    }
  };
}

function bindParseDrawer(fb) {
  if (!fb) return;
  openParseDrawer(`<div class="train-parse__box">
    <h3>${fb.ok ? "答对了" : "再想想"}</h3>
    <p><strong>正确答案：</strong>${fb.key}</p>
    <p><strong>解析：</strong>${fb.explanation}</p>
    <p class="hint"><strong>错因提醒：</strong>${fb.reason}</p>
    <p class="hint">下一步：回到原文定位关键句，标出证据后再选答案。</p>
    <div class="train-parse__actions">
      <button type="button" class="tf-btn" id="parse-close">收起解析</button>
      <button type="button" class="tf-btn tf-btn--primary" id="parse-next">下一题</button>
    </div></div>`);
  const dlg = document.getElementById("train-parse-drawer");
  dlg?.querySelector("#parse-close")?.addEventListener("click", () => closeParseDrawer());
  dlg?.querySelector("#parse-next")?.addEventListener("click", () => {
    closeParseDrawer();
    document.getElementById("next-q")?.click();
  });
}

function renderTrainPlay(root) {
  enterTrainingFocusMode();
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
    exitTrainingFocusMode();
    navigate("/train-complete");
    return;
  }

  if (session.paused) {
    root.innerHTML = `<div class="train-focus train-focus--pause">
      <div class="train-focus__top">
        <button type="button" class="tf-btn" id="home-train">复训首页</button>
        <span class="train-focus__top-mid">训练已暂停</span>
        <button type="button" class="tf-btn" id="quit">退出</button>
      </div>
      <div class="train-focus__center">
        <p class="train-focus__pause-msg">训练已暂停，可稍后继续。</p>
        <button type="button" class="tf-btn tf-btn--primary" id="resume">继续训练</button>
        <button type="button" class="tf-btn" id="exit">退出训练</button>
      </div></div>`;
    $("#resume", root).onclick = () => { resumeTraining(session); showTrainHint("继续训练"); render(); };
    $("#exit", root).onclick = bindTrainExit(session);
    $("#quit", root).onclick = bindTrainExit(session);
    $("#home-train", root).onclick = async () => { await exitTrainingFocusMode(); navigate("/train"); };
    return;
  }

  if (session.showRoundEnd) {
    const last = session.roundResults?.at(-1) || session.currentRound;
    const acc = last?.answered ? Math.round((last.correct / last.answered) * 100) : 0;
    root.innerHTML = `<div class="train-focus train-focus--pause">
      <div class="train-focus__top"><span class="train-focus__top-mid">第 ${last?.roundNumber || session.stats.rounds} 轮结束</span></div>
      <div class="train-focus__center">
        <div class="stat-grid">
          <div class="stat"><span>答对</span><strong>${last?.correct || 0}</strong></div>
          <div class="stat"><span>正确率</span><strong>${acc}%</strong></div>
        </div>
        <p class="hint">剩余错题 ${session.pool.length} 道</p>
        <button type="button" class="tf-btn tf-btn--primary" id="next-round">继续下一轮</button>
      </div></div>`;
    $("#next-round", root).onclick = () => {
      dismissRoundEnd(session);
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
  const sel = showFb?.answer;
  const correctKey = showFb?.key;

  const optHtml = opts.slice(0, 4).map((o, idx) => {
    let cls = "train-opt";
    if (showFb) {
      if (o.key === correctKey) cls += " is-correct";
      else if (o.key === sel) cls += " is-wrong";
      else cls += " is-dim";
    }
    cls += ` train-opt--${idx + 1}`;
    return `<button type="button" class="${cls}" data-a="${o.key}" ${showFb ? "disabled" : ""}>
      <span class="train-opt__key">${o.key}</span><span class="train-opt__text">${o.text || o.key}</span></button>`;
  }).join("");

  root.innerHTML = `<div class="train-focus">
    <div class="train-focus__top">
      <div class="train-focus__top-left">
        <button type="button" class="tf-btn" id="pause" title="暂停">⏸</button>
        <button type="button" class="tf-btn" id="home-train" title="复训首页">⌂</button>
      </div>
      <div class="train-focus__top-mid">Q${qNum} · ${mistake?.questionType || "题型"} · 剩余 ${prog.remaining} 错题</div>
      <div class="train-focus__top-right">
        <button type="button" class="tf-btn tf-btn--ghost" id="enter-focus" title="进入专注模式">专注</button>
        <button type="button" class="tf-btn" id="quit" title="退出">✕</button>
      </div>
    </div>
    <div id="train-landscape-hint" class="train-focus__landscape-hint hidden">
      <strong>建议横屏答题</strong> · 题目和选项会更清楚
    </div>
    <div class="train-stage">
      <section class="train-question-panel">
        <span class="train-type-tag">${mistake?.questionType || "题型"}</span>
        <div class="train-progress"><i style="width:${prog.roundProgress}%"></i></div>
        <p class="train-meta">第 ${prog.rounds} 轮 · 正确率 ${prog.accuracy}% · 🔥${prog.streak}</p>
        <div class="train-stem-scroll"><p class="train-stem">${question?.stem || mistake?.stem || ""}</p></div>
      </section>
      <section class="train-answer-panel">
        <div class="train-opts" id="opts">${optHtml}</div>
      </section>
    </div>
    <div class="train-focus__footer">
      <button type="button" class="tf-btn tf-btn--primary" id="next-q" ${showFb ? "" : "disabled"}>下一题</button>
      <button type="button" class="tf-btn" id="toggle-exp" ${showFb ? "" : "disabled"}>查看解析</button>
      <button type="button" class="tf-btn" data-go="/checkin">打卡</button>
      <button type="button" class="tf-btn" data-go="/coach">优培</button>
    </div></div>`;

  updateLandscapeHint();
  if (!window.__trainOrientBound) {
    window.__trainOrientBound = true;
    window.addEventListener("resize", updateLandscapeHint);
    window.addEventListener("orientationchange", updateLandscapeHint);
  }

  $("#pause", root).onclick = () => { pauseTraining(session); showTrainHint("已暂停"); render(); };
  $("#home-train", root).onclick = async () => { await exitTrainingFocusMode(); navigate("/train"); };
  $("#quit", root).onclick = bindTrainExit(session);
  $("#enter-focus", root).onclick = () => requestFocusFullscreen();
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", async () => {
    await exitTrainingFocusMode();
    navigate(b.dataset.go);
  }));

  if (!showFb) {
    root.querySelectorAll(".train-opt").forEach((btn) => btn.addEventListener("click", () => {
      const ok = gradeTrainingAnswer(question, mistake, btn.dataset.a);
      const key = (mistake?.correctAnswer || question?.answerKey || "").toString().toUpperCase();
      trainPlayFeedback = {
        ok, key, answer: btn.dataset.a,
        explanation: mistake?.explanation || question?.explanation || "回到原文定位关键句。",
        reason: mistake?.mistakeReason || "注意审题与证据对应。",
        qid, mistake, sessionId: session.sessionId,
      };
      trainPlayPhase = "feedback";
      showTrainHint(ok ? "答对了" : "再想想");
      render();
    }));
  }

  $("#next-q", root)?.addEventListener("click", () => {
    closeParseDrawer();
    if (trainPlayFeedback) {
      session = getActiveSession() || session;
      session = submitTrainingAnswer(session, trainPlayFeedback.qid, trainPlayFeedback.answer, trainPlayFeedback.ok, trainPlayFeedback.mistake);
    }
    trainPlayPhase = "answer";
    trainPlayFeedback = null;
    if (!session?.pool?.length || session.status === "completed") {
      exitTrainingFocusMode();
      navigate("/train-complete");
      return;
    }
    render();
  });

  $("#toggle-exp", root)?.addEventListener("click", () => {
    if (trainPlayFeedback) bindParseDrawer(trainPlayFeedback);
    else showTrainHint("请先选择答案");
  });
}

function renderTrainComplete(root) {
  exitTrainingFocusMode();
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

function collectSpecialForm(root) {
  const form = $("#special-f", root);
  if (!form) return checkinDraft.specialPerformance;
  checkinDraft.specialPerformance = readSpecialPerformanceFromForm(form);
  return checkinDraft.specialPerformance;
}

function bindSpecialForm(root) {
  const form = $("#special-f", root);
  if (!form) return;
  const fields = $("#sp-fields", form);
  const suggest = $("#sp-suggest", form);
  const updateSubs = () => {
    const cat = $("#sp-cat", form)?.value;
    const sub = $("#sp-sub", form);
    if (!sub || !cat) return;
    const opts = SPECIAL_CATEGORIES[cat] || [];
    const cur = checkinDraft.specialPerformance?.subcategory || "";
    sub.innerHTML = opts.length
      ? opts.map((s) => `<option value="${s}" ${cur === s ? "selected" : ""}>${s}</option>`).join("")
      : "<option value=\"\">自定义大类，请写在描述里</option>";
  };
  const toggleFields = () => {
    const has = form.querySelector('input[name="spHas"]:checked')?.value;
    fields?.classList.toggle("hidden", has !== "yes" && has !== "unsure");
  };
  const updateSuggest = () => {
    const lv = $("#sp-level", form)?.value;
    if (suggest) suggest.innerHTML = `建议积分：<strong>${lv ? getSuggestedPoints(lv) : "—"}</strong>（需父母确认）`;
  };
  form.querySelectorAll('input[name="spHas"]').forEach((r) => r.addEventListener("change", () => { toggleFields(); collectSpecialForm(root); persistCheckinDraft(); }));
  $("#sp-cat", form)?.addEventListener("change", () => { updateSubs(); collectSpecialForm(root); persistCheckinDraft(); });
  $("#sp-level", form)?.addEventListener("change", () => { updateSuggest(); collectSpecialForm(root); persistCheckinDraft(); });
  form.querySelectorAll("textarea, select").forEach((el) => el.addEventListener("change", () => { collectSpecialForm(root); persistCheckinDraft(); }));
  toggleFields();
  updateSubs();
  updateSuggest();
}

/* ── Student learning hub ── */
function renderStudent(root) {
  const user = getCurrentUser();
  const student = getStudentMember();
  const st = todayStatus();
  const gm = getGrowthMarket(user?.familyId, student?.memberId);
  const unread = getUnreadCount();
  const subjects = student?.subjectFocus?.length ? student.subjectFocus : ["SAT Reading", "Math", "English"];
  const planetLevel = gm?.level || "成长星球";
  const taskParts = [];
  if (st.checkedIn) taskParts.push(`已打卡 ${formatScore(st.totalScore)}分`);
  else taskParts.push("待打卡");
  taskParts.push(st.trainingDone ? "复训完成" : st.trainingProgress);
  if (st.mistakeCount) taskParts.push(`${st.mistakeCount} 道错题`);

  root.innerHTML = shell(`${student?.name || "同学"} 的学习成长`, "Learning Growth", "", `
    <section class="card-block student-hub">
      <div class="wallet-workbench__head">
        ${renderAvatar(student, "wallet-workbench__avatar")}
        <div>
          <h2>${student?.name || "同学"}${student?.nickname ? ` · ${student.nickname}` : ""}</h2>
          <p class="member-role">孩子 · 成长星球 / ${planetLevel}</p>
        </div>
      </div>
      <div class="tag-row">${tagsHTML(subjects)}</div>
      <div class="stat-grid">
        <div class="stat"><span>成长指数</span><strong>${gm?.index ?? "—"}</strong></div>
        <div class="stat"><span>今日任务</span><strong class="student-hub__tasks">${taskParts.join(" · ")}</strong></div>
      </div>
    </section>
    ${unread ? `<button type="button" class="alert-heart" data-go="/hearts">💛 你有 ${unread} 条爱心提醒</button>` : ""}
    ${!st.checkedIn ? RemindCard(EMPTY_HINTS.checkin, "✅") : ""}
    <div class="action-list">
      <button class="btn btn--primary btn--block" data-go="/checkin">${st.checkedIn ? "查看今日打卡" : "去打卡"}</button>
      <button class="btn btn--sun btn--block" data-go="/train">去复训</button>
      <button class="btn btn--ghost btn--block" data-go="/coach-honor">荣誉室</button>
    </div>`, MODULE_SLOGANS.checkin);

  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
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
      specialPerformance: existing?.specialPerformance,
      abilityForm: getAbilityFormItems(existing, {}),
    };
  }
  if (!checkinDraft.abilityForm) {
    checkinDraft.abilityForm = getAbilityFormItems(existing, checkinDraft.abilityForm || {});
  }

  const sections = ["study", "ability", "special", "reflect", "poster"];
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
          <button class="btn btn--primary btn--block" type="button" data-next="special">下一步：今日特别表现</button>
        </form>`;
    } else if (sec === "special") {
      body = `<form class="form" id="special-f">${specialPerformanceHTML(checkinDraft)}
        <button class="btn btn--primary btn--block" type="button" data-next="reflect">下一步：成长复盘</button></form>`;
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

    const checkTabs = sections.map((s) => ({ id: s, label: {
      study: "今日学习", ability: "能力打卡", special: "特别表现", reflect: "成长复盘", poster: "生成海报",
    }[s] }));
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
      if (sec === "special") collectSpecialForm(root);
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
      if (sec === "special") collectSpecialForm(root);
      persistCheckinDraft();
      sec = b.dataset.next;
      sessionStorage.setItem(CHECKIN_SEC_KEY, sec);
      if (b.dataset.next !== "ability") {
        checkinOpenAbility = null;
        checkinAbilityEdited = false;
      }
      paint();
    }));

    if (sec === "special") bindSpecialForm(root);

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
      collectSpecialForm(root);
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

function renderGrowthDashboard(student, gm) {
  const name = student?.name || "孩子";
  if (!gm?.history?.length) {
    return `<section class="growth-board growth-board--empty card-block">
      <div class="growth-board__head">${renderAvatar(student, "growth-board__avatar")}
        <div><h2 class="growth-board__title">${name} 的成长大盘</h2>
        <p class="growth-board__sub">爸爸妈妈的认可、提醒和孩子自己的努力，正在形成成长走势。</p></div>
      </div>
      <h3>成长大盘</h3>
      ${EmptyCard("暂无成长大盘数据。完成一次打卡，或收到爸爸妈妈的优培积分后，就会生成第一条成长走势。", "📈")}
      <div class="action-list">
        <button type="button" class="btn btn--primary btn--block" data-go="/checkin">去打卡</button>
        <button type="button" class="btn btn--ghost btn--block" data-invite-coach>邀请爸爸妈妈优培</button>
      </div>
      <p class="growth-disclaimer">${GROWTH_DISCLAIMER}</p></section>`;
  }

  const chg = formatChange(gm.todayChange, gm.todayChangePct);
  const factors = (gm.todayFactors || []).map((f) => {
    if (f.isText) return `<li><span>${f.label}</span><strong>${f.value}</strong></li>`;
    const sign = f.sign >= 0 ? "+" : "";
    return `<li><span>${f.label}</span><strong class="${f.sign >= 0 ? "is-up" : "is-down"}">${sign}${f.value}</strong></li>`;
  }).join("");

  return `<section class="growth-board card-block">
    <div class="growth-board__head">${renderAvatar(student, "growth-board__avatar")}
      <div><h2 class="growth-board__title">${name} 的成长大盘</h2>
      <p class="growth-board__sub">爸爸妈妈的认可、提醒和孩子自己的努力，正在形成成长走势。</p></div>
    </div>
    <h3 class="growth-board__card-title">成长大盘</h3>
    <div class="growth-stats">
      <div class="growth-stat"><span>成长指数</span><strong class="growth-stat__big">${gm.index}</strong></div>
      <div class="growth-stat"><span>今日涨跌</span><strong class="${chg.up ? "is-up" : "is-down"}">${chg.text}</strong></div>
      <div class="growth-stat"><span>当前等级</span><strong>${gm.level}</strong></div>
    </div>
    <div class="growth-chart-wrap">
      <p class="growth-chart-label">大盘成长 K 线 <span>最近 7 天</span></p>
      <canvas id="growth-kline" class="growth-kline" width="320" height="150" aria-label="大盘成长K线图"></canvas>
    </div>
    <div class="growth-factors"><h4>今日影响因素</h4><ul>${factors}</ul></div>
    <p class="growth-disclaimer">${gm.disclaimer || GROWTH_DISCLAIMER}</p>
  </section>`;
}

function renderCoachWalletHint() {
  return `<p class="hint card-block coach-wallet-hint">爸爸妈妈可在各自工作台使用优培积分给孩子奖励；钱包余额仅在工作台与孩子荣誉室中可见。</p>`;
}

const LEDGER_TYPE_LABELS = { reward: "奖励", deduct: "扣分提醒" };
const LEDGER_FROM_LABELS = { father: "爸爸", mother: "妈妈" };

const HONOR_ITEM_ICONS = {
  card: "💌",
  "praise-letter": "📝",
  medal: "🏅",
  badge: "🎖️",
  "method-card": "💡",
  "father-pact": "🤝",
  "family-reward": "🌸",
  "tomorrow-goal": "🎯",
  "growth-event": "✨",
  certificate: "📜",
  honor: "🎖️",
};

function renderHonorItemsHTML(items) {
  if (!items?.length) return EmptyCard("还没有荣誉物品。爸爸妈妈发放贺卡、表扬信或奖章后会显示在这里。", "🏆");
  return `<div class="honor-items">${items.map((h) =>
    `<article class="honor-item honor-item--${h.itemType}">
      <span class="honor-item__icon">${HONOR_ITEM_ICONS[h.itemType] || "🏆"}</span>
      <div>
        <strong>${h.fromRole === "father" ? "爸爸" : "妈妈"} · ${h.title || h.medalType || h.itemType}</strong>
        <p>${h.content || h.scenario || ""}</p>
        <span class="hint">${h.dateKey} · +${h.points} 分${h.medalType ? ` · ${h.medalType}` : ""}</span>
      </div>
    </article>`
  ).join("")}</div>`;
}

function renderPointLedgerHTML(transactions, emptyMsg = "暂无积分流水记录。") {
  if (!transactions?.length) return EmptyCard(emptyMsg, "📒");
  return `<div class="ledger-list">${transactions.map((t) =>
    `<article class="ledger-item ledger-item--${t.type}">
      <div class="ledger-item__head">
        <strong>${LEDGER_FROM_LABELS[t.fromRole] || ""} · ${LEDGER_TYPE_LABELS[t.type] || t.type} ${t.points} 分</strong>
        <span class="hint">${formatDateTime(new Date(t.createdAt))}</span>
      </div>
      ${t.reason ? `<p>${t.reason}</p>` : ""}
      ${t.advice ? `<p class="hint">建议：${t.advice}</p>` : ""}
    </article>`
  ).join("")}</div>`;
}

function parseCoachActionPayload(action) {
  if (action?.payload && typeof action.payload === "object") return action.payload;
  try {
    return typeof action?.content === "string" ? JSON.parse(action.content) : (action?.content || {});
  } catch {
    return { text: action?.content };
  }
}

function getParentTodayStats(familyId, role, wallet) {
  const acts = getCoachingActions(familyId, formatDateKey()).filter((a) => a.parentRole === role);
  const honorCount = (...labels) => acts.filter((a) => {
    const p = parseCoachActionPayload(a);
    const ht = String(p.honorType || "");
    return labels.some((l) => ht.includes(l));
  }).length;
  const base = { rewarded: wallet?.todayRewarded || 0 };
  if (role === "father") {
    return {
      ...base,
      praiseLetters: honorCount("表扬信") + acts.filter((a) => a.type === "praise").length,
      medals: honorCount("奖章"),
      greetingCards: acts.filter((a) => a.type === "card").length + honorCount("贺卡"),
    };
  }
  return {
    ...base,
    warmCards: acts.filter((a) => a.type === "card").length + honorCount("鼓励贺卡", "鼓励卡"),
    honors: acts.filter((a) => a.type === "stars").length + honorCount("荣誉", "亲子活动"),
    planSuggestions: acts.filter((a) => a.type === "method").length,
  };
}

function renderParentWorkbenchHero(member, role, wallet, wb) {
  const sysRoles = getMemberSystemRoles(member).join(" / ");
  const familyRole = FAMILY_ROLE_LABELS[role] || role;
  const stats = wallet ? getParentTodayStats(getCurrentUser()?.familyId, role, wallet) : null;
  const statGrid = role === "father"
    ? `<div class="parent-workbench-hero__stats">
      <div class="stat"><span>当前钱包积分</span><strong>${wallet?.balance ?? "—"}</strong></div>
      <div class="stat"><span>今日已奖励</span><strong>${stats?.rewarded ?? 0}</strong></div>
      <div class="stat"><span>今日已发表扬信</span><strong>${stats?.praiseLetters ?? 0}</strong></div>
      <div class="stat"><span>今日已发奖章</span><strong>${stats?.medals ?? 0}</strong></div>
      <div class="stat"><span>今日已发贺卡</span><strong>${stats?.greetingCards ?? 0}</strong></div>
    </div>`
    : `<div class="parent-workbench-hero__stats">
      <div class="stat"><span>当前钱包积分</span><strong>${wallet?.balance ?? "—"}</strong></div>
      <div class="stat"><span>今日已奖励</span><strong>${stats?.rewarded ?? 0}</strong></div>
      <div class="stat"><span>今日已发鼓励卡</span><strong>${stats?.warmCards ?? 0}</strong></div>
      <div class="stat"><span>今日已发荣誉</span><strong>${stats?.honors ?? 0}</strong></div>
      <div class="stat"><span>今日已给计划建议</span><strong>${stats?.planSuggestions ?? 0}</strong></div>
    </div>`;

  return `<section class="parent-workbench-hero parent-workbench-hero--${role} card-block">
    <button type="button" class="parent-workbench-hero__back btn btn--ghost btn--sm" data-go="/coach">返回家庭总览</button>
    <div class="parent-workbench-hero__head">
      ${renderAvatar(member, "parent-workbench-hero__avatar")}
      <div>
        <h2 class="parent-workbench-hero__title">${wb?.title || member?.name || ""}</h2>
        <p class="parent-workbench-hero__en">${wb?.subtitle || ""}</p>
        <p class="member-role">${familyRole} · ${sysRoles}</p>
      </div>
    </div>
    ${wallet ? statGrid : `<p class="hint">钱包余额仅在工作台与孩子荣誉室中可见。</p>`}
    ${wallet ? `<button type="button" class="btn btn--ghost btn--block btn--sm" data-toggle-ledger>进入积分记录</button>
    <div id="parent-ledger" class="ledger-panel hidden">
      <h4>积分记录</h4>
      ${renderPointLedgerHTML([], "你还没有积分流水记录。")}
    </div>` : ""}
  </section>`;
}

function renderStudentWalletPanel(student, wallet, gm) {
  if (!wallet) return "";
  const level = gm?.level || getLevelName(gm?.index ?? gm?.currentIndex);
  return `<section class="card-block wallet-student">
    <div class="wallet-workbench__head">
      ${renderAvatar(student, "wallet-workbench__avatar")}
      <div><h2>${student?.name || "孩子"} 成长积分</h2>
      <p class="hint">当前余额与成长资产（模拟）</p></div>
    </div>
    <div class="stat-grid">
      <div class="stat"><span>当前余额</span><strong>${wallet.balance}</strong></div>
      <div class="stat"><span>今日净变化</span><strong class="${(wallet.todayNetChange || 0) >= 0 ? "is-up" : "is-down"}">${(wallet.todayNetChange || 0) >= 0 ? "+" : ""}${wallet.todayNetChange || 0}</strong></div>
      <div class="stat"><span>已投资积分</span><strong>${wallet.totalInvested || 0}</strong></div>
      <div class="stat"><span>当前投资价值</span><strong>${wallet.currentInvestmentValue || 0}</strong></div>
      <div class="stat"><span>总成长资产</span><strong>${wallet.totalGrowthAssets ?? wallet.balance}</strong></div>
      <div class="stat"><span>当前等级</span><strong>${level || "—"}</strong></div>
    </div>
  </section>`;
}

function renderAdminWalletOverview(familyId) {
  const summary = getWalletSummary(familyId);
  return `<section class="card-block wallet-admin">
    <h3>三方钱包总览（管理员）</h3>
    <div class="stat-grid">
      <div class="stat"><span>爸爸优培积分</span><strong>${summary.father?.balance ?? "—"}</strong></div>
      <div class="stat"><span>妈妈优培积分</span><strong>${summary.mother?.balance ?? "—"}</strong></div>
      <div class="stat"><span>孩子成长积分</span><strong>${summary.student?.balance ?? "—"}</strong></div>
    </div>
    <p class="hint">普通优培页面仍按角色展示；完整数据可通过导出 JSON 查看。</p>
  </section>`;
}

function bindParentLedgerToggle(root, familyId, userRole) {
  const panel = $("#parent-ledger", root);
  const btn = $("[data-toggle-ledger]", root);
  if (!panel || !btn) return;
  const txs = getPointTransactionsForViewer(familyId, userRole, { limit: 30 });
  panel.innerHTML = `<h4>积分记录</h4>${renderPointLedgerHTML(txs, "你还没有积分流水记录。")}`;
  btn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    btn.textContent = panel.classList.contains("hidden") ? "进入积分记录" : "收起积分记录";
  });
}

function renderHonorEntry() {
  return `<section class="card-block honor-entry">
    <h3>🏆 孩子荣誉室</h3>
    <p class="hint">查看大盘成长 K 线与投资 K 线，回顾成长与目标投入走势。</p>
    <button type="button" class="btn btn--sun btn--block" data-go="/coach-honor">进入荣誉室</button>
  </section>`;
}

function coachActionLabel(action) {
  const p = action.payload || {};
  const toolMap = {
    card: "鼓励卡", "praise-letter": "表扬信", medal: "奖章", badge: "荣誉徽章",
    "method-card": "方法卡", "father-pact": "父子约定", "family-reward": "亲子奖励",
    "tomorrow-goal": "明日小目标", plan: "计划建议", reward: "积分奖励",
    praise: "认可", method: "方法", stars: "评分", deduct: "扣分提醒",
    pact: "约定", honor: "荣誉",
  };
  if (p.tool) return toolMap[p.tool] || p.title || p.tool;
  return toolMap[action.type] || action.type;
}

function renderRecentCoachActions(familyId) {
  const acts = getCoachingActions(familyId).slice(0, 8);
  if (!acts.length) return `<section class="card-block"><h3>最近优培记录</h3>${EmptyCard("还没有优培记录。爸爸妈妈发送鼓励后，会显示在这里。", "💛")}</section>`;
  return `<section class="card-block"><h3>最近优培记录</h3>
    <div class="coach-recent-list">${acts.map((a) => {
      const scen = a.payload?.scenario ? ` · ${a.payload.scenario}` : "";
      return `<article class="coach-recent-item"><strong>${a.parentRole === "father" ? "Ryan" : "Sara"} · ${coachActionLabel(a)}${scen}</strong>
      <span>${a.dateKey}</span></article>`;
    }).join("")}</section>`;
}

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
  const wb = getParentWorkbenchMeta(role, member);
  const sent = hasParentSentToday(role);
  const tip = wb?.tagline || "";
  return `<article class="coach-card coach-card--${role}">
    <div class="coach-card__head">${renderAvatar(member, "coach-card__avatar")}
      <div><h3>${wb?.title || member.name}</h3>
      <span class="member-role">${formatMemberRoleLine(member)}</span>
      <div class="tag-row">${tagsHTML(member.personalityTags)}</div></div>
    </div>
    ${readonly ? `<p class="hint">今日是否已发送鼓励：${sent ? "是" : "否"}</p>` : `<p class="hint">${tip}</p><p class="hint">今日鼓励：${sent ? "已发送 ✓" : "尚未发送"}</p>
    <button class="btn btn--primary btn--block" data-enter-coach="${role}">进入工作台</button>`}
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
  const user = getCurrentUser();
  const st = todayStatus();
  const student = getStudentMember();
  const father = getMembers().find((m) => m.role === "father");
  const mother = getMembers().find((m) => m.role === "mother");
  const gm = getGrowthMarket(user?.familyId, student?.memberId);

  let tail = "";
  if (role === "student" && !st.hasEncouragement) tail += EmptyCard(EMPTY_HINTS.hearts, "💛");
  tail += `<div class="member-list">${renderParentEntryCard(father, "father", role === "student")}${renderParentEntryCard(mother, "mother", role === "student")}</div>`;

  const body = `${renderGrowthDashboard(student, gm)}
    ${renderCoachSummary(student, st)}
    ${renderHonorEntry()}
    ${renderRecentCoachActions(user?.familyId)}
    ${tail}`;

  root.innerHTML = shell("家庭优培总览", "Family Coaching Overview", "", body, MODULE_SLOGANS.coach);
  root.querySelectorAll("[data-enter-coach]").forEach((b) => b.addEventListener("click", () => {
    const targetRole = b.dataset.enterCoach;
    const cur = getCurrentRole();
    if (cur !== "student" && cur !== "admin" && cur !== targetRole) {
      showToast("请进入自己的工作台使用优培积分", "info");
      return;
    }
    navigate(`/coach/${targetRole}`);
  }));
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  $("[data-invite-coach]", root)?.addEventListener("click", () => showToast("请邀请爸爸妈妈进入优培栏目发送鼓励", "info"));
  if (gm?.history?.length) {
    setTimeout(() => drawGrowthKline($("#growth-kline", root), gm.history, { animate: true }), 50);
  }
}

function renderHonorSection(title, items, emptyMsg, icon = "🏆") {
  return `<section class="card-block honor-section">
    <h3>${title}</h3>
    ${items?.length ? renderHonorItemsHTML(items) : EmptyCard(emptyMsg, icon)}
  </section>`;
}

function renderSpecialPerformanceHonor(familyId, studentId) {
  const rec = getTodayRecord(familyId);
  const sp = rec?.specialPerformance;
  const events = getHonorItems(familyId, { studentId }).filter((h) => h.specialPerformance || h.itemType === "growth-event");
  const lines = [];
  if (sp?.hasPerformance && sp.hasPerformance !== "no") {
    lines.push(`<article class="honor-item"><span class="honor-item__icon">✨</span><div>
      <strong>今日特别表现（打卡）</strong><p>${formatSpecialPerformanceSummary(sp).replace(/\n/g, "<br>")}</p>
      ${sp.confirmedReward ? `<span class="hint">已确认 +${sp.confirmedReward.points} 分（${sp.confirmedReward.fromRole === "father" ? "爸爸" : "妈妈"}）</span>` : "<span class=\"hint\">等待爸爸妈妈确认</span>"}
    </div></article>`);
  }
  events.forEach((e) => {
    lines.push(`<article class="honor-item"><span class="honor-item__icon">✨</span><div>
      <strong>${e.fromRole === "father" ? "爸爸" : "妈妈"}确认 · ${e.title}</strong>
      <p>${e.content || ""}</p><span class="hint">${e.dateKey}${e.points ? ` · +${e.points} 分` : ""}</span>
    </div></article>`);
  });
  if (!lines.length) return EmptyCard("完成打卡并填写特别表现后，会显示在这里。", "✨");
  return `<div class="honor-items">${lines.join("")}</div>`;
}

function renderCoachHonor(root) {
  const student = getStudentMember();
  const user = getCurrentUser();
  const role = getCurrentRole();
  const fid = user?.familyId;
  const gm = getGrowthMarket(fid, student?.memberId);
  const inv = gm?.investments?.[0];
  const wallet = getStudentWalletForViewer(fid, student?.memberId, role);
  const allHonor = getHonorItems(fid, { studentId: student?.memberId });
  const fatherTxs = getPointTransactionsForViewer(fid, "father", { limit: 15 });
  const motherTxs = getPointTransactionsForViewer(fid, "mother", { limit: 15 });
  const allTxs = getPointTransactionsForViewer(fid, role, { limit: 30 });

  const walletBlock = wallet
    ? renderStudentWalletPanel(student, wallet, gm)
    : `<p class="hint card-block">成长积分余额仅在孩子登录荣誉室时可见。</p>`;

  root.innerHTML = shell("孩子荣誉室", "Honor Room", "←", `
    <p class="hint">记录成长资产、荣誉与父母陪伴，看见每一次被看见的努力。</p>
    ${walletBlock}
    <section class="card-block">
      <h3>成长大盘 K 线</h3>
      <p class="hint">反映爸爸妈妈加分、点评和任务完成度。</p>
      ${gm?.history?.length
    ? `<canvas id="honor-market-kline" class="growth-kline" width="320" height="150"></canvas>`
    : EmptyCard("暂无大盘数据", "📈")}
    </section>
    <section class="card-block">
      <h3>投资 K 线</h3>
      <p class="hint">${inv ? `目标：${inv.goal} · 投入 ${inv.invested} → 当前 ${inv.current}` : "把孩子积分投进目标后的模拟涨跌。"}</p>
      ${inv?.history?.length
    ? `<canvas id="honor-invest-kline" class="growth-kline" width="320" height="150"></canvas>`
    : EmptyCard("暂无投资走势", "🎯")}
    </section>
    ${renderHonorSection("我的贺卡", allHonor.filter((h) => h.itemType === "card"), "还没有收到贺卡。", "💌")}
    ${renderHonorSection("我的表扬信", allHonor.filter((h) => h.itemType === "praise-letter"), "还没有收到表扬信。", "📝")}
    ${renderHonorSection("我的奖章", allHonor.filter((h) => h.itemType === "medal" || h.itemType === "badge"), "还没有收到奖章或荣誉徽章。", "🏅")}
    ${renderHonorSection("我的证书", allHonor.filter((h) => h.itemType === "certificate"), "还没有收到证书。", "📜")}
    <section class="card-block honor-section"><h3>我的特别表现</h3>${renderSpecialPerformanceHonor(fid, student?.memberId)}</section>
    <section class="card-block"><h3>爸爸奖励记录</h3>${renderPointLedgerHTML(fatherTxs, "还没有来自爸爸的积分奖励记录。")}</section>
    <section class="card-block"><h3>妈妈鼓励记录</h3>${renderPointLedgerHTML(motherTxs, "还没有来自妈妈的鼓励记录。")}</section>
    <section class="card-block"><h3>积分流水</h3>${renderPointLedgerHTML(allTxs, "还没有积分流水记录。")}</section>
    <p class="growth-disclaimer">${GROWTH_DISCLAIMER}</p>`);

  $("[data-back]", root).onclick = () => navigate("/coach");
  setTimeout(() => {
    if (gm?.history?.length) drawGrowthKline($("#honor-market-kline", root), gm.history, { animate: true });
    if (inv?.history?.length) drawInvestmentKline($("#honor-invest-kline", root), inv.history, { animate: true });
  }, 50);
}

function markSpecialPerformanceRewarded(record, points, role) {
  if (!record?.recordId) return;
  upsertDailyRecord({
    ...record,
    specialPerformance: {
      ...record.specialPerformance,
      confirmedReward: { points, fromRole: role, at: new Date().toISOString() },
    },
  });
}

function notifyStudentFromParent(role, member, student, payload) {
  const users = requireUsers();
  const su = users.find((u) => u.memberId === student?.memberId);
  if (!su) return;
  sendHeartNotification({
    toUserId: su.userId,
    fromRole: role,
    fromName: member?.name,
    cardTitle: payload.title || "来自家人的鼓励",
    cardText: payload.content || payload.reason || "",
    cardStyle: payload.style || "温暖陪伴",
    rewardType: payload.rewardType || "精神鼓励",
    rewardName: payload.rewardName,
    rewardCondition: payload.rewardCond,
    rewardFulfilled: payload.fulfilled,
  });
}

function submitParentReward(role, { points, reason, relatedRecordId, honorType, notify, cardPayload }) {
  const pts = Number(points);
  if (!pts || pts <= 0) return { ok: false, error: "请填写奖励积分" };
  const student = getStudentMember();
  const rec = getTodayRecord();
  const reasonText = [reason, honorType].filter(Boolean).join(" · ") || "优培积分奖励";
  const result = rewardStudent({
    parentRole: role,
    points: pts,
    reason: reasonText,
    relatedRecordId: relatedRecordId || rec?.recordId || null,
  });
  if (!result.ok) return result;
  saveCoach(role, "reward", { points: pts, reason: reasonText, honorType });
  const member = getMembers().find((m) => m.role === role);
  if (notify) {
    notifyStudentFromParent(role, member, student, cardPayload || { reason: reasonText, title: honorType || "积分奖励" });
  }
  if (rec?.specialPerformance?.suggestedPoints && pts === rec.specialPerformance.suggestedPoints) {
    markSpecialPerformanceRewarded(rec, pts, role);
  }
  return result;
}

function renderSpecialPerformanceParentCard(record, role) {
  const sp = record?.specialPerformance;
  if (!sp?.hasPerformance) {
    return `<section class="card-block"><h3>今日特别表现</h3><p class="hint">孩子今日尚未填写特别表现。</p></section>`;
  }
  if (sp.hasPerformance === "no") {
    return `<section class="card-block"><h3>今日特别表现</h3><p class="hint">孩子填写：今天没有特别表现。</p></section>`;
  }
  const summary = formatSpecialPerformanceSummary(sp);
  const confirmed = sp.confirmedReward;
  const suggested = sp.suggestedPoints || 0;
  return `<section class="card-block special-perf-parent">
    <h3>今日特别表现</h3>
    <p>${summary.replace(/\n/g, "<br>")}</p>
    ${confirmed
    ? `<p class="hint">已确认奖励 +${confirmed.points} 分（${confirmed.fromRole === "father" ? "爸爸" : "妈妈"}）</p>`
    : `<div class="action-list">
      ${role === "father"
    ? `<button type="button" class="btn btn--sun btn--sm" data-sp-act="medal">发奖章</button>
       <button type="button" class="btn btn--ghost btn--sm" data-sp-act="praise-letter">写表扬信</button>`
    : `<button type="button" class="btn btn--sun btn--sm" data-sp-act="warm-card">发鼓励卡</button>
       <button type="button" class="btn btn--ghost btn--sm" data-sp-act="family-reward">亲子奖励</button>`}
      <button type="button" class="btn btn--primary btn--sm" data-sp-reward="${suggested}">确认建议积分 (+${suggested})</button>
    </div>`}
  </section>`;
}

function renderParentPointsPanel(role, record) {
  const spPts = record?.specialPerformance?.suggestedPoints || "";
  const defaultPts = spPts || (role === "father" ? 100 : 200);
  if (role === "father") {
    return `<section class="card-block parent-points">
      <h3>积分奖励与提醒</h3>
      <form class="form" id="reward-form">
        <label class="field"><span>奖励积分</span><input name="points" type="number" min="1" max="500" value="${defaultPts}" /></label>
        <label class="field"><span>奖励原因</span><textarea name="reason" rows="2" placeholder="对应哪项表现？"></textarea></label>
        <label class="field"><span>对应表现</span><input name="performance" placeholder="如今日复训清零、主动背词汇" /></label>
        <label class="field"><span>荣誉类型（可选）</span>
          <select name="honorType"><option value="">无</option><option>表扬信</option><option>奖章</option><option>学习方法卡</option></select></label>
        <button class="btn btn--primary btn--block">发放积分奖励</button>
      </form>
      <form class="form" id="deduct-form">
        <h4>扣分提醒</h4>
        <label class="field"><span>扣分分值</span><input name="points" type="number" min="1" max="200" value="20" /></label>
        <label class="field"><span>扣分原因</span><input name="reason" required /></label>
        <label class="field"><span>改进建议（必填）</span><textarea name="advice" rows="2" required></textarea></label>
        <button class="btn btn--ghost btn--block">发送扣分提醒</button>
      </form>
    </section>`;
  }
  return `<section class="card-block parent-points">
    <h3>陪伴奖励与荣誉</h3>
    <form class="form" id="reward-form">
      <label class="field"><span>奖励积分</span><input name="points" type="number" min="1" max="500" value="${defaultPts}" /></label>
      <label class="field"><span>鼓励原因</span><textarea name="reason" rows="2"></textarea></label>
      <label class="field"><span>鼓励卡标题</span><input name="cardTitle" placeholder="今天也很棒" /></label>
      <label class="field"><span>鼓励卡内容</span><textarea name="cardContent" rows="2"></textarea></label>
      <label class="toggle"><input type="checkbox" name="sendNotify" checked /><span>同时发送爱心提醒</span></label>
      <button class="btn btn--sun btn--block">发放积分并发送鼓励</button>
    </form>
    <form class="form" id="deduct-form">
      <h4>扣分提醒</h4>
      <label class="field"><span>扣分分值</span><input name="points" type="number" min="1" max="200" value="20" /></label>
      <label class="field"><span>提醒原因</span><input name="reason" required /></label>
      <label class="field"><span>陪伴建议（必填）</span><textarea name="advice" rows="2" required></textarea></label>
      <button class="btn btn--ghost btn--block">发送扣分提醒</button>
    </form>
  </section>`;
}

function bindParentPointsForms(root, role) {
  const rec = getTodayRecord();
  $("#reward-form", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const honorType = fd.get("honorType") || "";
    const performance = fd.get("performance") || "";
    const reason = [fd.get("reason"), performance].filter(Boolean).join(" · ");
    const notify = role === "mother" && fd.get("sendNotify") === "on";
    const r = submitParentReward(role, {
      points: fd.get("points"),
      reason,
      honorType,
      notify,
      cardPayload: {
        title: fd.get("cardTitle") || honorType || "鼓励卡",
        content: fd.get("cardContent") || reason,
        style: "温暖陪伴",
        rewardType: honorType || "精神鼓励",
      },
    });
    if (!r.ok) return showToast(r.error, "error");
    showToast(r.message || "积分奖励已发放");
    render();
  });
  $("#deduct-form", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = deductStudent({
      parentRole: role,
      points: fd.get("points"),
      reason: fd.get("reason"),
      advice: fd.get("advice"),
      relatedRecordId: rec?.recordId,
    });
    if (!r.ok) return showToast(r.error, "error");
    saveCoach(role, "deduct", { points: fd.get("points"), reason: fd.get("reason") });
    showToast(r.message || "扣分提醒已记录");
    render();
  });
  root.querySelectorAll("[data-sp-reward]").forEach((b) => b.addEventListener("click", () => {
    const pts = Number(b.dataset.spReward);
    const spReason = rec?.specialPerformance
      ? `特别表现：${rec.specialPerformance.category || ""} ${rec.specialPerformance.subcategory || ""}`.trim()
      : "今日特别表现";
    const r = submitParentReward(role, { points: pts, reason: spReason, notify: role === "mother", cardPayload: { title: "特别表现奖励", content: spReason } });
    if (!r.ok) return showToast(r.error, "error");
    markSpecialPerformanceRewarded(rec, pts, role);
    showToast(`已确认特别表现奖励 +${pts} 分`);
    render();
  }));
  root.querySelectorAll("[data-sp-act]").forEach((b) => b.addEventListener("click", () => {
    const act = b.dataset.spAct;
    const ptsMap = { medal: 500, "praise-letter": 500, "warm-card": 200, "family-reward": 300 };
    const honorMap = { medal: "奖章", "praise-letter": "表扬信", "warm-card": "鼓励贺卡", "family-reward": "亲子活动" };
    const pts = ptsMap[act] || 200;
    const spReason = formatSpecialPerformanceSummary(rec?.specialPerformance);
    const r = submitParentReward(role, {
      points: pts,
      reason: spReason,
      honorType: honorMap[act],
      notify: true,
      cardPayload: { title: honorMap[act], content: spReason, rewardType: honorMap[act] },
    });
    if (!r.ok) return showToast(r.error, "error");
    markSpecialPerformanceRewarded(rec, pts, role);
    showToast(`已发放 ${honorMap[act]} +${pts} 分`);
    render();
  }));
}

function renderFatherWalletHero(member, wallet, wb, familyId) {
  const w = wallet ? getFatherTodayWalletStats(familyId, wallet) : null;
  const sysRoles = getMemberSystemRoles(member).join(" / ");
  return `<section class="parent-workbench-hero parent-workbench-hero--father card-block father-wallet">
    <button type="button" class="parent-workbench-hero__back btn btn--ghost btn--sm" data-go="/coach">返回家庭总览</button>
    <div class="parent-workbench-hero__head">
      ${renderAvatar(member, "parent-workbench-hero__avatar")}
      <div>
        <h2 class="parent-workbench-hero__title">${wb?.title || member?.name || ""}</h2>
        <p class="parent-workbench-hero__en">${wb?.subtitle || "Growth Investor"}</p>
        <p class="member-role">爸爸 · ${sysRoles}</p>
        <p class="hint father-mission">${wb?.tagline || ""}</p>
      </div>
    </div>
    ${wallet ? `<div class="father-wallet__stats parent-workbench-hero__stats">
      <div class="stat"><span>当前可用优培积分</span><strong>${w.balance}</strong></div>
      <div class="stat"><span>今日已发积分</span><strong>${w.todaySent}</strong></div>
      <div class="stat"><span>今日剩余可发</span><strong>${w.todayRemaining}</strong></div>
      <div class="stat"><span>累计奖励积分</span><strong>${w.totalRewarded}</strong></div>
      <div class="stat"><span>今日贺卡</span><strong>${w.cards}</strong></div>
      <div class="stat"><span>今日表扬信</span><strong>${w.praiseLetters}</strong></div>
      <div class="stat"><span>今日奖章</span><strong>${w.medals}</strong></div>
      <div class="stat"><span>今日扣分提醒</span><strong>${w.deductReminders}</strong></div>
    </div>
    <p class="hint">贺卡 / 表扬信 / 奖章默认各消耗 500 积分，余额不足时无法发送。</p>
    <button type="button" class="btn btn--ghost btn--block btn--sm" data-toggle-ledger>进入积分记录</button>
    <div id="parent-ledger" class="ledger-panel hidden">
      <h4>积分记录</h4>
      ${renderPointLedgerHTML([], "你还没有积分流水记录。")}
    </div>` : `<p class="hint">钱包余额仅在工作台与孩子荣誉室中可见。</p>`}
  </section>`;
}

function renderFatherChildDigest(snapshot, student) {
  const s = snapshot;
  return `<section class="card-block father-digest">
    <h3>${student?.name || "孩子"} 今日关键结果</h3>
    <p class="hint">成长投资官只读摘要，不在此填写孩子打卡。</p>
    <div class="father-digest__stats stat-grid">
      <div class="stat"><span>今日总分</span><strong>${s.totalScore != null ? formatScore(s.totalScore) : "—"}</strong></div>
      <div class="stat"><span>今日完成率</span><strong>${s.completionRate != null ? `${s.completionRate}%` : "—"}</strong></div>
      <div class="stat"><span>今日错题数</span><strong>${s.mistakeCount}</strong></div>
      <div class="stat"><span>剩余错题数</span><strong>${s.remainingMistakes}</strong></div>
      <div class="stat"><span>复训是否清零</span><strong>${s.retrainCleared ? "已清零" : "未清零"}</strong></div>
      <div class="stat"><span>训练正确率</span><strong>${s.trainingAccuracy != null ? `${s.trainingAccuracy}%` : "—"}</strong></div>
      <div class="stat"><span>连续打卡天数</span><strong>${s.checkinStreak} 天</strong></div>
    </div>
    <article class="father-digest__block">
      <h4>今日特别表现</h4>
      <p>${String(s.specialPerformanceText || "—").replace(/\n/g, "<br>")}</p>
    </article>
    <article class="father-digest__block">
      <h4>今日最值得投资的成长行为</h4>
      <p>${pickFatherInvestLine(s)}</p>
    </article>
  </section>`;
}

function pickFatherInvestLine(snapshot) {
  const ai = buildFatherAiSuggestion(snapshot);
  return ai.highlight || "—";
}

function renderFatherAiCard(ai) {
  return `<section class="card-block father-ai">
    <h3>AI 给爸爸的投资建议</h3>
    <p><strong>今日最值得投资的一点</strong><br>${ai.highlight}</p>
    <div class="father-ai__meta">
      <span>建议方式：${ai.rewardMethod}</span>
      <span>建议积分：${ai.suggestedPoints}</span>
      <span>${ai.noDeduct ? "不建议扣分" : "可视情况提醒"}</span>
    </div>
    <p class="hint"><strong>给爸爸：</strong>${ai.fatherMessage}</p>
    <p class="hint"><strong>给孩子：</strong>${ai.childMessage}</p>
    <button type="button" class="btn btn--sun btn--sm" data-father-apply-ai>采纳建议并预填</button>
  </section>`;
}

function renderFatherScenarios(selected = "", category = "learning") {
  const cats = Object.entries(FATHER_REWARD_SCENARIOS);
  const tabs = cats.map(([key, c]) =>
    `<button type="button" class="father-scene-tab ${key === category ? "is-active" : ""}" data-scene-cat="${key}">${c.label}</button>`
  ).join("");
  const active = FATHER_REWARD_SCENARIOS[category] || FATHER_REWARD_SCENARIOS.learning;
  const chips = active.items.map((item) =>
    `<button type="button" class="father-scene-chip ${selected === item ? "is-selected" : ""}" data-scene="${item}">${item}</button>`
  ).join("");
  return `<section class="card-block father-scenes">
    <h3>爸爸奖励场景</h3>
    <p class="hint">选择今天最值得正式认可的成长瞬间，会写入奖励记录。</p>
    <input type="hidden" id="father-scenario" value="${selected}" />
    <input type="hidden" id="father-scenario-cat" value="${category}" />
    <div class="father-scene-tabs">${tabs}</div>
    <div class="father-scene-chips" id="father-scene-chips">${chips}</div>
  </section>`;
}

function renderFatherToolbox(wallet) {
  const tools = [
    { id: "card", icon: "💌", name: "发爸爸贺卡", pts: FATHER_REWARD_POINTS.card, desc: "轻量鼓励、完成任务、复训进步" },
    { id: "praise-letter", icon: "📝", name: "写爸爸表扬信", pts: FATHER_REWARD_POINTS["praise-letter"], desc: "特别表现、高光时刻、坚持突破" },
    { id: "medal", icon: "🏅", name: "发爸爸奖章", pts: FATHER_REWARD_POINTS.medal, desc: "错题清零、自驱学习、家庭责任" },
    { id: "method-card", icon: "💡", name: "发方法卡", pts: FATHER_REWARD_POINTS["method-card"], desc: "错题未清零、需要下一步建议" },
    { id: "father-pact", icon: "🤝", name: "发父子约定", pts: FATHER_REWARD_POINTS["father-pact"], desc: "设定明天或本周目标" },
    { id: "deduct", icon: "⚠️", name: "扣分提醒", pts: "≤200", desc: "必须填写原因、建议与明天怎么做" },
  ];
  return `<section class="card-block father-toolbox">
    <h3>爸爸奖励工具箱</h3>
    <div class="father-tool-grid">${tools.map((t) => {
      const afford = t.id === "deduct" || canFatherAfford(t.id, wallet);
      return `<button type="button" class="father-tool-btn ${afford ? "" : "is-disabled"}" data-father-tool="${t.id}" ${afford ? "" : "disabled"}>
        <span class="father-tool-btn__icon">${t.icon}</span>
        <strong>${t.name}</strong>
        <span class="hint">${t.desc}</span>
        <span class="father-tool-btn__pts">${t.id === "deduct" ? "上限 200" : `默认 ${t.pts} 分`}</span>
      </button>`;
    }).join("")}</div>
    <div id="father-tool-form" class="father-tool-form hidden"></div>
  </section>`;
}

function renderParentHonorLink(hint) {
  return `<section class="card-block honor-entry">
    <h3>🏆 孩子荣誉室</h3>
    <p class="hint">${hint}</p>
    <button type="button" class="btn btn--sun btn--block" data-go="/coach-honor">进入荣誉室</button>
  </section>`;
}

function renderSpecialPerformanceWorkbenchCard(record, role) {
  const sp = record?.specialPerformance;
  if (!sp?.hasPerformance) {
    return `<section class="card-block sp-workbench"><h3>今日特别表现</h3><p class="hint">孩子今日尚未填写特别表现。打卡后会同步到父母工作台与荣誉室。</p></section>`;
  }
  if (sp.hasPerformance === "no") {
    return `<section class="card-block sp-workbench"><h3>今日特别表现</h3><p class="hint">孩子填写：今天没有特别表现。</p></section>`;
  }
  const summary = formatSpecialPerformanceSummary(sp);
  const confirmed = sp.confirmedReward;
  const suggested = sp.suggestedPoints || 0;
  const fatherBtns = role === "father" && !confirmed
    ? `<div class="action-list">
      <button type="button" class="btn btn--sun btn--sm" data-sp-tool="medal">发奖章 (+500)</button>
      <button type="button" class="btn btn--ghost btn--sm" data-sp-tool="praise-letter">写表扬信 (+500)</button>
      <button type="button" class="btn btn--primary btn--sm" data-sp-tool="card">发贺卡 (+500)</button>
      <button type="button" class="btn btn--ghost btn--sm" data-sp-pts="${suggested}">确认建议积分 (+${suggested})</button>
    </div>` : "";
  const motherBtns = role === "mother" && !confirmed
    ? `<div class="action-list">
      <button type="button" class="btn btn--sun btn--sm" data-sp-tool="card">发鼓励卡 (+500)</button>
      <button type="button" class="btn btn--ghost btn--sm" data-sp-tool="praise-letter">温暖表扬信 (+500)</button>
      <button type="button" class="btn btn--sun btn--sm" data-sp-tool="badge">荣誉徽章 (+500)</button>
      <button type="button" class="btn btn--ghost btn--sm" data-sp-tool="family-reward">亲子奖励 (+300)</button>
      <button type="button" class="btn btn--primary btn--sm" data-sp-pts="${suggested}">确认建议积分 (+${suggested})</button>
    </div>` : "";
  return `<section class="card-block sp-workbench">
    <h3>今日特别表现</h3>
    <p>${summary.replace(/\n/g, "<br>")}</p>
    ${confirmed
    ? `<p class="hint">已确认奖励 +${confirmed.points} 分（${confirmed.fromRole === "father" ? "Ryan" : "Sara"}）· 已同步荣誉室与成长大盘</p>`
    : `${fatherBtns}${motherBtns}<p class="hint">确认后可变为积分、贺卡、表扬信、奖章或亲子奖励，并写入成长事件。</p>`}
  </section>`;
}

function bindSpecialPerformanceWorkbench(root, record, role, ctx) {
  const { member, student, user } = ctx;
  root.querySelectorAll("[data-sp-tool]").forEach((b) => b.addEventListener("click", () => {
    const tool = b.dataset.spTool;
    const submit = role === "father" ? submitFatherSpecialPerformance : submitMotherSpecialPerformance;
    const r = submit({
      tool,
      record,
      member,
      student,
      familyId: user?.familyId,
      points: 500,
      badgeType: tool === "badge" ? "温暖坚持星" : (tool === "medal" ? "今日高光星" : ""),
    });
    if (!r.ok) return showToast(r.error, "error");
    markSpecialPerformanceRewarded(record, r.points || 500, role);
    notifyStudentFromParent(role, member, student, { title: "特别表现确认", content: formatSpecialPerformanceSummary(record?.specialPerformance), rewardType: tool });
    showToast(`特别表现已确认，+${r.points || 500} 分`);
    render();
  }));
  root.querySelectorAll("[data-sp-pts]").forEach((b) => b.addEventListener("click", () => {
    const pts = Number(b.dataset.spPts);
    const submit = role === "father" ? submitFatherSpecialPerformance : submitMotherSpecialPerformance;
    const r = submit({ tool: role === "father" ? "praise-letter" : "card", record, member, student, familyId: user?.familyId, points: pts });
    if (!r.ok) return showToast(r.error, "error");
    markSpecialPerformanceRewarded(record, pts, role);
    notifyStudentFromParent(role, member, student, { title: "特别表现奖励", content: formatSpecialPerformanceSummary(record?.specialPerformance) });
    showToast(`已确认特别表现 +${pts} 分`);
    render();
  }));
}

function bindFatherWorkbench(root, ctx) {
  const { member, student, user, todayRec, ai } = ctx;
  let selectedScenario = ai.scenario || "";
  let selectedCategory = "learning";

  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  bindParentLedgerToggle(root, user?.familyId, user?.role);

  const scenarioInput = $("#father-scenario", root);
  const categoryInput = $("#father-scenario-cat", root);
  const chipsHost = $("#father-scene-chips", root);
  const formBox = $("#father-tool-form", root);

  const paintChips = (cat) => {
    const c = FATHER_REWARD_SCENARIOS[cat];
    if (!chipsHost || !c) return;
    chipsHost.innerHTML = c.items.map((item) =>
      `<button type="button" class="father-scene-chip ${selectedScenario === item ? "is-selected" : ""}" data-scene="${item}">${item}</button>`
    ).join("");
    chipsHost.querySelectorAll("[data-scene]").forEach((b) => b.addEventListener("click", () => {
      selectedScenario = b.dataset.scene;
      if (scenarioInput) scenarioInput.value = selectedScenario;
      paintChips(selectedCategory);
    }));
  };

  root.querySelectorAll("[data-scene-cat]").forEach((b) => b.addEventListener("click", () => {
    selectedCategory = b.dataset.sceneCat;
    if (categoryInput) categoryInput.value = selectedCategory;
    root.querySelectorAll("[data-scene-cat]").forEach((t) => t.classList.toggle("is-active", t.dataset.sceneCat === selectedCategory));
    paintChips(selectedCategory);
  }));
  paintChips(selectedCategory);

  const notifyChild = (payload) => {
    notifyStudentFromParent("father", member, student, payload);
  };

  const submitReward = (tool, fd) => {
    const scenario = fd.get("scenario") || selectedScenario || scenarioInput?.value || "";
    const r = submitFatherReward({
      tool,
      scenario,
      scenarioCategory: categoryInput?.value || selectedCategory,
      medalType: fd.get("medalType") || "",
      title: fd.get("title") || "",
      content: fd.get("content") || fd.get("reason") || "",
      points: fd.get("points"),
      relatedRecordId: todayRec?.recordId,
      notifyStudent: true,
      member,
      student,
      familyId: user?.familyId,
    });
    if (!r.ok) return showToast(r.error, "error");
    notifyChild({
      title: r.displayTitle,
      content: fd.get("content") || scenario,
      style: tool === "card" ? "阳光鼓励" : "深情支持",
      rewardType: tool === "medal" ? (fd.get("medalType") || "奖章") : (tool === "praise-letter" ? "表扬信" : "精神鼓励"),
    });
    showToast(r.message || "奖励已发放，成长大盘已更新");
    formBox?.classList.add("hidden");
    render();
  };

  root.querySelectorAll("[data-father-tool]").forEach((btn) => btn.addEventListener("click", () => {
    const tool = btn.dataset.fatherTool;
    formBox?.classList.remove("hidden");
    const scen = selectedScenario || ai.scenario || "";
    if (tool === "deduct") {
      formBox.innerHTML = `<form class="form" id="father-deduct-f">
        <h4>扣分提醒</h4>
        <label class="field"><span>扣分分值</span><input name="points" type="number" min="1" max="200" value="20" /></label>
        <label class="field"><span>扣分原因</span><input name="reason" required /></label>
        <label class="field"><span>改进建议</span><textarea name="advice" rows="2" required></textarea></label>
        <label class="field"><span>明天怎么做</span><textarea name="tomorrow" rows="2" required></textarea></label>
        <button class="btn btn--ghost btn--block">发送扣分提醒</button></form>`;
      $("#father-deduct-f", formBox).onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const advice = `${fd.get("advice")}\n明天怎么做：${fd.get("tomorrow")}`;
        const dr = deductStudent({
          parentRole: "father",
          points: fd.get("points"),
          reason: fd.get("reason"),
          advice,
          relatedRecordId: todayRec?.recordId,
        });
        if (!dr.ok) return showToast(dr.error, "error");
        saveCoach("father", "deduct", { points: fd.get("points"), reason: fd.get("reason"), advice });
        notifyChild({ title: "爸爸的提醒", content: fd.get("reason"), rewardType: "改进提醒" });
        showToast(dr.message || "扣分提醒已记录");
        formBox.classList.add("hidden");
        render();
      };
      return;
    }
    const pts = FATHER_REWARD_POINTS[tool];
    const medalOpts = tool === "medal"
      ? `<label class="field"><span>奖章类型</span><select name="medalType" required>
        <option value="">请选择</option>
        ${FATHER_MEDAL_TYPES.map((m) => `<option ${ai.medalType === m ? "selected" : ""}>${m}</option>`).join("")}
      </select></label>`
      : "";
    formBox.innerHTML = `<form class="form" id="father-reward-f">
      <h4>${btn.querySelector("strong")?.textContent || "发放奖励"}</h4>
      <label class="field"><span>奖励场景</span><input name="scenario" value="${scen}" placeholder="从上方选择或填写" /></label>
      ${medalOpts}
      <label class="field"><span>标题</span><input name="title" placeholder="${tool === "medal" ? "奖章名称" : "贺卡/信标题"}" /></label>
      <label class="field"><span>内容</span><textarea name="content" rows="3" placeholder="写下爸爸想正式记录的话">${ai.childMessage || ""}</textarea></label>
      <label class="field"><span>奖励积分</span><input name="points" type="number" min="1" max="500" value="${pts}" /></label>
      <button class="btn btn--primary btn--block">确认发放（扣 Ryan 钱包 ${pts} 分）</button>
    </form>`;
    $("#father-reward-f", formBox).onsubmit = (e) => {
      e.preventDefault();
      submitReward(tool, new FormData(e.target));
    };
  }));

  bindSpecialPerformanceWorkbench(root, todayRec, "father", { member, student, user });

  $("[data-father-apply-ai]", root)?.addEventListener("click", () => {
    selectedScenario = ai.scenario || "";
    if (scenarioInput) scenarioInput.value = selectedScenario;
    if (ai.scenario) {
      for (const [key, cat] of Object.entries(FATHER_REWARD_SCENARIOS)) {
        if (cat.items.includes(ai.scenario)) {
          selectedCategory = key;
          if (categoryInput) categoryInput.value = key;
          root.querySelectorAll("[data-scene-cat]").forEach((t) => t.classList.toggle("is-active", t.dataset.sceneCat === key));
          break;
        }
      }
    }
    paintChips(selectedCategory);
    const toolMap = { 贺卡: "card", 表扬信: "praise-letter", 奖章: "medal", 方法卡: "method-card" };
    const tool = toolMap[ai.rewardMethod] || "card";
    $(`[data-father-tool="${tool}"]`, root)?.click();
    showToast("已根据 AI 建议预填奖励表单");
  });
}

function renderFatherWorkbench(root, ctx) {
  const { member, student, user, wallet, wb, todayRec } = ctx;
  const snapshot = buildFatherChildSnapshot(user.familyId, student?.memberId);
  const ai = buildFatherAiSuggestion(snapshot);

  root.innerHTML = `<div class="page page--workbench page--father">
    ${renderFatherWalletHero(member, wallet, wb, user.familyId)}
    ${renderFatherChildDigest(snapshot, student)}
    ${renderSpecialPerformanceWorkbenchCard(todayRec, "father")}
    ${renderFatherAiCard(ai)}
    ${renderFatherScenarios(ai.scenario || "", "learning")}
    ${renderFatherToolbox(wallet)}
    ${renderParentHonorLink("爸爸发放的贺卡、表扬信与奖章会同步出现在荣誉室与成长大盘。")}
  </div>`;

  bindFatherWorkbench(root, { member, student, user, todayRec, ai, wallet });
}

function renderMotherWalletHero(member, wallet, wb, familyId) {
  const w = wallet ? getMotherTodayWalletStats(familyId, wallet) : null;
  const sysRoles = getMemberSystemRoles(member).join(" / ");
  return `<section class="parent-workbench-hero parent-workbench-hero--mother card-block mother-wallet">
    <button type="button" class="parent-workbench-hero__back btn btn--ghost btn--sm" data-go="/coach">返回家庭总览</button>
    <div class="parent-workbench-hero__head">
      ${renderAvatar(member, "parent-workbench-hero__avatar")}
      <div>
        <h2 class="parent-workbench-hero__title">${wb?.title || member?.name || ""}</h2>
        <p class="parent-workbench-hero__en">${wb?.subtitle || "Care & Honor Coach"}</p>
        <p class="member-role">妈妈 · ${sysRoles}</p>
        <p class="hint mother-mission">${wb?.tagline || ""}</p>
      </div>
    </div>
    ${wallet ? `<div class="mother-wallet__stats parent-workbench-hero__stats">
      <div class="stat"><span>当前可用优培积分</span><strong>${w.balance}</strong></div>
      <div class="stat"><span>今日已发积分</span><strong>${w.todaySent}</strong></div>
      <div class="stat"><span>今日鼓励卡</span><strong>${w.cards}</strong></div>
      <div class="stat"><span>今日荣誉</span><strong>${w.honors}</strong></div>
      <div class="stat"><span>今日计划建议</span><strong>${w.planSuggestions}</strong></div>
      <div class="stat"><span>今日亲子奖励</span><strong>${w.familyRewards}</strong></div>
      <div class="stat"><span>累计奖励积分</span><strong>${w.totalRewarded}</strong></div>
    </div>
    <p class="hint">鼓励卡 / 温暖表扬信 / 荣誉徽章默认各 500 积分；亲子奖励默认 300 分。</p>
    <button type="button" class="btn btn--ghost btn--block btn--sm" data-toggle-ledger>进入积分记录</button>
    <div id="parent-ledger" class="ledger-panel hidden">
      <h4>积分记录</h4>
      ${renderPointLedgerHTML([], "你还没有积分流水记录。")}
    </div>` : `<p class="hint">钱包余额仅在 Sara 工作台与孩子荣誉室中可见。</p>`}
  </section>`;
}

function renderMotherChildDigest(snapshot, student) {
  const s = snapshot;
  return `<section class="card-block mother-digest">
    <h3>${student?.name || "孩子"} 今日状态</h3>
    <p class="hint">陪伴荣誉官关注情绪与计划，复训结果仅作陪伴参考。</p>
    <div class="mother-digest__stats stat-grid">
      <div class="stat"><span>今日心情</span><strong>${s.mood}</strong></div>
      <div class="stat"><span>今日精力</span><strong>${s.energy}</strong></div>
      <div class="stat"><span>今日压力感</span><strong>${s.stress}</strong></div>
      <div class="stat"><span>今日完成了什么</span><strong class="mother-digest__long">${s.completedToday}</strong></div>
      <div class="stat"><span>明日计划</span><strong class="mother-digest__long">${s.tomorrowPlan}</strong></div>
      <div class="stat"><span>是否完成打卡</span><strong>${s.checkedIn ? "已打卡" : "未打卡"}</strong></div>
      <div class="stat"><span>是否完成复训</span><strong>${s.trainingDone ? "已完成" : "未完成"}</strong></div>
      <div class="stat"><span>孩子自评等级</span><strong>${s.selfGrade}</strong></div>
    </div>
    <p class="hint mother-retrain-ref">复训参考：${s.retrainNote}（不作为主判断，仅供陪伴参考）</p>
    <article class="mother-digest__block">
      <h4>今日特别表现</h4>
      <p>${String(s.specialPerformanceText || "—").replace(/\n/g, "<br>")}</p>
    </article>
  </section>`;
}

function renderMotherAiCard(ai) {
  return `<section class="card-block mother-ai">
    <h3>AI 给妈妈的陪伴建议</h3>
    <p><strong>今天最需要妈妈看见的一点</strong><br>${ai.highlight}</p>
    <div class="mother-ai__meta">
      <span>适合：${ai.encourageOrRemind}</span>
      <span>${ai.noDeduct ? "不建议扣分" : "可视情况提醒"}</span>
      <span>建议：${ai.rewardMethod}${ai.suggestedPoints ? ` ${ai.suggestedPoints} 分` : ""}</span>
    </div>
    <p class="hint"><strong>推荐话术：</strong>${ai.motherPhrase || ai.motherMessage}</p>
    ${ai.familyReward ? `<p class="hint"><strong>推荐亲子奖励：</strong>${ai.familyReward}</p>` : ""}
    <p class="hint"><strong>推荐明日小目标：</strong>${ai.tomorrowGoal}</p>
    <p class="hint">${ai.motherMessage}</p>
    <button type="button" class="btn btn--sun btn--sm" data-mother-apply-ai>采纳建议并预填</button>
  </section>`;
}

function renderMotherScenarios(selected = "", category = "emotion") {
  const cats = Object.entries(MOTHER_COMPANION_SCENARIOS);
  const tabs = cats.map(([key, c]) =>
    `<button type="button" class="mother-scene-tab ${key === category ? "is-active" : ""}" data-mscene-cat="${key}">${c.label}</button>`
  ).join("");
  const active = MOTHER_COMPANION_SCENARIOS[category] || MOTHER_COMPANION_SCENARIOS.emotion;
  const chips = active.items.map((item) =>
    `<button type="button" class="mother-scene-chip ${selected === item ? "is-selected" : ""}" data-mscene="${item}">${item}</button>`
  ).join("");
  return `<section class="card-block mother-scenes">
    <h3>妈妈陪伴场景</h3>
    <p class="hint">选择今天最需要被温柔看见的瞬间。</p>
    <input type="hidden" id="mother-scenario" value="${selected}" />
    <input type="hidden" id="mother-scenario-cat" value="${category}" />
    <div class="mother-scene-tabs">${tabs}</div>
    <div class="mother-scene-chips" id="mother-scene-chips">${chips}</div>
  </section>`;
}

function renderMotherToolbox(wallet) {
  const tools = [
    { id: "card", icon: "💛", name: "发妈妈鼓励卡", pts: MOTHER_REWARD_POINTS.card, desc: "压力大、情绪低时需要温暖" },
    { id: "praise-letter", icon: "💝", name: "写温暖表扬信", pts: MOTHER_REWARD_POINTS["praise-letter"], desc: "特别表现与高光时刻" },
    { id: "badge", icon: "🎖️", name: "发荣誉徽章", pts: MOTHER_REWARD_POINTS.badge, desc: "温暖坚持、情绪稳定等" },
    { id: "family-reward", icon: "🌸", name: "发亲子奖励", pts: MOTHER_REWARD_POINTS["family-reward"], desc: "陪伴活动与亲子时光" },
    { id: "tomorrow-goal", icon: "🎯", name: "给明日小目标", pts: "0~100", desc: "明天先做什么、妈妈怎么帮" },
  ];
  return `<section class="card-block mother-toolbox">
    <h3>妈妈陪伴工具箱</h3>
    <div class="mother-tool-grid father-tool-grid">${tools.map((t) => {
      const afford = t.id === "tomorrow-goal" || canMotherAfford(t.id, wallet);
      return `<button type="button" class="father-tool-btn mother-tool-btn ${afford ? "" : "is-disabled"}" data-mother-tool="${t.id}" ${afford ? "" : "disabled"}>
        <span class="father-tool-btn__icon">${t.icon}</span>
        <strong>${t.name}</strong>
        <span class="hint">${t.desc}</span>
        <span class="father-tool-btn__pts">${t.id === "tomorrow-goal" ? "默认 0~100 分" : `默认 ${t.pts} 分`}</span>
      </button>`;
    }).join("")}</div>
    <div id="mother-tool-form" class="father-tool-form hidden"></div>
  </section>`;
}

function bindMotherWorkbench(root, ctx) {
  const { member, student, user, todayRec, ai } = ctx;
  let selectedScenario = ai.scenario || "";
  let selectedCategory = "emotion";

  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
  bindParentLedgerToggle(root, user?.familyId, user?.role);
  bindSpecialPerformanceWorkbench(root, todayRec, "mother", { member, student, user });

  const scenarioInput = $("#mother-scenario", root);
  const categoryInput = $("#mother-scenario-cat", root);
  const chipsHost = $("#mother-scene-chips", root);
  const formBox = $("#mother-tool-form", root);

  const paintChips = (cat) => {
    const c = MOTHER_COMPANION_SCENARIOS[cat];
    if (!chipsHost || !c) return;
    chipsHost.innerHTML = c.items.map((item) =>
      `<button type="button" class="mother-scene-chip ${selectedScenario === item ? "is-selected" : ""}" data-mscene="${item}">${item}</button>`
    ).join("");
    chipsHost.querySelectorAll("[data-mscene]").forEach((b) => b.addEventListener("click", () => {
      selectedScenario = b.dataset.mscene;
      if (scenarioInput) scenarioInput.value = selectedScenario;
      paintChips(selectedCategory);
    }));
  };

  root.querySelectorAll("[data-mscene-cat]").forEach((b) => b.addEventListener("click", () => {
    selectedCategory = b.dataset.msceneCat;
    if (categoryInput) categoryInput.value = selectedCategory;
    root.querySelectorAll("[data-mscene-cat]").forEach((t) => t.classList.toggle("is-active", t.dataset.msceneCat === selectedCategory));
    paintChips(selectedCategory);
  }));
  paintChips(selectedCategory);

  const notifyChild = (payload) => notifyStudentFromParent("mother", member, student, payload);

  const submitReward = (tool, fd) => {
    const r = submitMotherReward({
      tool,
      scenario: fd.get("scenario") || selectedScenario || "",
      scenarioCategory: categoryInput?.value || selectedCategory,
      badgeType: fd.get("badgeType") || "",
      familyRewardType: fd.get("familyRewardType") || "",
      title: fd.get("title") || "",
      content: fd.get("content") || "",
      points: fd.get("points"),
      tomorrowTask: fd.get("tomorrowTask") || "",
      motherHelp: fd.get("motherHelp") || "",
      tomorrowReminder: fd.get("tomorrowReminder") || "",
      relatedRecordId: todayRec?.recordId,
      member,
      student,
      familyId: user?.familyId,
    });
    if (!r.ok) return showToast(r.error, "error");
    if (r.points > 0) {
      notifyChild({
        title: r.displayTitle,
        content: fd.get("content") || fd.get("scenario") || ai.childMessage,
        style: "温暖陪伴",
        rewardType: tool === "family-reward" ? "亲子活动" : (tool === "badge" ? "荣誉徽章" : "精神鼓励"),
      });
    } else {
      notifyChild({ title: r.displayTitle || "明日小目标", content: fd.get("tomorrowReminder") || "", style: "温暖陪伴", rewardType: "明日小目标" });
    }
    showToast(r.message || "陪伴记录已保存");
    formBox?.classList.add("hidden");
    render();
  };

  root.querySelectorAll("[data-mother-tool]").forEach((btn) => btn.addEventListener("click", () => {
    const tool = btn.dataset.motherTool;
    formBox?.classList.remove("hidden");
    const scen = selectedScenario || ai.scenario || "";
    if (tool === "tomorrow-goal") {
      formBox.innerHTML = `<form class="form" id="mother-goal-f">
        <h4>给明日小目标</h4>
        <label class="field"><span>陪伴场景</span><input name="scenario" value="${scen}" /></label>
        <label class="field"><span>明天先完成什么</span><textarea name="tomorrowTask" rows="2">${ai.tomorrowGoal || ""}</textarea></label>
        <label class="field"><span>需要妈妈怎么帮</span><textarea name="motherHelp" rows="2" placeholder="例如：陪你复盘 10 分钟"></textarea></label>
        <label class="field"><span>明天一句提醒</span><input name="tomorrowReminder" placeholder="例如：记得先完成错题复训" /></label>
        <label class="field"><span>奖励积分（可选，0 表示不加分）</span><input name="points" type="number" min="0" max="100" value="0" /></label>
        <button class="btn btn--sun btn--block">保存明日小目标</button></form>`;
      $("#mother-goal-f", formBox).onsubmit = (e) => {
        e.preventDefault();
        submitReward(tool, new FormData(e.target));
      };
      return;
    }
    const pts = MOTHER_REWARD_POINTS[tool];
    const badgeOpts = tool === "badge"
      ? `<label class="field"><span>荣誉徽章</span><select name="badgeType" required>
        <option value="">请选择</option>
        ${MOTHER_BADGE_TYPES.map((m) => `<option ${ai.badgeType === m ? "selected" : ""}>${m}</option>`).join("")}
      </select></label>` : "";
    const familyOpts = tool === "family-reward"
      ? `<label class="field"><span>亲子奖励类型</span><select name="familyRewardType">
        ${FAMILY_REWARD_TYPES.map((f) => `<option ${ai.familyReward === f ? "selected" : ""}>${f}</option>`).join("")}
      </select></label>
      <label class="field"><span>奖励积分</span>
        <select name="points"><option value="300">300 分</option><option value="500">500 分</option></select></label>` : "";
    formBox.innerHTML = `<form class="form" id="mother-reward-f">
      <h4>${btn.querySelector("strong")?.textContent || "发放陪伴奖励"}</h4>
      <label class="field"><span>陪伴场景</span><input name="scenario" value="${scen}" /></label>
      ${badgeOpts}${familyOpts}
      <label class="field"><span>标题</span><input name="title" placeholder="温暖标题" /></label>
      <label class="field"><span>内容</span><textarea name="content" rows="3">${ai.childMessage || ""}</textarea></label>
      ${tool !== "family-reward" ? `<label class="field"><span>奖励积分</span><input name="points" type="number" min="1" max="500" value="${pts}" /></label>` : ""}
      <button class="btn btn--sun btn--block">确认发放（扣 Sara 钱包）</button>
    </form>`;
    $("#mother-reward-f", formBox).onsubmit = (e) => {
      e.preventDefault();
      submitReward(tool, new FormData(e.target));
    };
  }));

  $("[data-mother-apply-ai]", root)?.addEventListener("click", () => {
    selectedScenario = ai.scenario || "";
    if (scenarioInput) scenarioInput.value = selectedScenario;
    if (ai.scenario) {
      for (const [key, cat] of Object.entries(MOTHER_COMPANION_SCENARIOS)) {
        if (cat.items.includes(ai.scenario)) {
          selectedCategory = key;
          if (categoryInput) categoryInput.value = key;
          root.querySelectorAll("[data-mscene-cat]").forEach((t) => t.classList.toggle("is-active", t.dataset.msceneCat === key));
          break;
        }
      }
    }
    paintChips(selectedCategory);
    const toolMap = { 鼓励卡: "card", 温暖表扬信: "praise-letter", 荣誉徽章: "badge", 亲子奖励: "family-reward", 明日小目标: "tomorrow-goal" };
    const tool = toolMap[ai.rewardMethod] || "card";
    $(`[data-mother-tool="${tool}"]`, root)?.click();
    showToast("已根据 AI 建议预填陪伴表单");
  });
}

function renderMotherWorkbench(root, ctx) {
  const { member, student, user, wallet, wb, todayRec } = ctx;
  const snapshot = buildMotherChildSnapshot(user.familyId, student?.memberId);
  const ai = buildMotherAiSuggestion(snapshot);

  root.innerHTML = `<div class="page page--workbench page--mother">
    ${renderMotherWalletHero(member, wallet, wb, user.familyId)}
    ${renderMotherChildDigest(snapshot, student)}
    ${renderSpecialPerformanceWorkbenchCard(todayRec, "mother")}
    ${renderMotherAiCard(ai)}
    ${renderMotherScenarios(ai.scenario || "", "emotion")}
    ${renderMotherToolbox(wallet)}
    ${renderParentHonorLink("妈妈发出的鼓励卡、表扬信与荣誉会同步出现在荣誉室与成长大盘。")}
  </div>`;

  bindMotherWorkbench(root, { member, student, user, todayRec, ai, wallet });
}

function renderCoachParent(root, parentRole) {
  const role = parentRole || getCurrentRole();
  if (role !== "father" && role !== "mother") { navigate("/coach"); return; }
  const user = getCurrentUser();
  if (user?.role !== "admin" && user?.role !== role) {
    navigate(user?.role === "father" || user?.role === "mother" ? `/coach/${user.role}` : "/coach");
    return;
  }
  const member = getMembers().find((m) => m.role === role);
  const student = getStudentMember();
  const todayRec = getTodayRecord();
  const wb = getParentWorkbenchMeta(role, member);
  const wallet = getParentWalletForViewer(user?.familyId, role, user?.role);

  if (role === "father") {
    renderFatherWorkbench(root, { member, student, user, wallet, wb, todayRec });
    return;
  }

  renderMotherWorkbench(root, { member, student, user, wallet, wb, todayRec });
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
    ${TagSelectHTML({ name: `${prefix}SystemRoles`, label: "系统角色（可选，可多选）", presets: SYSTEM_ROLE_OPTIONS, selected: getMemberSystemRoles(member) })}
    ${TagSelectHTML({ name: `${prefix}Hobbies`, label: "爱好", presets: hobbies, selected: member.hobbies })}
    ${TagSelectHTML({ name: `${prefix}Tags`, label: "性格标签", presets: presets, selected: member.personalityTags })}
    ${TagSelectHTML({ name: `${prefix}Companion`, label: "陪伴方式", presets: companion, selected: member.coachingStyle })}
    <label class="field"><span>默认鼓励风格</span><select name="encourageStyle">${CARD_STYLES.map((s) => `<option ${member.defaultEncourageStyle === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <button class="btn btn--ghost btn--block">保存${role === "father" ? "爸爸" : "妈妈"}资料</button></form>`;
}

const PROFILE_ROLE_LABELS = { father: "爸爸", mother: "妈妈", student: "孩子", admin: "管理员" };

function isProfileAdmin(user) {
  return user?.role === "admin";
}

function profileMenuCard(icon, title, desc, summary, section) {
  return `<article class="profile-menu-card">
    <span class="profile-menu-card__icon">${icon}</span>
    <div class="profile-menu-card__body">
      <strong>${title}</strong><p>${desc}</p>
      ${summary ? `<p class="profile-menu-card__summary">${summary}</p>` : ""}
    </div>
    <button type="button" class="btn btn--ghost btn--sm" data-profile-go="${section}">进入</button>
  </article>`;
}

function profileHeroHTML(user, fam) {
  const member = getMembers().find((m) => m.memberId === user?.memberId);
  const avatar = renderAvatar(member || { avatar: user?.role === "father" ? "👨" : user?.role === "mother" ? "👩" : "🧑‍🎓" });
  return `<div class="profile-hero">
    <span class="profile-hero__avatar">${avatar}</span>
    <h2 class="profile-hero__name">${user?.name || "用户"}</h2>
    <p class="profile-hero__role">${PROFILE_ROLE_LABELS[user?.role] || "成员"}</p>
    <p class="profile-hero__family">${fam?.familyName || "我的家庭"}</p>
    <button type="button" class="btn btn--danger btn--block" id="profile-logout-top" style="margin-top:14px">退出登录</button>
  </div>`;
}

function bindProfileLogout(root) {
  $("#profile-logout-top", root)?.addEventListener("click", async () => {
    if (await showConfirm({ title: "退出登录", message: "确定退出当前账号？", confirmText: "退出", danger: true })) {
      logout(); navigate("/welcome");
    }
  });
}

function renderProfileMenu(root) {
  const user = getCurrentUser();
  const fam = getFamily();
  const student = getStudentMember();
  const father = getMembers().find((m) => m.role === "father");
  const mother = getMembers().find((m) => m.role === "mother");
  const unread = getUnreadCount();
  const role = user?.role;
  const admin = isProfileAdmin(user);
  const cards = [];

  const selfMember = getMembers().find((m) => m.memberId === user?.memberId);
  cards.push(profileMenuCard("👤", "我的账号", "管理头像、昵称、爱好和性格标签。",
    selfMember?.name || user?.name, "account"));
  const env = detectTrainingEnvironment();
  cards.push(profileMenuCard("📲", "全屏训练安装", "从主屏幕打开可隐藏浏览器地址栏。",
    env.isStandalone ? "已独立 App 模式" : "建议安装到主屏幕", "install"));

  if (role === "student") {
    cards.push(profileMenuCard("🧑‍🎓", "孩子资料", "管理年级、学校、学习目标和主要科目。",
      `${student?.grade || "未填年级"} · ${(student?.subjectFocus || []).slice(0, 2).join("、") || "未设科目"}`, "child"));
    cards.push(profileMenuCard("💛", "爱心消息", "查看爸爸妈妈发来的鼓励卡和奖励。",
      unread ? `${unread} 条未读` : "暂无未读", "hearts"));
    cards.push(profileMenuCard("🔒", "隐私设置", "管理海报、分数、地点和心情显示权限。",
      "仅与你相关的选项", "privacy"));
  } else {
    cards.push(profileMenuCard("🏡", "家庭资料", "管理家庭名称、徽章、口号和陪伴风格。",
      fam?.familyName || "未命名家庭", "family"));
    cards.push(profileMenuCard("🧑‍🎓", "孩子资料", "管理年级、学校、学习目标和主要科目。",
      student?.name || "未填写", "child"));
    cards.push(profileMenuCard("💛", "爱心消息", "查看与发送鼓励卡、奖励记录。",
      unread ? `${unread} 条未读` : "查看记录", "hearts"));
    cards.push(profileMenuCard("🔒", "隐私设置", "管理海报、分数、地点和心情显示权限。",
      "家庭共享设置", "privacy"));
    cards.push(profileMenuCard("💾", "数据管理", "导出、导入、重置或清空数据。",
      "含危险操作确认", "data"));
    if (admin) {
      cards.push(profileMenuCard("👨", "爸爸资料", "管理员查看与编辑爸爸个人资料。",
        father?.name || "未填写", "father"));
      cards.push(profileMenuCard("👩", "妈妈资料", "管理员查看与编辑妈妈个人资料。",
        mother?.name || "未填写", "mother"));
    }
  }

  root.innerHTML = shell("我的", "Profile Center", "", `
    ${profileHeroHTML(user, fam)}
    <div class="profile-menu">${cards.join("")}</div>
    <p class="version-pill" style="margin-top:16px;text-align:center">${APP_VERSION}</p>`, MODULE_SLOGANS.profile);

  bindProfileLogout(root);
  root.querySelectorAll("[data-profile-go]").forEach((btn) => btn.addEventListener("click", () => {
    const sec = btn.dataset.profileGo;
    if (sec === "hearts") navigate("/hearts");
    else navigate(`/profile/${sec}`);
  }));
}

function renderProfileSection(root, section) {
  const user = getCurrentUser();
  const fam = getFamily();
  const student = getStudentMember();
  const father = getMembers().find((m) => m.role === "father");
  const mother = getMembers().find((m) => m.role === "mother");
  const priv = getPrivacy();
  const role = user?.role;
  const admin = isProfileAdmin(user);
  const titles = {
    account: "我的账号", family: "家庭资料", child: "孩子资料",
    father: "爸爸资料", mother: "妈妈资料", privacy: "隐私设置", data: "数据管理",
    install: "全屏训练安装",
  };
  const back = () => navigate("/profile");

  if (section === "install") {
    const env = detectTrainingEnvironment();
    root.innerHTML = shell(titles.install, "PWA Install", "←", `
      ${getInstallGuideHTML()}
      <div class="card-block">
        <h3>当前运行环境</h3>
        <ul class="env-check-list">
          <li>${env.isStandalone ? "✅" : "⚪"} PWA 独立模式（主屏幕图标）</li>
          <li>${env.isIosSafariBrowser ? "📱" : "—"} iOS Safari 浏览器</li>
          <li>${env.isAndroidChromeBrowser ? "📱" : "—"} Android Chrome 浏览器</li>
          <li>${env.fullscreenEnabled ? "✅" : "—"} 支持全屏 API</li>
          <li>${env.orientationLockSupported ? "✅" : "—"} 支持横屏锁定</li>
        </ul>
        <p class="hint">${env.isStandalone
    ? "你已从主屏幕打开，训练页可不显示浏览器地址栏。"
    : "你正在普通浏览器中打开。地址栏属于浏览器外壳，安装到主屏幕后可隐藏。"}</p>
      </div>`);
    $("[data-back]", root).onclick = back;
    return;
  }

  if (section === "account") {
    const member = getMembers().find((m) => m.memberId === user?.memberId);
    if (role === "student") {
      root.innerHTML = shell(titles.account, "", "←", `<form class="form card-block" id="acct-f">
        <label class="field"><span>姓名</span><input name="name" value="${member?.name || ""}" /></label>
        <label class="field"><span>昵称</span><input name="nickname" value="${member?.nickname || ""}" /></label>
        ${AvatarPickerHTML({ name: "childAvatar", value: member?.avatar || "🧑‍🎓", imageValue: member?.avatarImage || "", label: "头像", presets: AVATAR_PRESETS.child })}
        ${TagSelectHTML({ name: "childHobbies", label: "爱好", presets: REG_PRESETS.childHobbies, selected: member?.hobbies })}
        ${TagSelectHTML({ name: "childTags", label: "性格标签", presets: REG_PRESETS.childTags, selected: member?.personalityTags })}
        <button class="btn btn--primary btn--block">保存我的账号</button></form>`);
      bindAvatarPickers(root);
      bindTagSelects(root);
      $("[data-back]", root).onclick = back;
      $("#acct-f", root)?.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        updateMember(member.memberId, {
          name: fd.get("name"), nickname: fd.get("nickname"),
          avatar: fd.get("childAvatar"), avatarImage: fd.get("childAvatarImage") || "",
          avatarType: fd.get("childAvatarType"), avatarValue: fd.get("childAvatarValue"),
          hobbies: tagList(fd.get("childHobbies")), personalityTags: tagList(fd.get("childTags")),
        });
        showToast("资料已保存"); navigate("/profile");
      });
      return;
    }
    const prefix = role === "father" ? "dad" : "mom";
    const parentRole = role === "father" ? "father" : "mother";
    const parentMember = role === "father" ? father : mother;
    root.innerHTML = shell(titles.account, "", "←", parentProfileForm(parentMember, parentRole, prefix));
    bindAvatarPickers(root);
    bindTagSelects(root);
    $("[data-back]", root).onclick = back;
    $(`#${prefix}-f`, root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      updateMember(parentMember.memberId, {
        name: fd.get("name"), avatar: fd.get(`${prefix}Avatar`),
        avatarImage: fd.get(`${prefix}AvatarImage`) || "",
        avatarType: fd.get(`${prefix}AvatarType`) || "emoji",
        avatarValue: fd.get(`${prefix}AvatarValue`) || fd.get(`${prefix}Avatar`),
        hobbies: tagList(fd.get(`${prefix}Hobbies`)),
        personalityTags: tagList(fd.get(`${prefix}Tags`)),
        coachingStyle: tagList(fd.get(`${prefix}Companion`)),
        defaultEncourageStyle: fd.get("encourageStyle"),
      });
      showToast("资料已保存"); navigate("/profile");
    });
    return;
  }

  if (section === "family" && role !== "student") {
    const styleLabel = COACHING_STYLES.find((s) => s.id === fam?.coachingStyle)?.label || "平衡型";
    root.innerHTML = shell(titles.family, "", "←", `<form class="form card-block" id="fam-f">
      <label class="field"><span>家庭名称</span><input name="familyName" value="${fam?.familyName || ""}" /></label>
      ${FamilyBadgePickerHTML({ value: fam?.badge || "🪐", imageValue: fam?.badgeImage || "", badgeId: fam?.badgeId, badgeType: fam?.badgeType, badgeValue: fam?.badgeValue })}
      <label class="field"><span>家庭口号</span><input name="motto" value="${fam?.motto || ""}" /></label>
      <label class="field"><span>家庭陪伴风格</span><select name="coachingStyle">${COACHING_STYLES.map((s) => `<option value="${s.id}" ${fam?.coachingStyle === s.id ? "selected" : ""}>${s.label}</option>`).join("")}</select></label>
      <p class="field-hint">当前：${styleLabel}</p>
      <button class="btn btn--primary btn--block">保存家庭资料</button></form>`);
    bindFamilyBadgePicker(root);
    $("[data-back]", root).onclick = back;
    $("#fam-f", root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      updateFamily(fam.familyId, {
        familyName: fd.get("familyName"), motto: fd.get("motto"), familyMotto: fd.get("motto"),
        coachingStyle: fd.get("coachingStyle"), badge: fd.get("badge"), badgeImage: fd.get("badgeImage") || "",
        badgeId: fd.get("badgeId"), badgeType: fd.get("badgeType"), badgeValue: fd.get("badgeValue"), familyBadge: fd.get("badge"),
      });
      showToast("家庭资料已保存"); navigate("/profile");
    });
    return;
  }

  if (section === "child") {
    root.innerHTML = shell(titles.child, "", "←", `<form class="form card-block" id="stu-f">
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
      <button class="btn btn--primary btn--block">保存孩子资料</button></form>`);
    bindAvatarPickers(root);
    bindTagSelects(root);
    $("[data-back]", root).onclick = back;
    $("#stu-f", root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      updateMember(student.memberId, {
        name: fd.get("name"), nickname: fd.get("nickname"), grade: fd.get("grade"), school: fd.get("school"),
        avatar: fd.get("childAvatar"), avatarImage: fd.get("childAvatarImage") || "",
        avatarType: fd.get("childAvatarType"), avatarValue: fd.get("childAvatarValue"),
        hobbies: tagList(fd.get("childHobbies")), personalityTags: tagList(fd.get("childTags")),
        learningGoal: fd.get("learningGoal"), subjectFocus: tagList(fd.get("childSubjects")),
        parentResponsePref: fd.get("parentResponsePref"),
      });
      showToast("孩子资料已保存"); navigate("/profile");
    });
    return;
  }

  if ((section === "father" || section === "mother") && admin) {
    const parentRole = section;
    const prefix = section === "father" ? "dad" : "mom";
    const member = section === "father" ? father : mother;
    root.innerHTML = shell(titles[section], "", "←", parentProfileForm(member, parentRole, prefix));
    bindAvatarPickers(root);
    bindTagSelects(root);
    $("[data-back]", root).onclick = back;
    $(`#${prefix}-f`, root)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      updateMember(member.memberId, {
        name: fd.get("name"), avatar: fd.get(`${prefix}Avatar`),
        avatarImage: fd.get(`${prefix}AvatarImage`) || "",
        avatarType: fd.get(`${prefix}AvatarType`) || "emoji",
        avatarValue: fd.get(`${prefix}AvatarValue`) || fd.get(`${prefix}Avatar`),
        hobbies: tagList(fd.get(`${prefix}Hobbies`)),
        personalityTags: tagList(fd.get(`${prefix}Tags`)),
        coachingStyle: tagList(fd.get(`${prefix}Companion`)),
        systemRoles: tagList(fd.get(`${prefix}SystemRoles`)),
        defaultEncourageStyle: fd.get("encourageStyle"),
      });
      showToast("资料已保存"); navigate("/profile");
    });
    return;
  }

  if (section === "privacy") {
    const studentOnly = role === "student";
    root.innerHTML = shell(titles.privacy, "", "←", `<div class="card-block">
      <label class="toggle"><input type="checkbox" id="p-sc" ${priv.showScores !== false ? "checked" : ""} /><span>海报显示分数</span></label>
      <label class="toggle"><input type="checkbox" id="p-loc" ${priv.showLocation !== false ? "checked" : ""} /><span>海报显示地点</span></label>
      <label class="toggle"><input type="checkbox" id="p-selfie" ${priv.showSelfie !== false ? "checked" : ""} /><span>海报显示头像</span></label>
      <label class="toggle"><input type="checkbox" id="p-mood" ${priv.allowHideMood !== false ? "checked" : ""} /><span>允许隐藏心情</span></label>
      ${studentOnly ? "" : `<label class="toggle"><input type="checkbox" id="p-mist" ${priv.allowParentMistakeDetail !== false ? "checked" : ""} /><span>允许家长查看错题明细</span></label>
      <label class="toggle"><input type="checkbox" id="p-export" ${priv.allowExport !== false ? "checked" : ""} /><span>允许导出数据</span></label>`}
    </div>`);
    $("[data-back]", root).onclick = back;
    const savePriv = () => {
      const patch = {
        showScores: $("#p-sc", root).checked,
        showLocation: $("#p-loc", root).checked,
        showSelfie: $("#p-selfie", root).checked,
        allowHideMood: $("#p-mood", root).checked,
      };
      if (!studentOnly) {
        patch.allowParentMistakeDetail = $("#p-mist", root).checked;
        patch.allowExport = $("#p-export", root).checked;
      }
      savePrivacy(patch);
      showToast("隐私设置已保存");
    };
    ["#p-sc", "#p-loc", "#p-selfie", "#p-mood", "#p-mist", "#p-export"].forEach((s) => $(s, root)?.addEventListener("change", savePriv));
    return;
  }

  if (section === "data" && role !== "student") {
    root.innerHTML = shell(titles.data, "", "←", `${admin ? renderAdminWalletOverview(user?.familyId) : ""}<div class="card-block"><div class="action-list">
      <button class="btn btn--ghost btn--block" id="ex-j">导出 JSON</button>
      <button class="btn btn--ghost btn--block" id="ex-c">导出 CSV</button>
      <label class="btn btn--ghost btn--block">导入 JSON<input type="file" id="im-j" accept="application/json" hidden /></label>
      <button class="btn btn--ghost btn--block" id="seed">重置演示数据</button>
      <button class="btn btn--danger btn--block" id="clear">清空本地数据</button>
    </div></div>`);
    $("[data-back]", root).onclick = back;
    $("#ex-j", root)?.addEventListener("click", () => {
      if (!getPrivacy().allowExport) return showToast("导出功能已在隐私设置中关闭", "error");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
      a.download = "fuxun-export.json"; a.click();
    });
    $("#ex-c", root)?.addEventListener("click", () => {
      if (!getPrivacy().allowExport) return showToast("导出功能已在隐私设置中关闭", "error");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([exportCsv()], { type: "text/csv" }));
      a.download = "fuxun-records.csv"; a.click();
    });
    $("#im-j", root)?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (f) { importJson(await f.text()); showToast("导入成功"); navigate("/profile"); }
    });
    $("#seed", root)?.addEventListener("click", async () => {
      if (await showConfirm({ title: "重置演示数据", message: "将恢复演示家庭样例数据，确定继续吗？", confirmText: "重置", danger: true })) {
        seedDemo(); showToast("演示数据已重置"); navigate("/home");
      }
    });
    $("#clear", root)?.addEventListener("click", async () => {
      if (await showConfirm({ title: "清空本地数据", message: "所有家庭、复训、打卡数据将被删除，不可恢复。", confirmText: "清空", danger: true })) {
        clearAllData(); navigate("/welcome");
      }
    });
    return;
  }

  navigate("/profile");
}

function renderProfile(root, section) {
  if (section) renderProfileSection(root, section);
  else renderProfileMenu(root);
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
  "train-complete": renderTrainComplete, student: renderStudent, checkin: renderCheckin, coach: renderCoach,
  "coach-parent": renderCoachParent, "coach-honor": renderCoachHonor, hearts: renderHearts, profile: renderProfile,
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
  location.href = `${location.pathname}?v=16c`;
}

function render() {
  try {
    const route = parseRoute();
    if (route.path !== "train-play") exitTrainingFocusMode();
    else hideToast();
    if (!guardRoute(route.path)) return;
    const root = $("#app-root");
    if (!root) return;
    const fn = ROUTES[route.path] || renderBoot;
    if (route.path === "poster") fn(root, route.id);
    else if (route.path === "coach" && (route.id === "father" || route.id === "mother")) {
      renderCoachParent(root, route.id);
    } else if (route.path === "coach-parent") {
      navigate(`/coach/${route.id || getCurrentRole()}`);
      return;
    } else if (route.path === "profile") fn(root, route.id);
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
    const reg = await navigator.serviceWorker.register("./service-worker.js?v=15");
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