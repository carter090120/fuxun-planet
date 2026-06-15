/**
 * 优培成长大盘 — 成长积分模拟（非真实投资）
 */
import { loadState, patchState, formatDateKey, getDailyRecords, getCoachingActions, getTrainingSessions } from "./storage.js";
import {
  ensureGrowthAssets, getGrowthIndexLevel, GROWTH_BASE_INDEX,
  PARENT_INITIAL_BALANCE,
} from "./growthAssets.js";
import { getMarketKlines, getLatestMarketSummary, rebuildMarketKlines } from "./marketKline.js";

export const GROWTH_DISCLAIMER = "成长积分模拟，非真实投资。";

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

export function seedGrowthMarket(familyId, studentId) {
  const today = formatDateKey();
  patchState((s) => {
    ensureGrowthAssets(s);
    if (!s.growthMarket || s.growthMarket.familyId !== familyId) {
      s.growthMarket = {
        familyId,
        studentId,
        baseIndex: GROWTH_BASE_INDEX,
        currentIndex: GROWTH_BASE_INDEX,
        index: GROWTH_BASE_INDEX,
        disclaimer: GROWTH_DISCLAIMER,
        investments: [{
          goal: "SAT Reading 提升",
          invested: 500,
          current: 528,
          history: [],
        }],
      };
    }
  });

  rebuildMarketKlines(7, { familyId, studentId });

  const investHistory = [];
  let inv = 500;
  [0, 4, 8, 12, 18, 24, 28].forEach((chg, i) => {
    investHistory.push({ dateKey: offsetDateKey(today, i - 6), value: inv + chg });
  });

  patchState((s) => {
    const fatherBal = s.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "father")?.balance
      ?? PARENT_INITIAL_BALANCE;
    const motherBal = s.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "mother")?.balance
      ?? PARENT_INITIAL_BALANCE;
    if (s.growthMarket?.familyId === familyId) {
      s.growthMarket.wallets = { father: fatherBal, mother: motherBal };
      s.growthMarket.disclaimer = GROWTH_DISCLAIMER;
      if (s.growthMarket.investments?.[0]) {
        s.growthMarket.investments[0].history = investHistory;
      }
    }
  });
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
      gm.todayChange = latest.change;
      gm.todayChangePercent = latest.changePercent;
      gm.todayChangePct = latest.changePercent;
      gm.level = getLevelName(latest.close);
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