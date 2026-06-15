/**
 * 复训星球 — 通用 UI 组件
 */

export const PLANET_LOGO = "🪐";

export const BADGE_LIBRARY = [
  { id: "planet", emoji: "🪐", label: "星球家庭" },
  { id: "drive", emoji: "🚀", label: "自驱家庭" },
  { id: "grow", emoji: "🌱", label: "成长家庭" },
  { id: "champion", emoji: "🏆", label: "冠军家庭" },
  { id: "study", emoji: "📚", label: "学习家庭" },
  { id: "passion", emoji: "🔥", label: "热血家庭" },
  { id: "warm", emoji: "🤗", label: "温暖家庭" },
  { id: "target", emoji: "🎯", label: "目标家庭" },
  { id: "brave", emoji: "🦁", label: "勇敢家庭" },
  { id: "wise", emoji: "🦉", label: "智慧家庭" },
  { id: "star", emoji: "⭐", label: "星光家庭" },
  { id: "cozy", emoji: "🏡", label: "温馨家庭" },
];

export const AVATAR_PRESETS = {
  father: ["👨", "🧔", "👨‍💼", "👨‍🦱", "🧑‍🦳", "👴", "🙂", "😎"],
  mother: ["👩", "👩‍🦰", "👩‍💼", "🧑‍🦱", "👱‍♀️", "☕", "🌸", "😊"],
  child: ["🧑‍🎓", "👦", "👧", "🧒", "😊", "🌟", "⚽", "📖"],
  default: ["👤", "😊", "🌟", "🦸", "🎓"],
};

export const REG_PRESETS = {
  dadHobbies: ["运动", "阅读", "跑步", "旅行", "音乐", "科技", "电影", "做饭", "篮球", "商业", "其他"],
  dadTags: ["理性分析型", "结果导向型", "鼓励陪伴型", "目标管理型", "幽默陪伴型", "行动派", "安静支持型"],
  dadCompanion: ["多表扬", "多赞美", "给方向", "给方法", "帮孩子拆解问题", "陪孩子复盘"],
  momHobbies: ["阅读", "音乐", "瑜伽", "旅行", "电影", "写作", "做饭", "花艺", "运动", "陪伴", "其他"],
  momTags: ["细心陪伴型", "情绪观察型", "计划提醒型", "鼓励支持型", "温柔沟通型", "复盘引导型", "耐心陪伴型"],
  momCompanion: ["做计划", "看心情", "复盘结果", "协助改进", "提醒明日安排", "给孩子温暖反馈"],
  childHobbies: ["阅读", "运动", "音乐", "画画", "游戏", "编程", "科学", "电影", "写作", "篮球", "跑步", "其他"],
  childTags: ["自律型", "慢热型", "容易分心型", "需要鼓励型", "目标感强", "压力敏感型", "行动慢热型", "兴趣驱动型", "需要陪伴型"],
  childSubjects: ["SAT Reading", "English", "Math", "Science", "History", "Writing", "Other"],
};

let toastTimer = null;
let confirmResolve = null;

/* ── Toast / Confirm ── */
export function showToast(message, type = "success") {
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast toast--${type} is-show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-show"), 2800);
}

export function showConfirm({
  title = "请确认", message = "", confirmText = "确认", cancelText = "取消", danger = false,
} = {}) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("confirm-dialog");
    if (!dlg) { resolve(window.confirm(message || title)); return; }
    confirmResolve = resolve;
    dlg.querySelector("[data-confirm-title]").textContent = title;
    dlg.querySelector("[data-confirm-msg]").textContent = message;
    const ok = dlg.querySelector("[data-confirm-ok]");
    const cancel = dlg.querySelector("[data-confirm-cancel]");
    ok.textContent = confirmText;
    cancel.textContent = cancelText;
    ok.className = `btn btn--block ${danger ? "btn--danger" : "btn--primary"}`;
    dlg.showModal();
  });
}

