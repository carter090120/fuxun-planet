/**
 * 优培成长大盘 — 成长积分模拟（非真实投资）
 */
import { loadState, patchState, formatDateKey, getDailyRecords, getCoachingActions, getTrainingSessions } from "./storage.js";
import {
  ensureGrowthAssets, getGrowthIndexLevel, GROWTH_BASE_INDEX,
  PARENT_INITIAL_BALANCE,
} from "./growthAssets.js";
import { getMarketKlines, rebuildMarketKlines } from "./marketKline.js";
const DEMO_ACCOUNT_EMAIL = "demo@fuxun.local";

export const GROWTH_DISCLAIMER = "成长大盘是学习成长积分模拟，不是真实投资。它用来记录努力、复训、奖励和成长趋势。";

export function getLevelName(index = GROWTH_BASE_INDEX) {
  return getGrowthIndexLevel(index);
}

export const DEMO_KLINE_DAYS = 15;

/** 演示账号固定 15 日 K 线（最后一天 close = 5180） */
export const DEMO_KLINE_DATA = [
  { date: "2026-06-01", open: 4000, high: 4120, low: 3960, close: 4080, change: 80, changePercent: 2.0, volume: 320, reasons: ["完成打卡", "复训 1 题"] },
  { date: "2026-06-02", open: 4080, high: 4100, low: 3990, close: 4020, change: -60, changePercent: -1.5, volume: 180, reasons: ["未完成复盘", "错题未清零"] },
  { date: "2026-06-03", open: 4020, high: 4210, low: 4010, close: 4180, change: 160, changePercent: 4.0, volume: 420, reasons: ["错题减少", "妈妈鼓励卡"] },
  { date: "2026-06-04", open: 4180, high: 4280, low: 4140, close: 4250, change: 70, changePercent: 1.7, volume: 360, reasons: ["连续打卡", "阅读积累"] },
  { date: "2026-06-05", open: 4250, high: 4270, low: 4160, close: 4190, change: -60, changePercent: -1.4, volume: 220, reasons: ["手机控制失守", "复训未完成"] },
  { date: "2026-06-06", open: 4190, high: 4410, low: 4180, close: 4380, change: 190, changePercent: 4.5, volume: 520, reasons: ["爸爸表扬信", "主动复盘"] },
  { date: "2026-06-07", open: 4380, high: 4520, low: 4350, close: 4480, change: 100, changePercent: 2.3, volume: 460, reasons: ["训练正确率提升", "词汇积累"] },
  { date: "2026-06-08", open: 4480, high: 4510, low: 4400, close: 4430, change: -50, changePercent: -1.1, volume: 200, reasons: ["错题增加", "计划未完成"] },
  { date: "2026-06-09", open: 4430, high: 4620, low: 4420, close: 4590, change: 160, changePercent: 3.6, volume: 480, reasons: ["复训清零", "坚持突破"] },
  { date: "2026-06-10", open: 4590, high: 4700, low: 4560, close: 4680, change: 90, changePercent: 2.0, volume: 410, reasons: ["妈妈荣誉徽章", "情绪稳定"] },
  { date: "2026-06-11", open: 4680, high: 4740, low: 4620, close: 4650, change: -30, changePercent: -0.6, volume: 230, reasons: ["压力偏高", "复盘不足"] },
  { date: "2026-06-12", open: 4650, high: 4860, low: 4640, close: 4820, change: 170, changePercent: 3.7, volume: 560, reasons: ["父子约定完成", "主动问问题"] },
  { date: "2026-06-13", open: 4820, high: 4970, low: 4800, close: 4930, change: 110, changePercent: 2.3, volume: 500, reasons: ["错题本整理", "阅读积累"] },
  { date: "2026-06-14", open: 4930, high: 5020, low: 4880, close: 4860, change: -70, changePercent: -1.4, volume: 260, reasons: ["训练中断", "打卡不完整"] },
  { date: "2026-06-15", open: 4860, high: 5220, low: 4840, close: 5180, change: 320, changePercent: 6.6, volume: 680, reasons: ["完成打卡", "复训清零", "爸爸奖章", "妈妈鼓励卡", "特别表现"] },
];

