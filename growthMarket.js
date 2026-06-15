/**
 * 优培成长大盘 — 成长积分模拟（非真实投资）
 */
import { loadState, patchState, formatDateKey, getDailyRecords, getCoachingActions, getTrainingSessions } from "./storage.js";
import {
  ensureGrowthAssets, getGrowthIndexLevel, GROWTH_BASE_INDEX,
  PARENT_INITIAL_BALANCE,
} from "./growthAssets.js";
import { getMarketKlines, getLatestMarketSummary, rebuildMarketKlines } from "./marketKline.js";

export const GROWTH_DISCLAIMER = "成长大盘是学习成长积分模拟，不是真实投资。它用来记录努力、复训、奖励和成长趋势。";

function offsetDateKey(baseKey, days) {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getLevelName(index) {
  return getGrowthIndexLevel(index);
}

function scoreToCandle(prevClose, score, dateKey) {
  const delta = Math.round((score || 0) * 0.4 + (Math.random() - 0.45) * 12);
  const open = prevClose;
  const close = Math.max(400, open + delta);
  const high = Math.max(open, close) + Math.round(Math.random() * 8 + 4);
  const low = Math.min(open, close) - Math.round(Math.random() * 6 + 2);
  return { dateKey, open, close, high, low, change: close - open };
}

/** 演示账号固定 7 日 K 线（最后一天 close = 5180） */
export const DEMO_7DAY_BARS = [
  { open: 4000, high: 4140, low: 3980, close: 4100 },
  { open: 4100, high: 4250, low: 4080, close: 4210 },
  { open: 4210, high: 4360, low: 4180, close: 4320 },
  { open: 4320, high: 4550, low: 4300, close: 4480 },
  { open: 4480, high: 4700, low: 4450, close: 4630 },
  { open: 4630, high: 4920, low: 4600, close: 4860 },
  { open: 4860, high: 5220, low: 4820, close: 5180 },
];

export const DEMO_TODAY_FACTORS = [
  { label: "今日打卡完成率", value: 80, sign: 1 },
  { label: "复训清零", value: 100, sign: 1 },
  { label: "爸爸方法奖励", value: 300, sign: 1 },
  { label: "妈妈鼓励卡", value: 200, sign: 1 },
  { label: "特别表现奖励", value: 500, sign: 1 },
  { label: "压力正常，适合正向激励", value: "—", isText: true, sign: 1 },
];

function buildDemoKlineRecords(familyId, studentId, today) {
  return DEMO_7DAY_BARS.map((bar, i) => {
    const date = offsetDateKey(today, i - 6);
    const prevClose = i > 0 ? DEMO_7DAY_BARS[i - 1].close : bar.open;
    const change = bar.close - (i > 0 ? prevClose : bar.open);
    const open = i > 0 ? DEMO_7DAY_BARS[i - 1].close : bar.open;
    const changePercent = open ? Math.round((change / open) * 10000) / 100 : 0;
    return {
      date,
      familyId,
      studentId,
      open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      change,
      changePercent,
      impactFactors: i === 6 ? DEMO_TODAY_FACTORS : [],
      summary: i === 6 ? "演示大盘 · 进阶星球" : `演示第 ${i + 1} 天`,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function seedDemoGrowthMarket(familyId, studentId) {
  const today = formatDateKey();
  const bars = buildDemoKlineRecords(familyId, studentId, today);
  const history = bars.map((k) => ({
    dateKey: k.date,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    change: k.change,
  }));
  const investHistory = [];
  let inv = 500;
  [0, 4, 8, 12, 18, 24, 28].forEach((chg, i) => {
    investHistory.push({ dateKey: offsetDateKey(today, i - 6), value: inv + chg });
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

export function getGrowthMarket(familyId, studentId) {
  const state = loadState();
  const gm = state.growthMarket;
  if (gm?.familyId === familyId) {
    const klines = getMarketKlines(7, { familyId, studentId });
    if (klines.length) {
      gm.history = klines.map((k) => ({
        dateKey: k.date,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        change: k.change,
      }));
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
      }
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