export function initConfirmDialog() {
  const dlg = document.getElementById("confirm-dialog");
  if (!dlg) return;
  dlg.querySelector("[data-confirm-ok]")?.addEventListener("click", () => {
    dlg.close(); confirmResolve?.(true); confirmResolve = null;
  });
  dlg.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => {
    dlg.close(); confirmResolve?.(false); confirmResolve = null;
  });
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault(); dlg.close(); confirmResolve?.(false); confirmResolve = null;
  });
}

/* ── 注册页顶部组合导航 ── */
export function RegisterPageHero() {
  return `<div class="register-hero">
    <p class="register-hero__en">CREATE FAMILY</p>
    <h1 class="register-hero__title">创建复训星球家庭</h1>
    <p class="register-hero__sub">为孩子建立一个可以复训、打卡、优培和成长记录的家庭星球。</p>
  </div>`;
}

export function RegisterNavHeader({ step = 1, total = 3, stepTitle, badgeEmoji, badgeImage, showBack = false }) {
  const pct = Math.round((step / total) * 100);
  const logo = badgeImage
    ? `<img src="${badgeImage}" alt="" class="reg-nav__logo reg-nav__logo--round" />`
    : `<span class="reg-nav__logo reg-nav__logo--round">${badgeEmoji || PLANET_LOGO}</span>`;
  return `<header class="reg-nav">
    <div class="reg-nav__bar">
      <div class="reg-nav__left">
        ${showBack
    ? `<button type="button" class="reg-nav__back" data-step-back>← 上一步</button>`
    : `<span class="reg-nav__pad" aria-hidden="true"></span>`}
      </div>
      <div class="reg-nav__center">
        <h2 class="reg-nav__step-title">${stepTitle}</h2>
        <div class="reg-nav__progress"><div class="reg-nav__bar-track"><i style="width:${pct}%"></i></div><span>${step} / ${total}</span></div>
      </div>
      <div class="reg-nav__right">${logo}</div>
    </div>
  </header>`;
}

export function bindStepBack(root, handler) {
  root.querySelector("[data-step-back]")?.addEventListener("click", handler);
}

/* ── SectionTabs ── */
export function SectionTabs(tabs, activeId) {
  return `<nav class="section-tabs" role="tablist">${tabs.map((t) =>
    `<button type="button" class="section-tabs__btn ${activeId === t.id ? "is-active" : ""}" role="tab" data-tab="${t.id}" aria-selected="${activeId === t.id}">${t.icon ? `<span class="section-tabs__icon">${t.icon}</span>` : ""}${t.label}</button>`
  ).join("")}</nav>`;
}

export function bindSectionTabs(root, onChange) {
  root.querySelectorAll(".section-tabs__btn").forEach((btn) => {
    btn.addEventListener("click", () => onChange(btn.dataset.tab));
  });
}

/* ── 双语字段标签 ── */
export function FieldLabel(zh, en) {
  return `<span class="field__label">${zh}<em>${en}</em></span>`;
}

/* ── AvatarPicker ── */
export function AvatarPickerHTML({
  name, value = "👤", imageValue = "", label = "头像", presets = AVATAR_PRESETS.default,
  avatarType = "emoji", avatarValue = "",
}) {
  const imgName = `${name}Image`;
  const typeVal = imageValue ? "upload" : (avatarType || "emoji");
  const val = imageValue || avatarValue || value;
  const preview = imageValue || (avatarType === "upload" && avatarValue)
    ? `<img src="${imageValue || avatarValue}" alt="" class="avatar-picker__img" />`
    : `<span class="avatar-picker__emoji">${value}</span>`;
  return `<div class="avatar-picker" data-avatar-picker="${name}" data-default-emoji="${presets[0] || "👤"}">
    <span class="field-label">${label}</span>
    <div class="avatar-picker__preview avatar-picker__preview--round">${preview}</div>
    <input type="hidden" name="${name}" value="${value}" data-avatar-emoji />
    <input type="hidden" name="${imgName}" value="${imageValue || ""}" data-avatar-image />
    <input type="hidden" name="${name}Type" value="${typeVal}" data-avatar-type />
    <input type="hidden" name="${name}Value" value="${val}" data-avatar-value />
    <div class="avatar-picker__grid">${presets.map((e) =>
      `<button type="button" class="avatar-picker__opt ${e === value && !imageValue ? "is-active" : ""}" data-emoji="${e}">${e}</button>`
    ).join("")}</div>
    <div class="avatar-picker__acts">
      <label class="btn btn--ghost btn--sm picker-upload">上传图片<input type="file" accept="image/*" hidden data-avatar-upload /></label>
      <button type="button" class="btn btn--ghost btn--sm" data-avatar-clear>删除 / 恢复</button>
    </div>
  </div>`;
}