/** @deprecated 兼容旧引用 */
export const DEMO_7DAY_BARS = DEMO_KLINE_DATA.slice(-7).map(({ open, high, low, close }) => ({ open, high, low, close }));

export const DEMO_TODAY_FACTORS = [
  { label: "完成打卡", value: "—", isText: true, sign: 1 },
  { label: "复训清零", value: "—", isText: true, sign: 1 },
  { label: "爸爸奖章", value: "—", isText: true, sign: 1 },
  { label: "妈妈鼓励卡", value: "—", isText: true, sign: 1 },
  { label: "特别表现", value: "—", isText: true, sign: 1 },
];

function offsetDateKey(baseKey, days) {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function reasonsToFactors(reasons = []) {
  return reasons.map((r) => ({ label: r, value: "—", isText: true, sign: 1 }));
}

function buildDemoKlineRecords(familyId, studentId) {
  return DEMO_KLINE_DATA.map((bar) => ({
    date: bar.date,
    familyId,
    studentId,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    change: bar.change,
    changePercent: bar.changePercent,
    volume: bar.volume,
    reasons: bar.reasons,
    impactFactors: reasonsToFactors(bar.reasons),
    summary: bar.reasons.join(" / "),
    updatedAt: new Date().toISOString(),
  }));
}

function candlesFromKlines(klines) {
  return klines.map((k) => ({
    dateKey: k.date,
    date: k.date,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    change: k.change,
    changePercent: k.changePercent,
    volume: k.volume,
    reasons: k.reasons || (k.impactFactors || []).map((f) => f.label),
  }));
}

function candlesFromHistory(history = []) {
  return history.map((h) => ({
    dateKey: h.dateKey || h.date,
    date: h.dateKey || h.date,
    open: h.open,
    high: h.high,
    low: h.low,
    close: h.close,
    change: h.change,
    changePercent: h.changePercent,
    reasons: h.reasons || [],
  }));
}

export function isDemoGrowthFamily(familyId) {
  const state = loadState();
  if (state.growthMarket?.familyId === familyId && state.growthMarket?.isDemoSeed) return true;
  return (state.users || []).some(
    (u) => u.familyId === familyId && u.email?.toLowerCase() === DEMO_ACCOUNT_EMAIL,
  );
}

export function seedDemoGrowthMarket(familyId, studentId) {
  const bars = buildDemoKlineRecords(familyId, studentId);
  const history = candlesFromKlines(bars);
  const today = formatDateKey();
  const investHistory = [];
  let inv = 500;
  DEMO_KLINE_DATA.slice(-7).forEach((bar, i) => {
    investHistory.push({ dateKey: bar.date, value: inv + i * 4 });
  });

  patchState((s) => {
    ensureGrowthAssets(s);
    s.marketKlines = (s.marketKlines || []).filter((k) => k.familyId !== familyId);
    s.marketKlines.push(...bars);
    const fatherBal = s.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "father")?.balance
      ?? PARENT_INITIAL_BALANCE;
    const motherBal = s.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "mother")?.balance
      ?? PARENT_INITIAL_BALANCE;
    s.growthMarket = {
      familyId,
      studentId,
      baseIndex: GROWTH_BASE_INDEX,
      currentIndex: 5180,
      index: 5180,
      todayChange: 320,
      todayChangePercent: 6.6,
      todayChangePct: 6.6,
      level: "进阶星球",
      demoTodayFactors: DEMO_TODAY_FACTORS,
      todayFactors: DEMO_TODAY_FACTORS,
      isDemoSeed: true,
      disclaimer: GROWTH_DISCLAIMER,
      history,
      candles: history,
      wallets: { father: fatherBal, mother: motherBal },
      investments: [{
        goal: "SAT Reading 提升",
        invested: 500,
        current: 528,
        history: investHistory,
      }],
    };
  });
}

