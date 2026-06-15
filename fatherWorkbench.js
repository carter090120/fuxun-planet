/**
 * Ryan 成长投资官工作台 — 场景、快照、AI 建议与奖励闭环
 */
import {
  formatDateKey, getDailyRecords, getTodayRecord, getTodayMistakes,
  getTrainingSessions, getCoachingActions, addCoachingAction, getStudentMember,
} from "./storage.js";
import { formatSpecialPerformanceSummary } from "./specialPerformance.js";
import { rewardStudentWithHonor, deductStudent, getParentWalletForViewer } from "./pointLedger.js";
import { getHonorItems, addHonorItem } from "./honorItems.js";

export const FATHER_REWARD_POINTS = {
  card: 500,
  "praise-letter": 500,
  medal: 500,
  "method-card": 100,
  "father-pact": 300,
};

export const FATHER_MEDAL_TYPES = [
  "错题清零星",
  "坚持突破星",
  "妈妈守护星",
  "家庭责任星",
  "自驱学习星",
  "目标兑现星",
  "父子约定星",
  "今日高光星",
];

export const FATHER_REWARD_SCENARIOS = {
  learning: {
    label: "学习成长场景",
    items: [
      "错题清零",
      "为一道错题坚持很久",
      "主动复训错题",
      "主动整理错题本",
      "主动背词汇",
      "主动阅读",
      "主动问问题",
      "主动完成计划外学习",
      "复盘今天的问题",
      "训练正确率提升",
      "连续打卡坚持",
    ],
  },
  motherCare: {
    label: "妈妈守护场景",
    items: [
      "主动帮妈妈做家务",
      "妈妈提醒时没有顶嘴",
      "主动向妈妈表达感谢",
      "妈妈累的时候主动分担",
      "和妈妈发生分歧后主动沟通",
      "妈妈不在时主动完成任务",
      "做了一件让妈妈轻松一点的事",
      "对妈妈说了一句温暖的话",
    ],
  },
  fatherPact: {
    label: "父子成长契约场景",
    items: [
      "完成和爸爸约定的目标",
      "接受爸爸给的方法",
      "主动向爸爸汇报进度",
      "跟爸爸说了真实困难",
      "和爸爸一起复盘错题",
      "完成爸爸设置的挑战任务",
      "今天比昨天更自律",
      "完成父子成长约定",
    ],
  },
};

const HONOR_TYPE_MAP = {
  card: "爸爸贺卡",
  "praise-letter": "表扬信",
  medal: "奖章",
  "method-card": "学习方法卡",
  "father-pact": "父子约定",
};

const COACH_TYPE_MAP = {
  card: "card",
  "praise-letter": "praise",
  medal: "medal",
  "method-card": "method",
  "father-pact": "pact",
};