function syncAvatarHidden(wrap, { emoji, image, type, value }) {
  wrap.querySelector("[data-avatar-emoji]").value = emoji;
  wrap.querySelector("[data-avatar-image]").value = image || "";
  wrap.querySelector("[data-avatar-type]").value = type;
  wrap.querySelector("[data-avatar-value]").value = value;
}

export function bindAvatarPickers(root) {
  root.querySelectorAll("[data-avatar-picker]").forEach((wrap) => {
    const preview = wrap.querySelector(".avatar-picker__preview");
    const def = wrap.dataset.defaultEmoji || "👤";

    const setEmoji = (emoji) => {
      preview.innerHTML = `<span class="avatar-picker__emoji">${emoji}</span>`;
      syncAvatarHidden(wrap, { emoji, image: "", type: "emoji", value: emoji });
      wrap.querySelectorAll("[data-emoji]").forEach((b) => b.classList.toggle("is-active", b.dataset.emoji === emoji));
    };

    wrap.querySelectorAll("[data-emoji]").forEach((btn) => {
      btn.addEventListener("click", () => setEmoji(btn.dataset.emoji));
    });

    wrap.querySelector("[data-avatar-upload]")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await readImageThumb(file);
      preview.innerHTML = `<img src="${url}" alt="" class="avatar-picker__img" />`;
      syncAvatarHidden(wrap, { emoji: wrap.querySelector("[data-avatar-emoji]").value, image: url, type: "upload", value: url });
      wrap.querySelectorAll("[data-emoji]").forEach((b) => b.classList.remove("is-active"));
    });

    wrap.querySelector("[data-avatar-clear]")?.addEventListener("click", () => setEmoji(def));
  });
}

/* ── FamilyBadgePicker ── */
export function FamilyBadgePickerHTML({
  name = "badge", value = "🪐", imageValue = "", imageName = "badgeImage",
  badgeId = "planet", badgeType = "default", badgeValue = "",
  labelZh = "家庭徽章", labelEn = "Family Badge",
}) {
  const typeVal = imageValue ? "upload" : (badgeType || "default");
  const val = badgeValue || imageValue || value;
  const preview = imageValue
    ? `<img src="${imageValue}" alt="" class="badge-picker__img" />`
    : `<span class="badge-picker__emoji">${value}</span>`;
  return `<div class="badge-picker" data-badge-picker>
    ${FieldLabel(labelZh, labelEn)}
    <div class="badge-picker__preview badge-picker__preview--round">${preview}</div>
    <input type="hidden" name="${name}" value="${value}" data-badge-emoji />
    <input type="hidden" name="${imageName}" value="${imageValue || ""}" data-badge-image />
    <input type="hidden" name="badgeId" value="${badgeId}" data-badge-id />
    <input type="hidden" name="badgeType" value="${typeVal}" data-badge-type />
    <input type="hidden" name="badgeValue" value="${val}" data-badge-value />
    <div class="badge-picker__grid badge-picker__grid--named">${BADGE_LIBRARY.map((b) =>
      `<button type="button" class="badge-picker__opt ${b.emoji === value && !imageValue ? "is-active" : ""}" data-badge="${b.emoji}" data-badge-id="${b.id}" title="${b.label}">
        <span class="badge-picker__opt-emoji">${b.emoji}</span><span class="badge-picker__opt-label">${b.label}</span></button>`
    ).join("")}</div>
    <div class="badge-picker__acts">
      <label class="btn btn--ghost btn--sm picker-upload">上传 Logo<input type="file" accept="image/*" hidden data-badge-upload /></label>
      <button type="button" class="btn btn--ghost btn--sm" data-badge-clear>删除 / 更换</button>
    </div>
  </div>`;
}

