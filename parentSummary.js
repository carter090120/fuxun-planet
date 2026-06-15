import { formatScore, getGrade } from "./storage.js";

function pickHighAbilities(abilities, minRate = 0.85) {
  return (abilities || [])
    .filter((a) => a.max && a.score / a.max >= minRate)
    .map((a) => a.name)
    .slice(0, 3);
}

function parentAdvice({ pref, stress, mistakeCount, totalScore, mood }) {
  const p = pref || "只鼓励我";
  const highStress = stress === "高" || (mood || "").includes("压力");
  const manyMistakes = mistakeCount >= 3;
  const lowScore = totalScore < 80;

  if (p === "只鼓励我" && highStress) {
    return "建议家长今天先鼓励，不要追问太多细节。";
  }
  if (p === "帮我分析方法" && manyMistakes) {
    return "建议家长先肯定努力，再和孩子一起看一个错因。";
  }
  if (p === "明天提醒我") {
    return "建议家长轻轻提醒明日计划中的一小步，不要一次列太多。";
  }
  if (p === "暂时不要说太多" && highStress) {
    return "孩子今天压力偏高，建议先陪伴倾听，少评价。";
  }
  if (p === "一起制定计划") {
    return "建议家长和孩子一起把明日计划缩成 1～2 个可完成的小目标。";
  }
  if (lowScore) {
    return "今天分数有波动，建议先肯定坚持打卡，再聊一个改进点。";
  }
  return "建议家长先看见努力，再轻轻聊一个明天的小目标。";
}

export function buildParentSummary(record, ctx = {}) {
  const {
    mistakeCount = 0,
    trainingDone = false,
    trainingSummary = "",
    parentResponsePref = "只鼓励我",
  } = ctx;

  const grade = record.grade || getGrade(record.totalScore || 0);
  const highAbilities = pickHighAbilities(record.abilities);

  const tag1 = [
    record.studyContent && `今天学习了：${record.studyContent}`,
    record.completedTasks && `完成了：${record.completedTasks}`,
  ].filter(Boolean).join("；") || "今日学习记录待补充。";

  const spLine = record.specialPerformance?.hasPerformance
    && record.specialPerformance.hasPerformance !== "no"
    ? `特别表现：${record.specialPerformance.category || ""}${record.specialPerformance.subcategory ? ` · ${record.specialPerformance.subcategory}` : ""}${record.specialPerformance.selfRating ? `（${record.specialPerformance.selfRating}，建议 +${record.specialPerformance.suggestedPoints || 0} 分）` : ""}`
    : "";
  const tag2 = [
    spLine,
    record.highlight && `亮点：${record.highlight}`,
    highAbilities.length && `表现较好的能力：${highAbilities.join("、")}`,
  ].filter(Boolean).join("；") || "今天也在坚持成长，值得肯定。";

  const tag3 = [
    record.tomorrowPlan && `明日计划：${record.tomorrowPlan}`,
    record.reflection && `改进方向：${record.reflection}`,
  ].filter(Boolean).join("；") || "明日计划待一起商量。";

  const advice = parentAdvice({
    pref: parentResponsePref,
    stress: record.stress,
    mistakeCount,
    totalScore: record.totalScore,
    mood: record.mood,
  });

  const tag4 = advice;

  return {
    totalScore: record.totalScore,
    grade,
    mistakeCount,
    trainingDone,
    trainingSummary: trainingSummary || (trainingDone ? "今日复训已完成，错题已清零。" : "复训尚未完成。"),
    mood: record.mood,
    energy: record.energy,
    stress: record.stress,
    studyContent: record.studyContent,
    completedTasks: record.completedTasks,
    highlight: record.highlight,
    specialPerformance: record.specialPerformance || null,
    tomorrowPlan: record.tomorrowPlan,
    parentResponsePreference: parentResponsePref,
    parentAdvice: advice,
    tags: {
      overview: tag1,
      strengths: tag2,
      tomorrow: tag3,
      parentResponse: tag4,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function trainingSummaryText(session) {
  if (!session) return "";
  const acc = session.stats?.answered
    ? Math.round((session.stats.correct / session.stats.answered) * 100)
    : 0;
  if (session.status === "completed") {
    return `复训完成，共练 ${session.stats?.answered || 0} 题，正确率 ${acc}%，错题已清零。`;
  }
  return `复训进行中，剩余 ${session.pool?.length || 0} 道错题，正确率 ${acc}%。`;
}