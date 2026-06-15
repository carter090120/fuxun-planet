/**
 * 复训星球 — 积分流水与父母加减分逻辑
 */
import {
  loadState, patchState, getStudentMember, nowIso, uid, formatDateKey,
} from "./storage.js";
import {
  ensureGrowthAssets,
  getParentWalletByRole,
  getStudentWalletFromState,
  assertParentWalletAccess,
} from "./growthAssets.js";
import { getCurrentUser, getSession } from "./auth.js";
import { upsertMarketKline } from "./marketKline.js";

export const MAX_REWARD_POINTS = 500;
export const MAX_DEDUCTION_POINTS = 200;

export const MSG_REWARD_SUCCESS = (name, points) =>
  `已奖励 ${name} ${points} 分，成长大盘将同步更新。`;
export const MSG_DEDUCT_SUCCESS = "已记录一次扣分提醒，请确保同时给出具体改进方法。";
export const MSG_INSUFFICIENT_WALLET = "当前优培积分不足，无法发放该奖励。";

function normalizePoints(value, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "积分必须为正整数" };
  if (n > max) return { ok: false, error: `单次最多 ${max} 分` };
  return { ok: true, points: n };
}

function resolveActor(parentRole, opts = {}) {
  const user = opts.user ?? getCurrentUser();
  const session = opts.session ?? getSession();
  if (!user || !session?.familyId) {
    return { ok: false, error: "请先登录" };
  }
  if (user.role === "student") {
    return { ok: false, error: "孩子不能给自己加分" };
  }
  if (!parentRole || !["father", "mother"].includes(parentRole)) {
    return { ok: false, error: "请指定爸爸或妈妈角色" };
  }
  if (user.role !== "admin" && user.role !== parentRole) {
    return { ok: false, error: parentRole === "father" ? "只能使用爸爸钱包" : "只能使用妈妈钱包" };
  }
  return { ok: true, user, familyId: session.familyId, userRole: user.role };
}

function syncGrowthMarketWallets(state, familyId) {
  const gm = state.growthMarket;
  if (!gm || gm.familyId !== familyId) return;
  const father = state.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "father");
  const mother = state.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "mother");
  gm.wallets = {
    father: father?.balance ?? gm.wallets?.father,
    mother: mother?.balance ?? gm.wallets?.mother,
  };
}

function touchStudentAssets(wallet, delta) {
  wallet.balance = Math.max(0, (wallet.balance || 0) + delta);
  wallet.totalGrowthAssets = wallet.balance;
  wallet.todayNetChange = (wallet.todayNetChange || 0) + delta;
  wallet.updatedAt = nowIso();
}

export function createPointTransaction(state, data) {
  if (!Array.isArray(state.pointTransactions)) state.pointTransactions = [];
  const tx = {
    transactionId: uid(),
    familyId: data.familyId,
    studentId: data.studentId,
    fromUserId: data.fromUserId,
    fromRole: data.fromRole,
    type: data.type,
    points: data.points,
    reason: data.reason || "",
    advice: data.advice || "",
    relatedRecordId: data.relatedRecordId || null,
    affectsMarket: !!data.affectsMarket,
    affectsInvestment: !!data.affectsInvestment,
    createdAt: data.createdAt || nowIso(),
  };
  state.pointTransactions.unshift(tx);
  return tx;
}

export function getPointTransactions(familyId, opts = {}) {
  const fid = familyId || getSession()?.familyId;
  let list = (loadState().pointTransactions || []).filter((t) => t.familyId === fid);
  if (opts.studentId) list = list.filter((t) => t.studentId === opts.studentId);
  if (opts.type) list = list.filter((t) => t.type === opts.type);
  const limit = opts.limit ?? list.length;
  return list.slice(0, limit);
}

export function getWalletSummary(familyId) {
  const fid = familyId || getSession()?.familyId;
  const state = loadState();
  ensureGrowthAssets(state);
  const student = getStudentMember(fid);
  const fatherW = getParentWalletByRole(state, fid, "father");
  const motherW = getParentWalletByRole(state, fid, "mother");
  const studentW = student
    ? getStudentWalletFromState(state, fid, student.memberId)
    : null;
  const gm = state.growthMarket?.familyId === fid ? state.growthMarket : null;
  return {
    familyId: fid,
    studentName: student?.name || "孩子",
    father: fatherW ? { ...fatherW } : null,
    mother: motherW ? { ...motherW } : null,
    student: studentW ? { ...studentW } : null,
    growthMarket: gm ? {
      baseIndex: gm.baseIndex,
      currentIndex: gm.currentIndex ?? gm.index,
      level: gm.level,
      todayChange: gm.todayChange,
    } : null,
    recentTransactions: getPointTransactions(fid, { limit: 10 }),
  };
}