function syncBadgeHidden(wrap, { emoji, image, id, type, value }) {
  wrap.querySelector("[data-badge-emoji]").value = emoji;
  wrap.querySelector("[data-badge-image]").value = image || "";
  wrap.querySelector("[data-badge-id]").value = id || "";
  wrap.querySelector("[data-badge-type]").value = type;
  wrap.querySelector("[data-badge-value]").value = value;
}

export function bindFamilyBadgePicker(root, onChange) {
  root.querySelectorAll("[data-badge-picker]").forEach((wrap) => {
    const preview = wrap.querySelector(".badge-picker__preview");

    const apply = (emoji, image, id, type, value) => {
      preview.innerHTML = image
        ? `<img src="${image}" alt="" class="badge-picker__img" />`
        : `<span class="badge-picker__emoji">${emoji}</span>`;
      syncBadgeHidden(wrap, { emoji, image, id, type, value });
      wrap.querySelectorAll("[data-badge]").forEach((b) => {
        b.classList.toggle("is-active", !image && b.dataset.badge === emoji);
      });
      onChange?.({ emoji, image, id, type, value });
    };

    wrap.querySelectorAll("[data-badge]").forEach((btn) => {
      btn.addEventListener("click", () => apply(btn.dataset.badge, "", btn.dataset.badgeId, "default", btn.dataset.badgeId));
    });

    wrap.querySelector("[data-badge-upload]")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await readImageThumb(file, 128);
      apply(wrap.querySelector("[data-badge-emoji]").value, url, "", "upload", url);
    });

    wrap.querySelector("[data-badge-clear]")?.addEventListener("click", () => apply("🪐", "", "planet", "default", "planet"));
  });
}

/* ── TagSelect ── */
export function TagSelectHTML({ name, label, labelEn = "", presets = [], selected = [], placeholder = "添加标签", multi = true }) {
  const sel = Array.isArray(selected) ? selected : String(selected || "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
  const en = labelEn ? `<em>${labelEn}</em>` : "";
  return `<div class="tag-select" data-tag-select="${name}" data-multi="${multi ? "1" : "0"}">
    <span class="field-label">${label}${en}</span>
    <input type="hidden" name="${name}" value="${sel.join(",")}" data-tag-value />
    <div class="tag-select__chips" data-tag-chips>${sel.map((t) =>
      `<button type="button" class="tag-chip is-on" data-tag="${t}">${t} ×</button>`
    ).join("")}</div>
    <div class="tag-select__presets">${presets.map((t) =>
      `<button type="button" class="tag-chip ${sel.includes(t) ? "is-on" : ""}" data-preset="${t}">${t}</button>`
    ).join("")}</div>
    <div class="tag-select__add">
      <input type="text" placeholder="${placeholder}" data-tag-input />
      <button type="button" class="btn btn--ghost btn--sm" data-tag-add>添加</button>
    </div>
  </div>`;
}

export function bindTagSelects(root) {
  root.querySelectorAll("[data-tag-select]").forEach((wrap) => {
    const hidden = wrap.querySelector("[data-tag-value]");
    const chips = wrap.querySelector("[data-tag-chips]");
    const input = wrap.querySelector("[data-tag-input]");
    const multi = wrap.dataset.multi !== "0";

    const getTags = () => hidden.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);

    const sync = (tags) => {
      const uniq = [...new Set(tags)].slice(0, 10);
      hidden.value = uniq.join(",");
      chips.innerHTML = uniq.map((t) =>
        `<button type="button" class="tag-chip is-on" data-tag="${t}">${t} ×</button>`
      ).join("");
      bindChipRemove();
      wrap.querySelectorAll("[data-preset]").forEach((b) => {
        b.classList.toggle("is-on", uniq.includes(b.dataset.preset));
      });
    };

    const bindChipRemove = () => {
      chips.querySelectorAll("[data-tag]").forEach((btn) => {
        btn.addEventListener("click", () => sync(getTags().filter((t) => t !== btn.dataset.tag)));
      });
    };

    wrap.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tags = getTags();
        const t = btn.dataset.preset;
        if (!multi) { sync([t]); return; }
        sync(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
      });
    });

    const addCustom = () => {
      const t = input.value.trim();
      if (!t) return;
      sync(multi ? [...getTags(), t] : [t]);
      input.value = "";
    };

    wrap.querySelector("[data-tag-add]")?.addEventListener("click", addCustom);
    input?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
    bindChipRemove();
  });
}

