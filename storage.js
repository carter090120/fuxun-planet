/**
 * 复训星球 — localStorage 数据层（预留 API 替换）
 */
import { ensureGrowthAssets } from "./growthAssets.js";

export const STORAGE_KEY = "fuxun-planet-v1";

export const COACHING_STYLES = [
  { id: "encourage", label: "鼓励型", desc: "多认可孩子的努力，少批评。" },
  { id: "goal", label: "目标型", desc: "关注目标、结果和下一步行动。" },
  { id: "balance", label: "平衡型", desc: "既看见努力，也帮助改进。" },
  { id: "gentle", label: "温和监督型", desc: "保持提醒，但不过度施压。" },
];

export const PARENT_RESPONSE_PREFS = [
  "只鼓励我", "帮我分析方法", "明天提醒我", "暂时不要说太多", "一起制定计划",
];

export const MOODS = ["😊 开心", "😌 平静", "😤 有压力", "😴 疲惫", "🔥 充满干劲"];
export const ENERGY = ["充沛", "正常", "偏低", "很累"];

export const STATUS_OPTIONS = [
  { id: "full", label: "完成", rate: 1 },
  { id: "mostly", label: "基本完成", rate: 0.8 },
  { id: "half", label: "部分完成", rate: 0.5 },
  { id: "none", label: "未完成", rate: 0 },
];

export const MISTAKE_REASONS = ["粗心", "概念不清", "审题错误", "词汇不熟", "推理跳跃", "证据不足"];

export const ABILITIES = [
  { id: "focus", name: "专注学习能力", icon: "🎯", max: 20, items: [
    { id: "focus_task", label: "今日重点任务完成", max: 5 },
    { id: "focus_social", label: "远离微信及社交软件", max: 5 },
    { id: "focus_snack", label: "无零食干扰", max: 3 },
    { id: "focus_restroom", label: "提前如厕", max: 2 },
    { id: "focus_continuous", label: "保持连续专注学习", max: 5 },
  ]},
  { id: "self", name: "自我管理能力", icon: "🧭", max: 20, items: [
    { id: "self_room", label: "房间整齐", max: 3, group: "环境管理" },
    { id: "self_desk", label: "书桌整齐", max: 4, group: "环境管理" },
    { id: "self_bath", label: "卫生间整洁", max: 3, group: "环境管理" },
    { id: "self_clothes", label: "运动后10分钟换衣", max: 3, group: "身体管理" },
    { id: "self_water", label: "主动补水", max: 3, group: "身体管理" },
    { id: "self_sleep", label: "作息规律", max: 4, group: "身体管理" },
  ]},
  { id: "organize", name: "学习整理能力", icon: "📚", max: 20, items: [
    { id: "org_notes", label: "笔记整理", max: 4 },
    { id: "org_mistakes", label: "错题整理", max: 4 },
    { id: "org_review", label: "当日复习", max: 4 },
    { id: "org_homework", label: "优先完成作业", max: 4 },
    { id: "org_bedtime", label: "睡前回顾", max: 4 },
  ]},
  { id: "vocab", name: "词汇积累能力", icon: "🔤", max: 15, items: [
    { id: "voc_sat", label: "SAT词汇", max: 6 },
    { id: "voc_math", label: "数学专业词汇", max: 6 },
    { id: "voc_news", label: "新闻/阅读生词", max: 3 },
  ]},
  { id: "reading", name: "阅读积累能力", icon: "📖", max: 10, items: [
    { id: "read_time", label: "读书30分钟以上", max: 5 },
    { id: "read_quote", label: "好词好句摘录", max: 5 },
  ]},
  { id: "reflect", name: "复盘成长能力", icon: "🌱", max: 15, items: [
    { id: "ref_date", label: "写日期并完成复盘", max: 5 },
    { id: "ref_highlight", label: "记录今日亮点", max: 5 },
    { id: "ref_improve", label: "记录改进措施", max: 5 },
  ]},
];