export function rewardStudent({
  parentRole, points, reason = "", relatedRecordId = null, user: actorUser,
}) {
  const actor = resolveActor(parentRole, { user: actorUser });
  if (!actor.ok) return actor;

  const pts = normalizePoints(points, MAX_REWARD_POINTS);
  if (!pts.ok) return pts;

  const state = loadState();
  const student = getStudentMember(actor.familyId);
  if (!student) return { ok: false, error: "未找到孩子成员" };

  ensureGrowthAssets(state);
  const parentWallet = getParentWalletByRole(state, actor.familyId, parentRole);
  const access = assertParentWalletAccess(actor.userRole, parentWallet);
  if (!access.ok) return access;

  if (parentWallet.balance < pts.points) {
    return { ok: false, error: MSG_INSUFFICIENT_WALLET };
  }

  const studentWallet = getStudentWalletFromState(state, actor.familyId, student.memberId);
  if (!studentWallet) return { ok: false, error: "孩子钱包不存在" };

  let transaction;
  patchState((s) => {
    ensureGrowthAssets(s);
    const pw = getParentWalletByRole(s, actor.familyId, parentRole);
    const sw = getStudentWalletFromState(s, actor.familyId, student.memberId);
    pw.balance -= pts.points;
    pw.totalRewarded = (pw.totalRewarded || 0) + pts.points;
    pw.todayRewarded = (pw.todayRewarded || 0) + pts.points;
    pw.updatedAt = nowIso();

    sw.totalEarned = (sw.totalEarned || 0) + pts.points;
    touchStudentAssets(sw, pts.points);

    transaction = createPointTransaction(s, {
      familyId: actor.familyId,
      studentId: student.memberId,
      fromUserId: actor.user.userId,
      fromRole: parentRole,
      type: "reward",
      points: pts.points,
      reason,
      relatedRecordId,
      affectsMarket: true,
      affectsInvestment: false,
    });
    syncGrowthMarketWallets(s, actor.familyId);
  });

  const kline = upsertMarketKline(formatDateKey(), { familyId: actor.familyId, studentId: student.memberId });

  return {
    ok: true,
    message: MSG_REWARD_SUCCESS(student.name, pts.points),
    transaction,
    kline: kline.kline,
    summary: getWalletSummary(actor.familyId),
  };
}

export function deductStudent({
  parentRole, points, reason = "", advice = "", relatedRecordId = null, user: actorUser,
}) {
  const actor = resolveActor(parentRole, { user: actorUser });
  if (!actor.ok) return actor;

  const pts = normalizePoints(points, MAX_DEDUCTION_POINTS);
  if (!pts.ok) return pts;

  if (!String(reason || "").trim()) {
    return { ok: false, error: "请填写扣分原因" };
  }
  if (!String(advice || "").trim()) {
    return { ok: false, error: "扣分必须填写改进建议" };
  }

  const state = loadState();
  const student = getStudentMember(actor.familyId);
  if (!student) return { ok: false, error: "未找到孩子成员" };

  ensureGrowthAssets(state);
  const parentWallet = getParentWalletByRole(state, actor.familyId, parentRole);
  const access = assertParentWalletAccess(actor.userRole, parentWallet);
  if (!access.ok) return access;

  const studentWallet = getStudentWalletFromState(state, actor.familyId, student.memberId);
  if (!studentWallet) return { ok: false, error: "孩子钱包不存在" };

  const actual = Math.min(pts.points, studentWallet.balance);
  if (actual <= 0) {
    return { ok: false, error: "孩子积分已为 0，无法扣分" };
  }

  const fatherBefore = getParentWalletByRole(state, actor.familyId, "father")?.balance;
  const motherBefore = getParentWalletByRole(state, actor.familyId, "mother")?.balance;

  let transaction;
  patchState((s) => {
    ensureGrowthAssets(s);
    const sw = getStudentWalletFromState(s, actor.familyId, student.memberId);
    sw.totalDeducted = (sw.totalDeducted || 0) + actual;
    touchStudentAssets(sw, -actual);

    const pw = getParentWalletByRole(s, actor.familyId, parentRole);
    pw.todayDeducted = (pw.todayDeducted || 0) + actual;
    pw.updatedAt = nowIso();

    transaction = createPointTransaction(s, {
      familyId: actor.familyId,
      studentId: student.memberId,
      fromUserId: actor.user.userId,
      fromRole: parentRole,
      type: "criticism",
      points: actual,
      reason,
      advice,
      relatedRecordId,
      affectsMarket: true,
      affectsInvestment: false,
    });
    syncGrowthMarketWallets(s, actor.familyId);
  });

  const kline = upsertMarketKline(formatDateKey(), { familyId: actor.familyId, studentId: student.memberId });

  const after = loadState();
  const fatherAfter = getParentWalletByRole(after, actor.familyId, "father")?.balance;
  const motherAfter = getParentWalletByRole(after, actor.familyId, "mother")?.balance;

  return {
    ok: true,
    message: MSG_DEDUCT_SUCCESS,
    transaction,
    parentWalletsUnchanged: fatherBefore === fatherAfter && motherBefore === motherAfter,
    kline: kline.kline,
    summary: getWalletSummary(actor.familyId),
  };
}