/* ── 陪伴风格卡片 ── */
export function CoachingStyleCardsHTML({ name = "coachingStyle", value = "balance", options = [] }) {
  return `<div class="coaching-cards" data-coaching-cards>
    ${FieldLabel("家庭陪伴风格", "Coaching Style")}
    <input type="hidden" name="${name}" value="${value}" data-coaching-value />
    <div class="coaching-cards__grid">${options.map((o) =>
      `<button type="button" class="coaching-card ${value === o.id ? "is-active" : ""}" data-style="${o.id}">
        <strong>${o.label}</strong><p>${o.desc || ""}</p></button>`
    ).join("")}</div>
  </div>`;
}

export function bindCoachingStyleCards(root) {
  root.querySelectorAll("[data-coaching-cards]").forEach((wrap) => {
    const hidden = wrap.querySelector("[data-coaching-value]");
    wrap.querySelectorAll("[data-style]").forEach((btn) => {
      btn.addEventListener("click", () => {
        hidden.value = btn.dataset.style;
        wrap.querySelectorAll("[data-style]").forEach((b) => b.classList.toggle("is-active", b.dataset.style === btn.dataset.style));
      });
    });
  });
}

/* ── 密码字段 ── */
export function PasswordFieldHTML({ minLength = 6 } = {}) {
  return `<label class="field field--password">
    ${FieldLabel("密码", "Password")}
    <div class="password-wrap">
      <input name="password" type="password" required minlength="${minLength}" autocomplete="new-password" data-password-input />
      <button type="button" class="password-toggle" data-toggle-pw>显示</button>
    </div>
    <span class="field-hint">密码至少 ${minLength} 位</span>
  </label>`;
}

export function bindPasswordFields(root) {
  root.querySelectorAll("[data-toggle-pw]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inp = btn.closest(".password-wrap")?.querySelector("[data-password-input]");
      if (!inp) return;
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
      btn.textContent = show ? "隐藏" : "显示";
    });
  });
}

/* ── SingleSelect ── */
export function SingleSelectHTML({ name, label, labelEn = "", options, value }) {
  const en = labelEn ? `<em>${labelEn}</em>` : "";
  return `<label class="field field--select">
    <span class="field__label">${label}${en}</span>
    <select name="${name}" class="single-select">${options.map((o) => {
      const v = typeof o === "string" ? o : o.value;
      const l = typeof o === "string" ? o : o.label;
      return `<option value="${v}" ${value === v ? "selected" : ""}>${l}</option>`;
    }).join("")}</select>
  </label>`;
}

export function InfoCard(message, icon = "💡") {
  return `<div class="info-card"><span class="info-card__icon">${icon}</span><p>${message}</p></div>`;
}

export function WarnCard(message, icon = "⚠️") {
  return `<div class="warn-card"><span class="warn-card__icon">${icon}</span><p>${message}</p></div>`;
}

export function RemindCard(message, icon = "📌") {
  return `<div class="remind-card"><span class="remind-card__icon">${icon}</span><p>${message}</p></div>`;
}

export function EmptyCard(message, icon = "📭") {
  return `<div class="empty-card"><span class="empty-card__icon">${icon}</span><p>${message}</p></div>`;
}

/* ── 成员表单卡 ── */
export function MemberFormCard(title, roleClass, body) {
  return `<article class="member-form-card member-form-card--${roleClass}"><h3 class="member-form-card__title">${title}</h3>${body}</article>`;
}

