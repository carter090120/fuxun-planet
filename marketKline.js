/**
 * 复训星球 — 成长大盘 K 线计算
 */
import {
  loadState, patchState, formatDateKey, getDailyRecords, getTrainingSessions,
  getStudentMember, getTodayRecord, nowIso,
} from "./storage.js";
import { GROWTH_BASE_INDEX, getGrowthIndexLevel, ensureGrowthAssets } from "./growthAssets.js";
import { getSession } from "./auth.js";

export const HONOR_POINT_VALUES = {
  爸爸贺卡: 500,
  妈妈鼓励卡: 500,
  温暖表扬信: 500,
  荣誉徽章: 500,
  鼓励贺卡: 200,
  表扬信: 500,
  奖章: 500,
  证书: 800,
  学习方法卡: 100,
  父子约定: 300,
  亲子活动: 300,
  明日小目标: 100,
  明日特权: 200,
  精神鼓励: 200,
  物质奖励: 200,
};

export const CRITICISM_POINT_VALUES = {
  老师批评: 200,
  作业严重未完成: 150,
  多次拖延: 100,
  重要目标未执行: 120,
  手机控制失守: 100,
};

function offsetDateKey(baseKey, days) {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function txDateKey(tx) {
  return tx.date || (tx.createdAt ? String(tx.createdAt).slice(0, 10) : formatDateKey());
}

function resolveScope(opts = {}) {
  const session = getSession();
  const familyId = opts.familyId || session?.familyId;
  const student = getStudentMember(familyId);
  const studentId = opts.studentId || student?.memberId;
  return { familyId, studentId, student };
}

function getKlinesFromState(state, familyId, studentId) {
  return (state.marketKlines || []).filter(
    (k) => k.familyId === familyId && k.studentId === studentId,
  );
}

function findKline(state, familyId, studentId, date) {
  return getKlinesFromState(state, familyId, studentId).find((k) => k.date === date) || null;
}

function getYesterdayClose(state, familyId, studentId, date) {
  const prevDate = offsetDateKey(date, -1);
  const prev = findKline(state, familyId, studentId, prevDate);
  if (prev) return prev.close;
  const older = getKlinesFromState(state, familyId, studentId)
    .filter((k) => k.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return older?.close ?? GROWTH_BASE_INDEX;
}

function mapHonorPoints(tx, notification) {
  if (tx?.honorType && HONOR_POINT_VALUES[tx.honorType]) {
    return { points: HONOR_POINT_VALUES[tx.honorType], label: tx.honorType };
  }
  if (tx?.type === "honor" && tx.reason && HONOR_POINT_VALUES[tx.reason]) {
    return { points: HONOR_POINT_VALUES[tx.reason], label: tx.reason };
  }
  const rewardType = notification?.rewardType || tx?.reason || "";
  if (HONOR_POINT_VALUES[rewardType]) {
    return { points: HONOR_POINT_VALUES[rewardType], label: rewardType };
  }
  const cardStyle = notification?.cardStyle || "";
  if (cardStyle.includes("表扬")) return { points: 500, label: "表扬信" };
  if (cardStyle.includes("奖章")) return { points: 500, label: "奖章" };
  if (cardStyle.includes("证书")) return { points: 800, label: "证书" };
  if (notification?.type === "heart" || tx?.type === "honor") {
    return { points: 200, label: "鼓励贺卡" };
  }
  return null;
}

function mapCriticismPoints(tx) {
  const key = tx.criticismType || tx.reason || "";
  if (CRITICISM_POINT_VALUES[key]) {
    return { points: CRITICISM_POINT_VALUES[key], label: key };
  }
  return null;
}

function calcEmotionImpact(rec) {
  if (!rec) return { impact: 0, label: "未打卡" };
  const mood = String(rec.mood || "");
  const stress = String(rec.stress || "");
  const positive = mood.includes("开心") || mood.includes("充满干劲") || mood.includes("平静");
  const stressHigh = stress === "高" || stress.includes("高");
  const tasksDone = (rec.totalScore || 0) >= 60 || String(rec.completedTasks || "").trim().length > 0;

  if (positive && !stressHigh) return { impact: 30, label: "心情积极且压力低" };
  if (stressHigh && tasksDone) return { impact: 20, label: "压力高但仍完成任务" };
  if (stressHigh) return { impact: -20, label: "压力高" };
  return { impact: 0, label: "心情一般" };
}

function calcRetrainImpact(sessions, date) {
  const dayDone = sessions.filter((s) => s.dateKey === date && s.status === "completed");
  if (!dayDone.length) return { impact: 0, label: "未复训" };
  const cleared = dayDone.some((s) => !s.pool?.length);
  if (cleared) return { impact: 100, label: "错题全部清零" };
  return { impact: 30, label: "复训完成但未清零" };
}

function sumParentPoints(transactions, date) {
  let reward = 0;
  let deduct = 0;
  const factors = [];
  for (const tx of transactions) {
    if (txDateKey(tx) !== date || !tx.affectsMarket) continue;
    if (tx.type === "reward") {
      reward += tx.points;
      factors.push({ label: `${tx.fromRole === "father" ? "爸爸" : "妈妈"}加分`, value: tx.points, sign: 1 });
    } else if (tx.type === "criticism" && (tx.fromRole === "father" || tx.fromRole === "mother")) {
      deduct += tx.points;
      factors.push({ label: `${tx.fromRole === "father" ? "爸爸" : "妈妈"}扣分提醒`, value: tx.points, sign: -1 });
    }
  }
  const net = reward - deduct;
  return { reward, deduct, net, parentPointImpact: net * 0.1, factors };
}

function sumHonorAndCriticism(state, familyId, studentId, date, transactions) {
  let honorRaw = 0;
  let criticismRaw = 0;
  const factors = [];

  const notifications = (state.notifications || []).filter((n) => {
    const dk = n.dateKey || (n.createdAt ? String(n.createdAt).slice(0, 10) : "");
    return dk === date;
  });

  for (const tx of transactions) {
    if (txDateKey(tx) !== date || !tx.affectsMarket) continue;
    if (tx.type === "honor") {
      const mapped = mapHonorPoints(tx);
      if (mapped) {
        honorRaw += mapped.points;
        factors.push({ label: mapped.label, value: mapped.points, sign: 1, kind: "honor" });
      }
    } else if (tx.type === "criticism" && tx.fromRole === "system") {
      const mapped = mapCriticismPoints(tx);
      if (mapped) {
        criticismRaw += mapped.points;
        factors.push({ label: mapped.label, value: mapped.points, sign: -1, kind: "criticism" });
      }
    }
  }

  for (const n of notifications) {
    const mapped = mapHonorPoints(null, n);
    if (mapped) {
      honorRaw += mapped.points;
      factors.push({ label: mapped.label, value: mapped.points, sign: 1, kind: "honor" });
    }
  }

  return {
    honorRaw,
    criticismRaw,
    honorImpact: honorRaw * 0.15,
    criticismImpact: criticismRaw * 0.2,
    factors,
  };
}

export function getMarketLevel(currentIndex) {
  return getGrowthIndexLevel(currentIndex);
}

/**
 * 计算指定日期的大盘分项影响（不写入状态）
 */
export function calculateMarketImpact(date, opts = {}) {
  const { familyId, studentId } = resolveScope(opts);
  if (!familyId || !studentId) {
    return { ok: false, error: "缺少家庭或孩子信息" };
  }

  const state = opts.state || loadState();
  const rec = getDailyRecords(familyId).find((r) => r.dateKey === date)
    || (date === formatDateKey() ? getTodayRecord(familyId) : null);
  const sessions = getTrainingSessions(familyId);
  const transactions = (state.pointTransactions || []).filter(
    (t) => t.familyId === familyId && t.studentId === studentId,
  );

  const dailyScoreImpact = rec
    ? Math.round(((rec.totalScore || 0) - 80) * 5)
    : 0;
  const retrain = calcRetrainImpact(sessions, date);
  const parent = sumParentPoints(transactions, date);
  const honorCrit = sumHonorAndCriticism(state, familyId, studentId, date, transactions);
  const emotion = calcEmotionImpact(rec);

  const totalChange = Math.round(
    dailyScoreImpact
    + retrain.impact
    + parent.parentPointImpact
    + honorCrit.honorImpact
    - honorCrit.criticismImpact
    + emotion.impact,
  );

  const impactFactors = [
    { label: "今日总分影响", value: dailyScoreImpact, sign: dailyScoreImpact >= 0 ? 1 : -1 },
    { label: "复训影响", value: retrain.impact, sign: retrain.impact >= 0 ? 1 : -1 },
    { label: "父母净奖励影响", value: Math.round(parent.parentPointImpact * 10) / 10, sign: parent.net >= 0 ? 1 : -1, detail: `净${parent.net}分×0.1` },
    { label: "荣誉影响", value: Math.round(honorCrit.honorImpact * 10) / 10, sign: 1 },
    { label: "批评影响", value: Math.round(honorCrit.criticismImpact * 10) / 10, sign: -1 },
    { label: "情绪修正", value: emotion.impact, sign: emotion.impact >= 0 ? 1 : -1 },
    ...parent.factors,
    ...honorCrit.factors,
  ];

  let positivePoints = 0;
  let negativePoints = 0;
  if (dailyScoreImpact > 0) positivePoints += dailyScoreImpact;
  else negativePoints += -dailyScoreImpact;
  if (retrain.impact > 0) positivePoints += retrain.impact;
  if (parent.net > 0) positivePoints += parent.net;
  else negativePoints += -parent.net;
  positivePoints += honorCrit.honorRaw;
  negativePoints += honorCrit.criticismRaw;
  if (emotion.impact > 0) positivePoints += emotion.impact;
  else negativePoints += -emotion.impact;

  const summary = [
    rec ? `打卡${rec.totalScore || 0}分` : "未打卡",
    retrain.label,
    parent.net !== 0 ? `父母净积分${parent.net}` : null,
    honorCrit.honorRaw ? `荣誉+${honorCrit.honorRaw}` : null,
    honorCrit.criticismRaw ? `批评-${honorCrit.criticismRaw}` : null,
    emotion.label,
  ].filter(Boolean).join(" · ");

  return {
    ok: true,
    date,
    familyId,
    studentId,
    dailyScoreImpact,
    retrainImpact: retrain.impact,
    parentNetPoints: parent.net,
    parentPointImpact: parent.parentPointImpact,
    honorRaw: honorCrit.honorRaw,
    honorImpact: honorCrit.honorImpact,
    criticismRaw: honorCrit.criticismRaw,
    criticismImpact: honorCrit.criticismImpact,
    emotionImpact: emotion.impact,
    totalChange,
    positivePoints,
    negativePoints,
    impactFactors,
    summary,
  };
}

function buildKlineRecord(impact, open) {
  const close = Math.max(0, Math.round(open + impact.totalChange));
  const high = Math.max(open, close) + Math.round(impact.positivePoints * 0.03);
  const low = Math.max(0, Math.min(open, close) - Math.round(impact.negativePoints * 0.03));
  const change = close - open;
  const changePercent = open ? Math.round((change / open) * 10000) / 100 : 0;

  return {
    date: impact.date,
    familyId: impact.familyId,
    studentId: impact.studentId,
    open,
    high,
    low,
    close,
    change,
    changePercent,
    dailyScoreImpact: impact.dailyScoreImpact,
    retrainImpact: impact.retrainImpact,
    parentPointImpact: impact.parentPointImpact,
    honorImpact: impact.honorImpact,
    criticismImpact: impact.criticismImpact,
    emotionImpact: impact.emotionImpact,
    impactFactors: impact.impactFactors,
    summary: impact.summary,
    updatedAt: nowIso(),
  };
}

function syncGrowthMarketFromKline(state, kline) {
  ensureGrowthAssets(state);
  const prevDate = offsetDateKey(kline.date, -1);
  const prev = findKline(state, kline.familyId, kline.studentId, prevDate);
  const prevClose = prev?.close ?? GROWTH_BASE_INDEX;
  const todayChange = kline.close - (prev?.date === prevDate ? prevClose : getYesterdayClose(state, kline.familyId, kline.studentId, kline.date));
  const todayChangePercent = prevClose
    ? Math.round((todayChange / prevClose) * 10000) / 100
    : 0;

  const history = getKlinesFromState(state, kline.familyId, kline.studentId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map((k) => ({
      dateKey: k.date,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      change: k.change,
    }));

  const gm = state.growthMarket || {};
  state.growthMarket = {
    ...gm,
    familyId: kline.familyId,
    studentId: kline.studentId,
    baseIndex: GROWTH_BASE_INDEX,
    currentIndex: kline.close,
    index: kline.close,
    todayChange,
    todayChangePercent,
    todayChangePct: todayChangePercent,
    level: getMarketLevel(kline.close),
    updatedAt: nowIso(),
    history,
    todayFactors: kline.impactFactors.slice(0, 6).map((f) => ({
      label: f.label,
      value: f.value,
      sign: f.sign,
      isText: typeof f.value === "string",
    })),
    disclaimer: gm.disclaimer,
    wallets: gm.wallets,
    investments: gm.investments,
  };
}

/**
 * 生成或更新指定日期的一根 K 线（同日多次事件合并重算）
 */
export function upsertMarketKline(date, opts = {}) {
  const impact = calculateMarketImpact(date, opts);
  if (!impact.ok) return impact;

  let kline;
  patchState((s) => {
    if (!Array.isArray(s.marketKlines)) s.marketKlines = [];
    ensureGrowthAssets(s);
    const open = getYesterdayClose(s, impact.familyId, impact.studentId, date);
    kline = buildKlineRecord(impact, open);
    const idx = s.marketKlines.findIndex(
      (k) => k.familyId === impact.familyId && k.studentId === impact.studentId && k.date === date,
    );
    if (idx >= 0) s.marketKlines[idx] = { ...s.marketKlines[idx], ...kline };
    else s.marketKlines.unshift(kline);
    syncGrowthMarketFromKline(s, kline);
  });

  return { ok: true, kline, impact };
}

export function getMarketKlines(days = 7, opts = {}) {
  const { familyId, studentId } = resolveScope(opts);
  if (!familyId || !studentId) return [];
  const list = getKlinesFromState(loadState(), familyId, studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  return list.slice(0, days).sort((a, b) => a.date.localeCompare(b.date));
}

export function getLatestMarketSummary(opts = {}) {
  const { familyId, studentId } = resolveScope(opts);
  const state = loadState();
  const klines = getKlinesFromState(state, familyId, studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = klines[0] || null;
  const gm = state.growthMarket?.familyId === familyId ? state.growthMarket : null;
  return {
    familyId,
    studentId,
    baseIndex: GROWTH_BASE_INDEX,
    currentIndex: latest?.close ?? gm?.currentIndex ?? GROWTH_BASE_INDEX,
    level: getMarketLevel(latest?.close ?? gm?.currentIndex ?? GROWTH_BASE_INDEX),
    todayChange: latest?.change ?? gm?.todayChange ?? 0,
    todayChangePercent: latest?.changePercent ?? gm?.todayChangePercent ?? 0,
    latestKline: latest,
    klineCount: klines.length,
    growthMarket: gm,
  };
}

/** 批量回填最近 N 天 K 线 */
export function rebuildMarketKlines(days = 7, opts = {}) {
  const today = formatDateKey();
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = offsetDateKey(today, -i);
    results.push(upsertMarketKline(date, opts));
  }
  return results;
}