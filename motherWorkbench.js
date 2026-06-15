/**
 * Sara 陪伴荣誉官工作台 — 陪伴场景、快照、AI 建议与奖励闭环
 */
import {
  formatDateKey, getTodayRecord, getTrainingSessions, getCoachingActions,
  addCoachingAction, getStudentMember,
} from "./storage.js";
import { formatSpecialPerformanceSummary } from "./specialPerformance.js";
import { rewardStudentWithHonor, getParentWalletForViewer } from "./pointLedger.js";
import { getHonorItems, addHonorItem } from "./honorItems.js";
import { calcCheckinStreak } from "./fatherWorkbench.js";

export const MOTHER_REWARD_POINTS = {
  card: 500,
  "praise-letter": 500,
  badge: 500,
  "family-reward": 300,
  "tomorrow-goal": 100,
};

export const MOTHER_BADGE_TYPES = [
  "温暖坚持星",
  "情绪稳定星",
  "计划清晰星",
  "自我照顾星",
  "感恩表达星",
  "亲子陪伴星",
  "明日小目标星",
];

export const FAMILY_REWARD_TYPES = [
  "一起散步",
  "一起吃喜欢的东西",
  "一起看电影",
  "一起聊天 20 分钟",
  "周末亲子活动",
  "妈妈陪你复盘一次",
];

export const MOTHER_COMPANION_SCENARIOS = {
  emotion: {
    label: "情绪支持场景",
    items: [
      "压力大但坚持完成",
      "遇到挫折没有放弃",
      "主动表达感受",
      "情绪稳定了一次",
      "今天愿意沟通",
      "今天没有把压力带给家人",
    ],
  },
  plan: {
    label: "计划陪伴场景",
    items: [
      "明天计划清晰",
      "主动安排学习顺序",
      "提前准备资料",
      "主动复盘今天的问题",
      "知道下一步怎么做",
    ],
  },
  warm: {
    label: "温暖成长场景",
    items: [
      "主动感谢家人",
      "主动帮家里做事",
      "主动整理房间",
      "主动早睡早起",
      "主动运动",
      "今天对自己更有耐心",
      "有一个值得被抱抱的小进步",
    ],
  },
};

const HONOR_TYPE_MAP = {
  card: "妈妈鼓励卡",
  "praise-letter": "温暖表扬信",
  badge: "荣誉徽章",
  "family-reward": "亲子活动",
  "tomorrow-goal": "明日小目标",
};

const COACH_TYPE_MAP = {
  card: "card",
  "praise-letter": "praise",
  badge: "honor",
  "family-reward": "family-reward",
  "tomorrow-goal": "plan",
};

function getActiveTrainingSession(familyId) {
  const dk = formatDateKey();
  return getTrainingSessions(familyId)
    .filter((t) => t.dateKey === dk)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0]
    || null;
}

function pickCompanionHighlight(snapshot) {
  const { record, sp, mood, stress } = snapshot;
  if (sp?.hasPerformance && sp.hasPerformance !== "no") {
    return formatSpecialPerformanceSummary(sp).split("\n")[0] || "今日特别表现值得被温柔看见";
  }
  if (String(mood || "").includes("压力") || stress === "高") {
    return "今天有压力，但仍在努力，最需要被看见的是坚持";
  }
  if (record?.highlight) return record.highlight;
  if (record?.completedTasks) return `完成了：${record.completedTasks}`;
  return "今天的日常努力，也值得一句温暖的看见";
}

export function buildMotherChildSnapshot(familyId, studentId) {
  const record = getTodayRecord(familyId);
  const session = getActiveTrainingSession(familyId);
  const ps = record?.parentSummary;
  const sp = record?.specialPerformance;
  const trainingDone = session?.status === "completed" || (ps?.trainingDone ?? false);
  const retrainNote = trainingDone
    ? "复训已完成"
    : (session?.pool?.length ? `剩余 ${session.pool.length} 题` : (ps?.trainingSummary || "复训未完成"));

  return {
    record,
    ps,
    sp,
    mood: record?.mood || "—",
    energy: record?.energy || "—",
    stress: record?.stress || "—",
    completedToday: [record?.studyContent, record?.completedTasks].filter(Boolean).join("；") || "—",
    tomorrowPlan: record?.tomorrowPlan || "—",
    checkedIn: !!record,
    trainingDone,
    retrainNote,
    selfGrade: record?.grade?.letter || ps?.grade?.letter || "—",
    checkinStreak: calcCheckinStreak(familyId, studentId),
    specialPerformanceText: sp?.hasPerformance && sp.hasPerformance !== "no"
      ? formatSpecialPerformanceSummary(sp)
      : (sp?.hasPerformance === "no" ? "孩子填写：今天没有特别表现" : "尚未填写"),
  };
}