/* ── 注册确认卡 ── */
export function RegisterConfirmCard(d, coachingLabel, inviteCode) {
  const badge = renderFamilyBadge(d, "confirm-badge");
  const row = (avatar, name, tags) => `
    <div class="confirm-member">
      <div class="confirm-member__av">${avatar}</div>
      <div><strong>${name}</strong><div class="tag-row">${(tags || []).map((t) => `<span class="tag">${t}</span>`).join("") || ""}</div></div>
    </div>`;
  return `<section class="card-block confirm-card">
    <div class="confirm-card__head">${badge}<div><h3>${d.familyName || "家庭"}</h3><p class="confirm-motto">${d.motto || ""}</p></div></div>
    <p class="confirm-row"><span>陪伴风格</span><strong>${coachingLabel}</strong></p>
    ${row(renderAvatarFromData(d, "dad"), d.dadName || "爸爸", tagList(d.dadTags))}
    ${row(renderAvatarFromData(d, "mom"), d.momName || "妈妈", tagList(d.momTags))}
    ${row(renderAvatarFromData(d, "child"), `${d.childName || "孩子"}${d.childNickname ? ` / ${d.childNickname}` : ""}`, [...tagList(d.childTags), d.childGrade].filter(Boolean))}
    <p class="confirm-row"><span>学习目标</span><strong>${d.learningGoal || "—"}</strong></p>
    <p class="confirm-row"><span>主要科目</span><strong>${tagList(d.childSubjects).join(" · ") || "—"}</strong></p>
    <p class="confirm-row confirm-row--code"><span>家庭邀请码</span><strong class="invite-code">${inviteCode}</strong></p>
  </section>`;
}

function tagList(raw) {
  if (Array.isArray(raw)) return raw;
  return String(raw || "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
}

function renderAvatarFromData(d, role) {
  const map = {
    dad: { emoji: d.dadAvatar, image: d.dadAvatarImage, type: d.dadAvatarType, value: d.dadAvatarValue },
    mom: { emoji: d.momAvatar, image: d.momAvatarImage, type: d.momAvatarType, value: d.momAvatarValue },
    child: { emoji: d.childAvatar, image: d.childAvatarImage, type: d.childAvatarType, value: d.childAvatarValue },
  };
  return renderAvatar(map[role], "confirm-avatar");
}

/* ── 全局头像 / 徽章展示 ── */
export function getAvatarDisplay(entity) {
  if (!entity) return { kind: "emoji", display: "👤" };
  if (entity.avatarType === "upload" || entity.avatarImage) {
    return { kind: "img", display: entity.avatarValue || entity.avatarImage };
  }
  return { kind: "emoji", display: entity.avatar || entity.avatarValue || "👤" };
}

export function renderAvatar(entity, className = "member-avatar") {
  const a = getAvatarDisplay(entity);
  if (a.kind === "img") return `<img src="${a.display}" alt="" class="${className} ${className}--img" />`;
  return `<span class="${className}">${a.display}</span>`;
}

export function getBadgeDisplay(family) {
  if (!family) return { kind: "emoji", display: PLANET_LOGO };
  if (family.badgeType === "upload" || family.badgeImage) {
    return { kind: "img", display: family.badgeValue || family.badgeImage };
  }
  const lib = BADGE_LIBRARY.find((b) => b.id === family.badgeValue || b.id === family.badgeId);
  if (lib) return { kind: "emoji", display: lib.emoji };
  return { kind: "emoji", display: family.badge || family.badgeValue || PLANET_LOGO };
}

export function renderFamilyBadge(familyOrData, className = "family-badge") {
  const f = familyOrData;
  const b = getBadgeDisplay({
    badge: f.badge,
    badgeImage: f.badgeImage,
    badgeType: f.badgeType,
    badgeValue: f.badgeValue,
    badgeId: f.badgeId,
  });
  if (b.kind === "img") return `<img src="${b.display}" alt="" class="${className} ${className}--img ${className}--round" />`;
  return `<span class="${className} ${className}--round">${b.display}</span>`;
}

function readImageThumb(file, max = 96) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}