const GRADE_TABLE = [
  { min: 97, letter: "A+", label: "卓越" }, { min: 95, letter: "A+", label: "杰出" },
  { min: 93, letter: "A", label: "优秀" }, { min: 90, letter: "A-", label: "很好" },
  { min: 87, letter: "B+", label: "良好" }, { min: 83, letter: "B", label: "达标" },
  { min: 80, letter: "B-", label: "基本达标" }, { min: 77, letter: "C+", label: "需提升" },
  { min: 73, letter: "C", label: "需努力" }, { min: 70, letter: "C-", label: "预警" },
  { min: 60, letter: "D", label: "严重需改进" }, { min: 0, letter: "F", label: "不合格" },
];

const DEFAULT_STATE = {
  version: 1,
  session: null,
  families: [],
  members: [],
  users: [],
  materials: [],
  materialImages: [],
  photoMistakeRecords: [],
  mistakes: [],
  trainingSessions: [],
  dailyRecords: [],
  coachingActions: [],
  notifications: [],
  parentWallets: [],
  studentWallets: [],
  pointTransactions: [],
  marketKlines: [],
  growthMarket: null,
  privacy: {
    showScores: true, showLocation: true, showSelfie: true,
    allowHideMood: true, allowParentMistakeDetail: true, allowExport: true,
  },
};

export function uid() { return crypto.randomUUID(); }
export function genCode(n = 6) { return Math.random().toString(36).slice(2, 2 + n).toUpperCase(); }
export function nowIso() { return new Date().toISOString(); }

function migrateNotifications(list) {
  const dk = formatDateKey();
  return (list || []).map((n) => ({
    ...n,
    type: n.type || "heart",
    dateKey: n.dateKey || (n.createdAt ? String(n.createdAt).slice(0, 10) : dk),
    read: !!n.read,
  }));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const p = JSON.parse(raw);
    const merged = {
      ...structuredClone(DEFAULT_STATE),
      ...p,
      session: p.session ?? null,
      privacy: { ...DEFAULT_STATE.privacy, ...(p.privacy || {}) },
      families: p.families || [],
      members: p.members || [],
      users: p.users || [],
      materials: p.materials || [],
      materialImages: p.materialImages || [],
      photoMistakeRecords: p.photoMistakeRecords || [],
      mistakes: p.mistakes || [],
      trainingSessions: p.trainingSessions || [],
      dailyRecords: p.dailyRecords || [],
      coachingActions: p.coachingActions || [],
      notifications: migrateNotifications(p.notifications),
      parentWallets: p.parentWallets || [],
      studentWallets: p.studentWallets || [],
      pointTransactions: p.pointTransactions || [],
      marketKlines: p.marketKlines || [],
      growthMarket: p.growthMarket ?? null,
    };
    const { state: ensured, changed } = ensureGrowthAssets(merged);
    if (changed) saveState(ensured);
    return ensured;
  } catch { return structuredClone(DEFAULT_STATE); }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function patchState(fn) {
  const s = loadState();
  fn(s);
  saveState(s);
  return s;
}