function offsetDateKey(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function calcCheckinStreak(familyId, studentId) {
  const keys = new Set(
    getDailyRecords(familyId)
      .filter((r) => r.studentId === studentId)
      .map((r) => r.dateKey),
  );
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const key = offsetDateKey(-i);
    if (keys.has(key)) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

function calcCompletionRate(record) {
  if (!record?.abilities?.length) return null;
  const total = record.abilities.reduce((s, a) => s + (a.score || 0), 0);
  const max = record.abilities.reduce((s, a) => s + (a.max || 0), 0);
  return max ? Math.round((total / max) * 100) : null;
}

function getActiveTrainingSession(familyId) {
  const dk = formatDateKey();
  return getTrainingSessions(familyId)
    .filter((t) => t.dateKey === dk)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0]
    || null;
}

function trainingAccuracy(session) {
  if (!session?.stats?.answered) return null;
  return Math.round((session.stats.correct / session.stats.answered) * 100);
}

function remainingMistakes(familyId) {
  const session = getActiveTrainingSession(familyId);
  if (session?.pool?.length) return session.pool.length;
  return getTodayMistakes(familyId).filter((m) => !m.isCorrect).length;
}

function pickInvestBehavior(snapshot) {
  const { record, st, streak, remaining, accuracy, sp } = snapshot;
  if (sp?.hasPerformance && sp.hasPerformance !== "no") {
    const line = formatSpecialPerformanceSummary(sp).split("\n")[0];
    return line || "今日特别表现值得正式认可";
  }
  if (st.trainingDone && remaining === 0) return "错题清零，训练完成";
  if (streak >= 3) return `连续打卡 ${streak} 天，坚持值得投资`;
  if (accuracy != null && accuracy >= 80) return `训练正确率 ${accuracy}%，学习状态稳定`;
  if (record?.highlight) return record.highlight;
  if (record?.studyContent) return `今日学习：${record.studyContent}`;
  return "完成打卡与日常努力，值得爸爸看见";
}

export function buildFatherChildSnapshot(familyId, studentId) {
  const record = getTodayRecord(familyId);
  const mistakes = getTodayMistakes(familyId);
  const session = getActiveTrainingSession(familyId);
  const remaining = remainingMistakes(familyId);
  const accuracy = trainingAccuracy(session);
  const streak = calcCheckinStreak(familyId, studentId);
  const completionRate = calcCompletionRate(record);
  const ps = record?.parentSummary;
  const sp = record?.specialPerformance;

  const st = {
    checkedIn: !!record,
    trainingDone: session?.status === "completed" || (ps?.trainingDone ?? false),
    mistakeCount: mistakes.length,
    trainingProgress: session?.status === "completed"
      ? "已完成"
      : (session?.pool?.length ? `${session.pool.length} 题待清零` : (remaining ? `${remaining} 题待清零` : "未开始")),
  };

  return {
    record,
    ps,
    sp,
    st,
    totalScore: record?.totalScore,
    completionRate,
    mistakeCount: mistakes.length,
    remainingMistakes: remaining,
    retrainCleared: st.trainingDone && remaining === 0,
    trainingAccuracy: accuracy,
    checkinStreak: streak,
    specialPerformanceText: sp?.hasPerformance && sp.hasPerformance !== "no"
      ? formatSpecialPerformanceSummary(sp)
      : (sp?.hasPerformance === "no" ? "孩子填写：今天没有特别表现" : "尚未填写"),
    investBehavior: null,
  };
}

export function buildFatherAiSuggestion(snapshot) {
  const s = { ...snapshot, investBehavior: snapshot.investBehavior || pickInvestBehavior(snapshot) };
  const { sp, st, remaining, streak, retrainCleared, trainingAccuracy: acc } = s;

  let rewardMethod = "贺卡";
  let suggestedPoints = FATHER_REWARD_POINTS.card;
  let medalType = "";
  let scenario = "";
  let noDeduct = true;
  let fatherMessage = "今天先看见努力，再决定是否发正式奖励。";
  let childMessage = "爸爸看见你今天在坚持。";

  if (sp?.hasPerformance && sp.hasPerformance !== "no") {
    rewardMethod = "表扬信";
    suggestedPoints = FATHER_REWARD_POINTS["praise-letter"];
    medalType = "今日高光星";
    scenario = sp.subcategory || sp.category || "特别表现";
    fatherMessage = `Daniel 的亮点在「${scenario}」，建议用正式表扬信把这一刻留下来。`;
    childMessage = "你今天的特别表现，爸爸看见了，也值得被正式记录。";
    if (String(sp.subcategory || "").includes("错题") || String(sp.description || "").includes("坚持")) {
      rewardMethod = "奖章";
      medalType = "坚持突破星";
      fatherMessage = "今天 Daniel 最大的价值不是分数，而是为一道错题坚持到弄懂。建议发「坚持突破星」，奖励 500 分，并写一封简短表扬信。";
      childMessage = "为一道题坚持到弄懂，这比做对十道题更值得骄傲。";
    }
  } else if (retrainCleared) {
    rewardMethod = "奖章";
    suggestedPoints = FATHER_REWARD_POINTS.medal;
    medalType = "错题清零星";
    scenario = "错题清零";
    fatherMessage = "错题已清零，适合发「错题清零星」正式确认这次突破。";
    childMessage = "错题清零了，这是今天最值得庆祝的学习成果。";
  } else if (streak >= 3) {
    rewardMethod = "贺卡";
    suggestedPoints = FATHER_REWARD_POINTS.card;
    scenario = "连续打卡坚持";
    fatherMessage = `连续打卡 ${streak} 天，先发一张爸爸贺卡确认坚持。`;
    childMessage = "连续打卡的每一天，都在积累你的成长资产。";
  } else if (remaining > 0 && !st.trainingDone) {
    rewardMethod = "方法卡";
    suggestedPoints = FATHER_REWARD_POINTS["method-card"];
    scenario = "主动复训错题";
    noDeduct = true;
    fatherMessage = "还有错题待清零，建议先发方法卡，帮孩子看见下一步。";
    childMessage = "错题还没清零没关系，爸爸陪你找下一个方法。";
  } else if (acc != null && acc >= 85) {
    rewardMethod = "贺卡";
    scenario = "训练正确率提升";
    fatherMessage = `训练正确率 ${acc}%，适合用贺卡做一次轻量认可。`;
  }

  return {
    highlight: s.investBehavior,
    rewardMethod,
    suggestedPoints,
    medalType,
    scenario,
    noDeduct,
    fatherMessage,
    childMessage,
  };
}

export function getFatherTodayWalletStats(familyId, wallet) {
  const acts = getCoachingActions(familyId, formatDateKey()).filter((a) => a.parentRole === "father");
  const parse = (a) => {
    try {
      return a.payload || (typeof a.content === "string" ? JSON.parse(a.content) : a.content) || {};
    } catch { return {}; }
  };
  const countType = (tool) => acts.filter((a) => {
    const p = parse(a);
    return p.tool === tool || a.type === COACH_TYPE_MAP[tool];
  }).length;

  const honorItems = getHonorItems(familyId, { fromRole: "father", dateKey: formatDateKey() });

  return {
    balance: wallet?.balance ?? 0,
    todaySent: wallet?.todayRewarded || 0,
    todayRemaining: wallet?.balance ?? 0,
    totalRewarded: wallet?.totalRewarded || 0,
    cards: honorItems.filter((h) => h.itemType === "card").length || countType("card"),
    praiseLetters: honorItems.filter((h) => h.itemType === "praise-letter").length || countType("praise-letter"),
    medals: honorItems.filter((h) => h.itemType === "medal").length || countType("medal"),
    deductReminders: wallet?.todayDeducted || 0,
  };
}

export function submitFatherReward({
  tool,
  scenario,
  scenarioCategory,
  medalType,
  title,
  content,
  points,
  relatedRecordId,
  notifyStudent,
  member,
  student,
  familyId,
}) {
  const pts = Number(points) || FATHER_REWARD_POINTS[tool] || 0;
  if (!pts || pts <= 0) return { ok: false, error: "请填写奖励积分" };
  if (tool === "medal" && !medalType) return { ok: false, error: "请选择奖章类型" };

  const honorType = HONOR_TYPE_MAP[tool] || "积分奖励";
  const displayTitle = title
    || (tool === "medal" ? medalType : honorType)
    || honorType;
  const reason = [scenario, content].filter(Boolean).join(" · ") || displayTitle;

  const result = rewardStudentWithHonor({
    parentRole: "father",
    points: pts,
    reason,
    honorType,
    honorItemType: tool,
    scenario,
    scenarioCategory,
    medalType: tool === "medal" ? medalType : "",
    title: displayTitle,
    content: content || reason,
    relatedRecordId,
  });
  if (!result.ok) return result;

  const honor = addHonorItem({
    familyId,
    studentId: student?.memberId,
    fromRole: "father",
    fromName: member?.name || "爸爸",
    itemType: tool,
    title: displayTitle,
    content: content || reason,
    scenario,
    scenarioCategory,
    medalType: tool === "medal" ? medalType : "",
    points: pts,
    transactionId: result.transaction?.transactionId,
    relatedRecordId,
  });

  addCoachingAction({
    familyId,
    studentId: student?.memberId,
    parentRole: "father",
    type: COACH_TYPE_MAP[tool] || "reward",
    content: JSON.stringify({ tool, scenario, medalType, points: pts, title: displayTitle }),
    payload: {
      tool,
      scenario,
      scenarioCategory,
      medalType,
      honorType,
      points: pts,
      title: displayTitle,
      content: content || reason,
    },
  });

  return { ...result, honorItem: honor, notifyStudent, displayTitle };
}

export function canFatherAfford(tool, wallet) {
  const pts = FATHER_REWARD_POINTS[tool] || 0;
  return (wallet?.balance ?? 0) >= pts;
}

export function getFatherWalletForPage(familyId, userRole) {
  return getParentWalletForViewer(familyId, "father", userRole);
}