export function seedGrowthMarket(familyId, studentId) {
  seedDemoGrowthMarket(familyId, studentId);
}

export function ensureGrowthMarketData(familyId, studentId) {
  if (!familyId || !studentId) return null;
  const state = loadState();
  const klines = (state.marketKlines || []).filter(
    (k) => k.familyId === familyId && k.studentId === studentId,
  );
  const gm = state.growthMarket;
  const hasCandles = klines.length > 0
    || (gm?.familyId === familyId && (gm.candles?.length || gm.history?.length));
  if (!hasCandles && isDemoGrowthFamily(familyId)) {
    seedDemoGrowthMarket(familyId, studentId);
  }
  return getGrowthMarket(familyId, studentId);
}

function scoreToCandle(prevClose, score, dateKey) {
  const delta = Math.round((score || 0) * 0.4 + (Math.random() - 0.45) * 12);
  const open = prevClose;
  const close = Math.max(400, open + delta);
  const high = Math.max(open, close) + Math.round(Math.random() * 8 + 4);
  const low = Math.min(open, close) - Math.round(Math.random() * 6 + 2);
  return { dateKey, open, close, high, low, change: close - open };
}

export function buildGrowthMarketFromActivity(familyId, studentId) {
  const records = getDailyRecords(familyId).slice(0, 14).reverse();
  const actions = getCoachingActions(familyId);
  const sessions = getTrainingSessions(familyId).filter((t) => t.status === "completed");
  if (!records.length && !actions.length) return null;

  const today = formatDateKey();
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(offsetDateKey(today, -i));

  let base = 1000;
  const history = days.map((dk) => {
    const rec = records.find((r) => r.dateKey === dk);
    const dayActions = actions.filter((a) => a.dateKey === dk);
    const trained = sessions.some((t) => t.dateKey === dk);
    const score = rec?.totalScore || 0;
    const bonus = dayActions.length * 15 + (trained ? 20 : 0);
    const candle = scoreToCandle(base, score + bonus, dk);
    base = candle.close;
    return candle;
  });

  const index = history[history.length - 1].close;
  const prev = history[history.length - 2]?.close || index;
  const fatherPts = actions.filter((a) => a.parentRole === "father").length * 40;
  const motherPts = actions.filter((a) => a.parentRole === "mother").length * 35;
  const todayRec = records.find((r) => r.dateKey === today);

  return {
    familyId,
    studentId,
    index,
    todayChange: index - prev,
    todayChangePct: prev ? Math.round(((index - prev) / prev) * 1000) / 10 : 0,
    level: getLevelName(index),
    history,
    candles: history,
    wallets: { father: Math.max(0, fatherPts), mother: Math.max(0, motherPts) },
    todayFactors: [
      { label: "爸爸奖励", value: Math.min(80, fatherPts), sign: 1 },
      { label: "妈妈奖励", value: Math.min(50, motherPts), sign: 1 },
      { label: "复训清零", value: sessions.some((t) => t.dateKey === today) ? 20 : 0, sign: 1 },
      { label: "今日打卡完成率", value: todayRec ? `${Math.round(todayRec.totalScore || 0)}分` : "未完成", isText: true },
    ],
    investments: [{
      goal: "学习目标",
      invested: 100,
      current: Math.round(index * 0.18),
      history: history.map((h, i) => ({ dateKey: h.dateKey, value: 100 + i * 4 + (h.change > 0 ? 3 : -2) })),
    }],
    disclaimer: GROWTH_DISCLAIMER,
  };
}

export function getGrowthCandles(gm) {
  if (!gm) return [];
  if (gm.candles?.length) return gm.candles;
  if (gm.history?.length) return candlesFromHistory(gm.history);
  return [];
}