export function buildMotherAiSuggestion(snapshot) {
  const highlight = pickCompanionHighlight(snapshot);
  const { mood, stress, trainingDone, retrainNote, sp, tomorrowPlan } = snapshot;

  let encourageOrRemind = "鼓励";
  let rewardMethod = "鼓励卡";
  let suggestedPoints = MOTHER_REWARD_POINTS.card;
  let badgeType = "";
  let scenario = "";
  let noDeduct = true;
  let motherPhrase = "今天先抱抱努力，再轻轻聊一句明天的小步。";
  let familyReward = "";
  let tomorrowGoal = tomorrowPlan && tomorrowPlan !== "—" ? tomorrowPlan : "先完成一件最小的事";
  let motherMessage = motherPhrase;
  let childMessage = "妈妈看见你今天也在努力。";

  const highStress = String(mood || "").includes("压力") || stress === "高";
  const lowStress = stress === "低" || String(mood || "").includes("开心") || String(mood || "").includes("平静");

  if (sp?.hasPerformance && sp.hasPerformance !== "no") {
    rewardMethod = "温暖表扬信";
    suggestedPoints = MOTHER_REWARD_POINTS["praise-letter"];
    badgeType = "温暖坚持星";
    scenario = sp.subcategory || sp.category || "特别表现";
    motherMessage = `孩子有特别表现「${scenario}」，适合写一封温暖表扬信正式确认。`;
    childMessage = "你的亮点，妈妈看见了，也值得被温柔地记下来。";
  } else if (!trainingDone && lowStress) {
    rewardMethod = "鼓励卡";
    suggestedPoints = MOTHER_REWARD_POINTS.card;
    scenario = "压力大但坚持完成";
    motherMessage = "Daniel 今天虽然还没完全清零错题，但压力不高，也愿意继续复训。建议发一张鼓励卡，奖励 500 分，并给一个明天的小目标。";
    childMessage = "还没清零也没关系，妈妈陪你一步一步来。";
    tomorrowGoal = tomorrowPlan !== "—" ? tomorrowPlan : "明天先完成 1 道错题复训";
  } else if (highStress) {
    rewardMethod = "鼓励卡";
    scenario = "遇到挫折没有放弃";
    motherMessage = "今天压力偏高，建议先发鼓励卡，不建议扣分。";
    childMessage = "有压力也没关系，妈妈在这里。";
    noDeduct = true;
  } else if (tomorrowPlan && tomorrowPlan !== "—") {
    rewardMethod = "明日小目标";
    suggestedPoints = 0;
    scenario = "明天计划清晰";
    encourageOrRemind = "陪伴";
    motherMessage = "明日计划已经比较清晰，建议帮孩子确认一个小目标，并说明妈妈怎么陪。";
  } else if (trainingDone) {
    rewardMethod = "荣誉徽章";
    suggestedPoints = MOTHER_REWARD_POINTS.badge;
    badgeType = "情绪稳定星";
    scenario = "今天愿意沟通";
    familyReward = "一起聊天 20 分钟";
    motherMessage = "复训完成了，适合发一枚荣誉徽章，并安排一次亲子陪伴。";
  } else {
    motherMessage = `复训参考：${retrainNote}。先看见情绪，再决定是否鼓励。`;
  }

  return {
    highlight,
    encourageOrRemind,
    rewardMethod,
    suggestedPoints,
    badgeType,
    scenario,
    noDeduct,
    motherPhrase,
    familyReward,
    tomorrowGoal,
    motherMessage,
    childMessage,
  };
}

export function getMotherTodayWalletStats(familyId, wallet) {
  const acts = getCoachingActions(familyId, formatDateKey()).filter((a) => a.parentRole === "mother");
  const parse = (a) => {
    try {
      return a.payload || (typeof a.content === "string" ? JSON.parse(a.content) : a.content) || {};
    } catch { return {}; }
  };
  const honorItems = getHonorItems(familyId, { fromRole: "mother", dateKey: formatDateKey() });

  return {
    balance: wallet?.balance ?? 0,
    todaySent: wallet?.todayRewarded || 0,
    cards: honorItems.filter((h) => h.itemType === "card").length
      || acts.filter((a) => parse(a).tool === "card").length,
    honors: honorItems.filter((h) => h.itemType === "badge" || h.itemType === "honor").length
      || acts.filter((a) => ["badge", "honor", "stars"].includes(parse(a).tool || a.type)).length,
    planSuggestions: acts.filter((a) => (parse(a).tool || a.type) === "tomorrow-goal" || a.type === "plan").length,
    familyRewards: honorItems.filter((h) => h.itemType === "family-reward").length
      || acts.filter((a) => parse(a).tool === "family-reward").length,
    totalRewarded: wallet?.totalRewarded || 0,
  };
}

