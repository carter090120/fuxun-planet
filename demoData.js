/**
 * 复训星球 MVP Demo v1.0 — 演示数据种子
 */
import { clearAllData, addMaterial, upsertMistakes, formatDateKey, upsertDailyRecord } from "./storage.js";
import { registerFamily, getStudentMember } from "./auth.js";
import { parseQuestionBank, buildMistakesFromAnswers } from "./questionParser.js";
import { createTrainingSession } from "./trainingCoach.js";
import { seedDemoGrowthMarket } from "./growthMarket.js";

export const DEMO_CREDENTIALS = {
  email: "demo@fuxun.local",
  password: "demo1234",
};

export const DEMO_QUESTION_BANK = `1. Which choice completes the text with the most logical and precise word? The scientist was ______ by the unexpected results of the experiment.
A. confirmed
B. vindicated
C. rejected
D. ignored
答案：B
孩子答案：A

2. Which choice best describes the function of the underlined sentence in the text as a whole?
A. It introduces a counterargument.
B. It provides historical context.
C. It summarizes the main claim.
D. It defines a technical term.
答案：C
孩子答案：B

3. Which choice provides the best evidence for the answer to the previous question?
A. Lines 12-14
B. Lines 18-20
C. Lines 25-27
D. Lines 30-33
答案：D
孩子答案：B

4. Based on the text, which choice can most reasonably be inferred about the author's attitude?
A. The author is cautiously optimistic.
B. The author is openly dismissive.
C. The author is deeply skeptical.
D. The author is entirely neutral.
答案：A
孩子答案：A

5. Which choice best states the main idea of the text?
A. Technology has replaced traditional research methods.
B. Careful observation remains essential to scientific discovery.
C. Students should avoid complex experiments.
D. Data collection is less important than publication.
答案：B
孩子答案：B`;

export function seedDemo() {
  clearAllData();
  const reg = registerFamily({
    familyName: "Daniel 的复训星球",
    badge: "🪐",
    badgeId: "planet",
    badgeType: "default",
    badgeValue: "🪐",
    motto: "错题清零，星球升级。",
    coachingStyle: "balance",
    contact: DEMO_CREDENTIALS.email,
    password: DEMO_CREDENTIALS.password,
    dadName: "Ryan",
    dadAvatar: "👨",
    dadHobbies: "跑步,阅读,科技",
    dadTags: "理性分析型,鼓励陪伴型",
    dadCompanion: "多表扬,给方法",
    dadSystemRoles: "成长投资官,积分官",
    momName: "Sara",
    momAvatar: "👩",
    momHobbies: "阅读,音乐,陪伴",
    momTags: "细心陪伴型,温柔沟通型",
    momCompanion: "复盘结果,给孩子温暖反馈",
    momSystemRoles: "陪伴荣誉官,情绪守护官",
    childName: "Daniel",
    childNickname: "Dan",
    childAvatar: "🧑‍🎓",
    childGrade: "高一",
    childSchool: "国际高中",
    childHobbies: "篮球,SAT",
    childTags: "目标感强,需要鼓励型",
    childSubjects: "SAT Reading,Math,English",
    learningGoal: "提升 SAT Reading 词汇题和结构题正确率",
    parentResponsePref: "帮我分析方法",
    previewInviteCode: "DEMO01",
  });
  if (!reg.ok) return reg;

  const student = getStudentMember(reg.family.familyId);
  const parsed = parseQuestionBank(DEMO_QUESTION_BANK, {
    title: "SAT Reading · Demo Passage",
    subject: "SAT Reading",
    sourceNote: "MVP Demo 演示题库（5 题，含 3 道错题）",
  });

  const material = addMaterial({
    ...parsed,
    familyId: reg.family.familyId,
    studentId: student?.memberId,
    importedBy: "演示数据",
    importMethod: "text",
  });

  const answers = Object.fromEntries(parsed.questions.map((q) => [q.questionId, q.studentAnswer || ""]));
  const mistakes = buildMistakesFromAnswers(material, answers).map((m) => ({
    ...m,
    familyId: reg.family.familyId,
    studentId: student?.memberId,
    dateKey: formatDateKey(),
  }));
  upsertMistakes(mistakes);

  const wrong = mistakes.filter((m) => !m.isCorrect);
  if (wrong.length) {
    createTrainingSession(mistakes, {
      ...material,
      familyId: reg.family.familyId,
      studentId: student?.memberId,
    });
  }

  seedDemoGrowthMarket(reg.family.familyId, student?.memberId);

  upsertDailyRecord({
    recordId: "demo-checkin-today",
    familyId: reg.family.familyId,
    studentId: student?.memberId,
    dateKey: formatDateKey(),
    studyContent: "SAT Reading 词汇与结构题",
    completedTasks: "完成 5 题复训，错题清零",
    mood: "开心",
    energy: "充沛",
    stress: "低",
    totalScore: 88,
    specialPerformance: {
      hasPerformance: "yes",
      category: "学习场景",
      subcategory: "主动复训错题",
      customDescription: "今天主动把 3 道错题全部清零了。",
      selfRating: "坚持突破",
      suggestedPoints: 200,
    },
  });

  return {
    ok: true,
    family: reg.family,
    wrongCount: wrong.length,
    questionCount: parsed.questions.length,
  };
}