export function hasGrowthMarketData(gm, familyId, studentId) {
  if (getGrowthCandles(gm).length > 0) return true;
  if (familyId && isDemoGrowthFamily(familyId)) return true;
  return false;
}

export function getGrowthMarket(familyId, studentId) {
  if (!familyId) return null;
  if (studentId && isDemoGrowthFamily(familyId)) {
    const state = loadState();
    const klines = (state.marketKlines || []).filter(
      (k) => k.familyId === familyId && k.studentId === studentId,
    );
    if (!klines.length) seedDemoGrowthMarket(familyId, studentId);
  }

  const state = loadState();
  const gm = state.growthMarket;
  if (gm?.familyId === familyId) {
    const klines = getMarketKlines(DEMO_KLINE_DAYS, { familyId, studentId });
    if (klines.length) {
      const candles = candlesFromKlines(klines);
      gm.candles = candles;
      gm.history = candles;
      const latest = klines[klines.length - 1];
      gm.currentIndex = latest.close;
      gm.index = latest.close;
      if (gm.isDemoSeed && latest.close === 5180 && !(state.pointTransactions || []).some(
        (t) => t.familyId === familyId && t.affectsMarket && (t.createdAt || "").slice(0, 10) === formatDateKey(),
      )) {
        gm.todayChange = 320;
        gm.todayChangePercent = 6.6;
        gm.todayChangePct = 6.6;
        gm.level = "进阶星球";
        gm.todayFactors = gm.demoTodayFactors || DEMO_TODAY_FACTORS;
      } else {
        gm.todayChange = latest.change;
        gm.todayChangePercent = latest.changePercent;
        gm.todayChangePct = latest.changePercent;
        gm.level = getLevelName(latest.close);
        if (latest.impactFactors?.length) {
          gm.todayFactors = latest.impactFactors.slice(0, 8).map((f) => ({
            label: f.label,
            value: f.value,
            sign: f.sign,
            isText: typeof f.value === "string",
          }));
        } else if (latest.reasons?.length) {
          gm.todayFactors = reasonsToFactors(latest.reasons);
        }
      }
    } else if (!gm.candles?.length && gm.history?.length) {
      gm.candles = candlesFromHistory(gm.history);
    }
    const fatherBal = state.parentWallets?.find((w) => w.familyId === familyId && w.parentRole === "father")?.balance;
    const motherBal = state.parentWallets?.find((w) => w.familyId === familyId && w.parentRole === "mother")?.balance;
    if (fatherBal != null || motherBal != null) {
      gm.wallets = {
        father: fatherBal ?? gm.wallets?.father ?? PARENT_INITIAL_BALANCE,
        mother: motherBal ?? gm.wallets?.mother ?? PARENT_INITIAL_BALANCE,
      };
    }
    if (gm.currentIndex != null && gm.index == null) gm.index = gm.currentIndex;
    if (gm.todayChangePercent != null && gm.todayChangePct == null) gm.todayChangePct = gm.todayChangePercent;
    return gm;
  }
  const built = buildGrowthMarketFromActivity(familyId, studentId);
  if (built?.history?.length) {
    patchState((s) => {
      ensureGrowthAssets(s);
      s.growthMarket = { ...built, baseIndex: GROWTH_BASE_INDEX, currentIndex: built.index, todayChangePercent: built.todayChangePct };
    });
    return loadState().growthMarket;
  }
  return gm?.familyId === familyId ? gm : null;
}

export function formatChange(change, pct) {
  const sign = change >= 0 ? "+" : "";
  return { text: `今日 ${sign}${change} / ${sign}${pct}%`, up: change >= 0 };
}

export function formatChangeParts(change, pct) {
  const sign = change >= 0 ? "+" : "";
  return {
    changeText: `${sign}${change}`,
    pctText: `${sign}${pct}%`,
    up: change >= 0,
  };
}