/* ── Scoring ── */
export function roundScore(v) { return Math.round(v * 10) / 10; }
export function formatScore(v) {
  const n = roundScore(Number(v) || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
export function normalizeStatus(st) {
  return STATUS_OPTIONS.some((o) => o.id === st) ? st : "full";
}
export function scoreFromStatus(max, st) {
  const o = STATUS_OPTIONS.find((x) => x.id === normalizeStatus(st));
  return o?.rate ? roundScore(max * o.rate) : 0;
}
export function statusLabel(st) {
  return STATUS_OPTIONS.find((x) => x.id === normalizeStatus(st))?.label || "完成";
}
export function calcAbilityScores(formItems) {
  return ABILITIES.map((ab) => {
    const items = ab.items.map((it) => {
      const status = normalizeStatus(formItems[it.id] || "full");
      return { ...it, status, score: scoreFromStatus(it.max, status) };
    });
    return { id: ab.id, name: ab.name, max: ab.max, score: roundScore(items.reduce((s, i) => s + i.score, 0)), items };
  });
}
export function calcTotal(abilities) {
  return roundScore(abilities.reduce((s, a) => s + a.score, 0));
}
export function getGrade(total) {
  const row = GRADE_TABLE.find((g) => total >= g.min) || GRADE_TABLE.at(-1);
  return { ...row, total };
}
export function formatDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function formatDateTime(d = new Date()) {
  return `${formatDateKey(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── Family scoped queries ── */
export function getFamily(familyId) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().families.find((f) => f.familyId === fid) || null;
}
export function getMembers(familyId) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().members.filter((m) => m.familyId === fid);
}
export function getMember(memberId) {
  return loadState().members.find((m) => m.memberId === memberId) || null;
}
export function getStudentMember(familyId) {
  return getMembers(familyId).find((m) => m.role === "student") || null;
}
export function getUser(userId) {
  return loadState().users.find((u) => u.userId === userId) || null;
}
export function updateMember(memberId, patch) {
  patchState((s) => {
    const i = s.members.findIndex((m) => m.memberId === memberId);
    if (i !== -1) s.members[i] = { ...s.members[i], ...patch };
  });
}
export function updateFamily(familyId, patch) {
  patchState((s) => {
    const i = s.families.findIndex((f) => f.familyId === familyId);
    if (i !== -1) s.families[i] = { ...s.families[i], ...patch };
  });
}

export function getMaterials(familyId) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().materials.filter((m) => m.familyId === fid).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
export function addMaterial(mat) {
  let created;
  patchState((s) => {
    created = {
      materialId: uid(),
      importedAt: nowIso(),
      importMethod: "text",
      images: [],
      ocrText: "",
      manualConfirmRequired: false,
      ...mat,
    };
    s.materials.unshift(created);
  });
  return created;
}

export function getMaterialImages(familyId, materialId) {
  const fid = familyId || loadState().session?.familyId;
  let list = loadState().materialImages.filter((m) => m.familyId === fid);
  if (materialId) list = list.filter((m) => m.materialId === materialId);
  return list.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function addMaterialImages(records) {
  let saved = [];
  patchState((s) => {
    saved = records.map((r) => ({ imageId: uid(), capturedAt: nowIso(), parseStatus: "pending", ...r }));
    s.materialImages.unshift(...saved);
  });
  return saved;
}

export function updateMaterialImage(imageId, patch) {
  patchState((s) => {
    const i = s.materialImages.findIndex((x) => x.imageId === imageId);
    if (i !== -1) s.materialImages[i] = { ...s.materialImages[i], ...patch };
  });
}

export function getPhotoMistakes(familyId, materialId) {
  const fid = familyId || loadState().session?.familyId;
  let list = loadState().photoMistakeRecords.filter((m) => m.familyId === fid);
  if (materialId) list = list.filter((m) => m.materialId === materialId);
  return list;
}

export function upsertPhotoMistakes(list) {
  patchState((s) => {
    list.forEach((m) => {
      const i = s.photoMistakeRecords.findIndex((x) => x.mistakeId === m.mistakeId);
      const rec = { createdAt: nowIso(), ...m };
      if (i === -1) s.photoMistakeRecords.unshift(rec);
      else s.photoMistakeRecords[i] = rec;
    });
  });
}
export function getMistakes(familyId, dateKey) {
  const fid = familyId || loadState().session?.familyId;
  let list = loadState().mistakes.filter((m) => m.familyId === fid);
  if (dateKey) list = list.filter((m) => m.dateKey === dateKey);
  return list;
}
export function upsertMistakes(list) {
  patchState((s) => {
    list.forEach((m) => {
      const i = s.mistakes.findIndex((x) => x.mistakeId === m.mistakeId);
      if (i === -1) s.mistakes.unshift(m);
      else s.mistakes[i] = m;
    });
  });
}
export function getTodayMistakes(familyId) {
  return getMistakes(familyId, formatDateKey()).filter((m) => !m.isCorrect);
}

export function getTrainingSessions(familyId) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().trainingSessions.filter((t) => t.familyId === fid);
}
export function saveTrainingSession(session) {
  let saved;
  patchState((s) => {
    const i = s.trainingSessions.findIndex((t) => t.sessionId === session.sessionId);
    saved = session;
    if (i === -1) s.trainingSessions.unshift(session);
    else s.trainingSessions[i] = session;
  });
  return saved;
}

export function getDailyRecords(familyId) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().dailyRecords.filter((r) => r.familyId === fid).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
export function getTodayRecord(familyId) {
  return getDailyRecords(familyId).find((r) => r.dateKey === formatDateKey()) || null;
}
export function upsertDailyRecord(rec) {
  let saved;
  patchState((s) => {
    const id = rec.recordId || uid();
    saved = { ...rec, recordId: id };
    const i = s.dailyRecords.findIndex((r) => r.recordId === id);
    if (i === -1) s.dailyRecords.unshift(saved);
    else s.dailyRecords[i] = saved;
  });
  return saved;
}
export function getRecord(recordId) {
  return loadState().dailyRecords.find((r) => r.recordId === recordId) || null;
}

export function addCoachingAction(action) {
  let created;
  patchState((s) => {
    created = { actionId: uid(), createdAt: nowIso(), dateKey: formatDateKey(), ...action };
    s.coachingActions.unshift(created);
  });
  return created;
}
export function getCoachingActions(familyId, dateKey) {
  const fid = familyId || loadState().session?.familyId;
  return loadState().coachingActions.filter((a) => a.familyId === fid && (!dateKey || a.dateKey === dateKey));
}

export function getPrivacy() { return loadState().privacy || DEFAULT_STATE.privacy; }
export function savePrivacy(p) { patchState((s) => { s.privacy = { ...s.privacy, ...p }; }); }

export function exportJson() { return JSON.stringify(loadState(), null, 2); }
export function importJson(text) {
  const current = loadState();
  const incoming = JSON.parse(text);
  const merged = {
    ...structuredClone(DEFAULT_STATE),
    ...incoming,
    session: current.session,
    privacy: { ...DEFAULT_STATE.privacy, ...(incoming.privacy || {}) },
    notifications: migrateNotifications(incoming.notifications),
    parentWallets: incoming.parentWallets || [],
    studentWallets: incoming.studentWallets || [],
    pointTransactions: incoming.pointTransactions || [],
    marketKlines: incoming.marketKlines || [],
    growthMarket: incoming.growthMarket ?? null,
  };
  const { state: ensured } = ensureGrowthAssets(merged);
  saveState(ensured);
}
export function exportCsv() {
  const recs = getDailyRecords();
  const h = ["dateKey", "totalScore", "grade", "mood", "studyContent"];
  return [h.join(","), ...recs.map((r) => h.map((k) => `"${String(k === "grade" ? r.grade?.letter : r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
}
export function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  ["fsgrowth-v3", "fsgrowth-v2", "fsgrowth-v1", "study-habit-v1", "study-habit-pwa"].forEach((k) => localStorage.removeItem(k));
}

/** 迁移：清除旧版学习习惯 App 缓存键 */
export function migrateLegacyStorage() {
  ["fsgrowth-v3", "fsgrowth-v2", "fsgrowth-v1", "study-habit-v1"].forEach((k) => localStorage.removeItem(k));
}

export function todayStatus(familyId) {
  const fid = familyId || loadState().session?.familyId;
  const rec = getTodayRecord(fid);
  const mistakes = getTodayMistakes(fid);
  const sessions = getTrainingSessions(fid).filter((t) => t.dateKey === formatDateKey());
  const active = sessions.find((t) => t.status === "active" || t.status === "paused_exit");
  const done = sessions.some((t) => t.status === "completed");
  const student = getStudentMember(fid);
  const studentUserId = loadState().users.find((u) => u.memberId === student?.memberId)?.userId;
  const dk = formatDateKey();
  const hearts = loadState().notifications.filter(
    (n) => n.type === "heart" && n.userId === studentUserId
      && (n.dateKey === dk || String(n.createdAt || "").startsWith(dk)),
  );
  return {
    checkedIn: !!rec,
    totalScore: rec?.totalScore,
    grade: rec?.grade,
    mistakeCount: mistakes.length,
    trainingDone: done,
    trainingProgress: active ? `${active.pool?.length || 0} 题待清零` : (done ? "已完成" : "未开始"),
    mood: rec?.mood,
    energy: rec?.energy,
    tomorrowPlan: rec?.tomorrowPlan,
    heartsToday: hearts.length,
    hasEncouragement: hearts.length > 0,
  };
}

export function hasParentSentToday(role, familyId) {
  const fid = familyId || loadState().session?.familyId;
  return getCoachingActions(fid, formatDateKey()).some((a) => a.parentRole === role);
}

export const DataStore = { loadState, saveState, getFamily, getDailyRecords, upsertDailyRecord };