export function submitMotherReward({
  tool,
  scenario,
  scenarioCategory,
  badgeType,
  familyRewardType,
  title,
  content,
  points,
  tomorrowTask,
  motherHelp,
  tomorrowReminder,
  relatedRecordId,
  member,
  student,
  familyId,
}) {
  const defaultPts = MOTHER_REWARD_POINTS[tool] ?? 0;
  const pts = points === undefined || points === "" ? defaultPts : Number(points);

  if (tool === "tomorrow-goal" && (!pts || pts <= 0)) {
    const displayTitle = title || "明日小目标";
    const body = [
      tomorrowTask && `明天先完成：${tomorrowTask}`,
      motherHelp && `妈妈怎么帮：${motherHelp}`,
      tomorrowReminder && `提醒：${tomorrowReminder}`,
      content,
    ].filter(Boolean).join("\n");

    addCoachingAction({
      familyId,
      studentId: student?.memberId,
      parentRole: "mother",
      type: "plan",
      content: JSON.stringify({ tool, scenario, title: displayTitle, body }),
      payload: { tool, scenario, scenarioCategory, title: displayTitle, content: body, points: 0 },
    });

    addHonorItem({
      familyId,
      studentId: student?.memberId,
      fromRole: "mother",
      fromName: member?.name || "妈妈",
      itemType: "tomorrow-goal",
      title: displayTitle,
      content: body,
      scenario,
      scenarioCategory,
      points: 0,
      relatedRecordId,
    });

    return { ok: true, message: "明日小目标已记录", displayTitle, points: 0 };
  }

  if (!pts || pts <= 0) return { ok: false, error: "请填写奖励积分" };
  if (tool === "badge" && !badgeType) return { ok: false, error: "请选择荣誉徽章类型" };

  const honorType = HONOR_TYPE_MAP[tool] || "妈妈鼓励";
  const displayTitle = title
    || (tool === "badge" ? badgeType : (tool === "family-reward" ? (familyRewardType || "亲子奖励") : honorType));
  const reasonParts = [scenario, familyRewardType, content].filter(Boolean);
  const reason = reasonParts.join(" · ") || displayTitle;

  const result = rewardStudentWithHonor({
    parentRole: "mother",
    points: pts,
    reason,
    honorType,
    honorItemType: tool,
    scenario,
    scenarioCategory,
    medalType: tool === "badge" ? badgeType : "",
    title: displayTitle,
    content: content || reason,
    relatedRecordId,
  });
  if (!result.ok) return result;

  addHonorItem({
    familyId,
    studentId: student?.memberId,
    fromRole: "mother",
    fromName: member?.name || "妈妈",
    itemType: tool,
    title: displayTitle,
    content: content || reason,
    scenario,
    scenarioCategory,
    medalType: tool === "badge" ? badgeType : "",
    familyRewardType: familyRewardType || "",
    points: pts,
    transactionId: result.transaction?.transactionId,
    relatedRecordId,
  });

  addCoachingAction({
    familyId,
    studentId: student?.memberId,
    parentRole: "mother",
    type: COACH_TYPE_MAP[tool] || "reward",
    content: JSON.stringify({ tool, scenario, badgeType, familyRewardType, points: pts, title: displayTitle }),
    payload: {
      tool,
      scenario,
      scenarioCategory,
      badgeType,
      familyRewardType,
      honorType,
      points: pts,
      title: displayTitle,
      content: content || reason,
    },
  });

  return { ...result, displayTitle, points: pts };
}

export function submitMotherSpecialPerformance({
  tool, record, member, student, familyId, points,
}) {
  const sp = record?.specialPerformance;
  if (!sp?.hasPerformance || sp.hasPerformance === "no") {
    return { ok: false, error: "暂无特别表现可确认" };
  }
  const summary = formatSpecialPerformanceSummary(sp);
  const scenario = sp.subcategory || sp.category || "特别表现";
  const ptsUse = Number(points) || sp.suggestedPoints || MOTHER_REWARD_POINTS.card;

  const r = submitMotherReward({
    tool: tool || "card",
    scenario,
    scenarioCategory: "warm",
    title: tool === "badge" ? "温暖坚持星" : (tool === "praise-letter" ? "温暖表扬信" : "妈妈鼓励卡"),
    content: summary,
    points: ptsUse,
    relatedRecordId: record.recordId,
    member,
    student,
    familyId,
  });
  if (!r.ok) return r;

  addHonorItem({
    familyId,
    studentId: student?.memberId,
    fromRole: "mother",
    fromName: member?.name || "妈妈",
    itemType: "growth-event",
    title: "特别表现确认",
    content: summary,
    scenario,
    points: ptsUse,
    relatedRecordId: record.recordId,
    specialPerformance: true,
  });

  return r;
}

export function canMotherAfford(tool, wallet) {
  const pts = MOTHER_REWARD_POINTS[tool] || 0;
  if (tool === "tomorrow-goal") return true;
  return (wallet?.balance ?? 0) >= pts;
}