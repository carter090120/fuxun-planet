/**
 * 优培成长大盘 — 成长积分模拟（非真实投资）
 */
import { loadState, patchState, formatDateKey, getDailyRecords, getCoachingActions, getTrainingSessions } from "./storage.js";

export const GROWTH_DISCLAIMER = "成长积分模拟，非真实投资。";

const LEVELS = [
  { min: 0, name: "启航星球" },
  { min: 800, name: "进阶星球" },
  { min: 1200, name: "闪耀星球" },
  { min: 1600, name: "冠军星球" },
];

function offsetDateKey(baseKey, days) {
  const d = new Date(`${baseKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getLevelName(index) {
  const v = Number(index) || 0;
  let name = LEVELS[0].name;
  LEVELS.forEach((lv) => { if (v >= lv.min) name = lv.name; });
  return name;
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
  const history = [];
  let base = 1100;
  const demoChanges = [-18, 24, 12, -8, 30, 22, 36];
  for (let i = 6; i >= 0; i--) {
    const dk = offsetDateKey(today, -i);
    const change = demoChanges[6 - i];
    const open = base;
    const close = base + change;
    const high = Math.max(open, close) + 12;
    const low = Math.min(open, close) - 8;
    history.push({ dateKey: dk, open, close, high, low, change });
    base = close;
  }
  const index = history[history.length - 1].close;
  const prev = history[history.length - 2]?.close || index;
  const todayChange = index - prev;
  const todayChangePct = prev ? Math.round((todayChange / prev) * 1000) / 10 : 0;

  const investHistory = [];
  let inv = 200;
  [0, 4, 8, 12, 18, 24, 28].forEach((chg, i) => {
    investHistory.push({ dateKey: offsetDateKey(today, i - 6), value: inv + chg });
  });

  patchState((s) => {
    s.growthMarket = {
      familyId,
      studentId,
      index,
      todayChange,
      todayChangePct,
      level: getLevelName(index),
      history,
      wallets: { father: 320, mother: 280 },
      todayFactors: [
        { label: "爸爸奖励", value: 80, sign: 1 },
        { label: "妈妈奖励", value: 50, sign: 1 },
        { label: "复训清零", value: 20, sign: 1 },
        { label: "今日打卡完成率", value: "92%", isText: true },
      ],
      investments: [{
        goal: "SAT Reading 提升",
        invested: 200,
        current: 228,
        history: investHistory,
      }],
      disclaimer: GROWTH_DISCLAIMER,
    };
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
  const gm = loadState().growthMarket;
  if (gm?.familyId === familyId && gm.history?.length) return gm;
  const built = buildGrowthMarketFromActivity(familyId, studentId);
  if (built?.history?.length) {
    patchState((s) => { s.growthMarket = built; });
    return built;
  }
  return gm?.familyId === familyId ? gm : null;
}

export function formatChange(change, pct) {
  const sign = change >= 0 ? "+" : "";
  return { text: `今日 ${sign}${change} / ${sign}${pct}%`, up: change >= 0 };
}