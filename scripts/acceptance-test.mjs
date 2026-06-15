/**
 * 复训星球闭环验收脚本（Node 模拟 localStorage）
 * 运行：node scripts/acceptance-test.mjs
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.sessionStorage = {
  getItem: (k) => store[`ss:${k}`] ?? null,
  setItem: (k, v) => { store[`ss:${k}`] = String(v); },
  removeItem: (k) => { delete store[`ss:${k}`]; },
};
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => `id-${Math.random().toString(36).slice(2, 10)}` },
    configurable: true,
  });
}

const storage = await import(pathToFileURL(path.join(root, "storage.js")).href);
const auth = await import(pathToFileURL(path.join(root, "auth.js")).href);
const { seedDemo } = await import(pathToFileURL(path.join(root, "demoData.js")).href);
const qp = await import(pathToFileURL(path.join(root, "questionParser.js")).href);
const coach = await import(pathToFileURL(path.join(root, "trainingCoach.js")).href);
const notes = await import(pathToFileURL(path.join(root, "notifications.js")).href);
const parentSummary = await import(pathToFileURL(path.join(root, "parentSummary.js")).href);
const growthAssets = await import(pathToFileURL(path.join(root, "growthAssets.js")).href);
const pointLedger = await import(pathToFileURL(path.join(root, "pointLedger.js")).href);
const marketKline = await import(pathToFileURL(path.join(root, "marketKline.js")).href);
const growthMarket = await import(pathToFileURL(path.join(root, "growthMarket.js")).href);
const memberRoles = await import(pathToFileURL(path.join(root, "memberRoles.js")).href);
const fatherWorkbench = await import(pathToFileURL(path.join(root, "fatherWorkbench.js")).href);
const honorItems = await import(pathToFileURL(path.join(root, "honorItems.js")).href);

const results = { pass: [], fail: [] };
const ok = (name, cond) => (cond ? results.pass.push(name) : results.fail.push(name));

// 1-8 演示数据种子
const reg = seedDemo();
ok("1-2. 演示家庭注册", reg.ok && reg.family?.familyName === "Daniel 的复训星球");

const fam = auth.getFamily();
const members = auth.getMembers();
ok("3. 成员三人", members.length === 3);
ok("3. Daniel 资料", members.find((m) => m.role === "student")?.name === "Daniel");
ok("5-6. 演示题库", reg.questionCount === 5);
ok("7-8. 演示错题池", reg.wrongCount === 3);

const student = auth.getStudentMember();
const mats = storage.getMaterials(fam.familyId);
const mat = mats[0];
const mistakes = storage.getMistakes(fam.familyId).filter((m) => m.materialId === mat.materialId);
const session = coach.restoreActiveSession(fam.familyId, mat.materialId);
ok("8. 训练会话", session?.pool?.length === 3);

// 积分系统 v14-1A
const st = storage.loadState();
const fatherW = growthAssets.getParentWalletByRole(st, fam.familyId, "father");
const motherW = growthAssets.getParentWalletByRole(st, fam.familyId, "mother");
const studentW = growthAssets.getStudentWalletFromState(st, fam.familyId, student.memberId);
const gm = st.growthMarket;
ok("积分. 爸爸钱包 10000", fatherW?.balance === 10000 && fatherW?.initialBalance === 10000);
ok("积分. 妈妈钱包 10000", motherW?.balance === 10000 && motherW?.initialBalance === 10000);
ok("积分. 孩子钱包 10000", studentW?.balance === 10000 && studentW?.initialBalance === 10000);
ok("积分. 成长大盘 baseIndex 4000", gm?.baseIndex === 4000);
ok("积分. 成长大盘 currentIndex", (gm?.currentIndex ?? gm?.index) >= 4000);

// v15 演示大盘 5180
const marketView = growthMarket.getGrowthMarket(fam.familyId, student.memberId);
const demoKlines = (st.marketKlines || []).filter((k) => k.familyId === fam.familyId);
const lastDemoBar = [...demoKlines].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
ok("v15. 演示指数5180", marketView?.index === 5180 && marketView?.currentIndex === 5180);
ok("v15. 演示等级进阶星球", marketView?.level === "进阶星球");
ok("v15. 演示涨跌+320/6.6%", marketView?.todayChange === 320
  && (marketView?.todayChangePct === 6.6 || marketView?.todayChangePercent === 6.6));
ok("v15. 最后K线close5180", lastDemoBar?.close === 5180);
ok("v15. 影响因素含特别表现", (marketView?.todayFactors || []).some((f) => String(f.label).includes("特别表现")));
ok("v15. Ryan入口/coach/father", memberRoles.getMemberEntryPath({ role: "father" }) === "/coach/father");
ok("v15. Sara入口/coach/mother", memberRoles.getMemberEntryPath({ role: "mother" }) === "/coach/mother");
ok("v16. Daniel入口/student", memberRoles.getMemberEntryPath({ role: "student" }) === "/student");
ok("v16. Ryan工作台标题", memberRoles.PARENT_WORKBENCH.father.title("Ryan").includes("成长投资官工作台"));
ok("v16. Sara工作台标题", memberRoles.PARENT_WORKBENCH.mother.title("Sara").includes("陪伴荣誉官工作台"));
ok("v16. 默认爸爸角色", memberRoles.DEFAULT_PARENT_SYSTEM_ROLES.father.includes("成长投资官"));
ok("v16. 默认妈妈角色", memberRoles.DEFAULT_PARENT_SYSTEM_ROLES.mother.includes("陪伴荣誉官"));
const demoRec = storage.getTodayRecord(fam.familyId);
ok("v15. 演示特别表现字段", demoRec?.specialPerformance?.hasPerformance === "yes"
  && demoRec.specialPerformance.suggestedPoints === 200);
const swText = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const appText = fs.readFileSync(path.join(root, "app.js"), "utf8");
ok("v15. SW含memberRoles与v16b", swText.includes("memberRoles.js") && swText.includes("fuxun-planet-v16b"));
ok("v15. app含getMemberEntryPath", appText.includes("getMemberEntryPath"));
ok("v16. app含renderStudent", appText.includes("renderStudent") && appText.includes("student: renderStudent"));
ok("v16. app含工作台英雄区", appText.includes("renderParentWorkbenchHero") && appText.includes("家庭优培总览"));
ok("v16b. 爸爸贺卡默认500", fatherWorkbench.FATHER_REWARD_POINTS.card === 500);
ok("v16b. 爸爸表扬信默认500", fatherWorkbench.FATHER_REWARD_POINTS["praise-letter"] === 500);
ok("v16b. 爸爸奖章默认500", fatherWorkbench.FATHER_REWARD_POINTS.medal === 500);
ok("v16b. 三类奖励场景", Object.keys(fatherWorkbench.FATHER_REWARD_SCENARIOS).length === 3);
ok("v16b. SW含fatherWorkbench", swText.includes("fatherWorkbench.js") && swText.includes("fuxun-planet-v16b"));
ok("v16b. app含renderFatherWorkbench", appText.includes("renderFatherWorkbench") && appText.includes("爸爸奖励工具箱"));
ok("v15. app含rewardStudent", appText.includes("rewardStudent"));

storage.saveState(st);
const reloaded = storage.loadState();
ok("积分. 刷新后持久化",
  growthAssets.getParentWalletByRole(reloaded, fam.familyId, "father")?.balance === 10000
  && growthAssets.getStudentWalletFromState(reloaded, fam.familyId, student.memberId)?.balance === 10000
  && reloaded.growthMarket?.baseIndex === 4000);
ok("积分. 权限-孩子不能自加分", !growthAssets.canStudentSelfCredit("student"));
ok("积分. 权限-爸爸只能用爸爸钱包", growthAssets.canUseParentWallet("father", "father")
  && !growthAssets.canUseParentWallet("father", "mother"));

// 积分流水 v14-1B
const fatherUser = storage.loadState().users.find((u) => u.role === "father");
const stuUserEarly = storage.loadState().users.find((u) => u.role === "student");
auth.loginAsUser(fatherUser.userId);
const rewardFather = pointLedger.rewardStudent({
  parentRole: "father", points: 100, reason: "阅读进步",
});
const stAfterFather = storage.loadState();
const fatherAfter = growthAssets.getParentWalletByRole(stAfterFather, fam.familyId, "father");
const studentAfterFather = growthAssets.getStudentWalletFromState(stAfterFather, fam.familyId, student.memberId);
ok("流水. 爸爸加分扣爸爸钱包", rewardFather.ok
  && fatherAfter?.balance === 9900
  && studentAfterFather?.balance === 10100
  && fatherAfter?.totalRewarded === 100);
ok("流水. 爸爸加分生成流水", (stAfterFather.pointTransactions || []).some(
  (t) => t.type === "reward" && t.points === 100 && t.affectsMarket === true && t.fromRole === "father",
));

const badMotherWallet = pointLedger.rewardStudent({ parentRole: "mother", points: 10 });
ok("流水. 爸爸不能用妈妈钱包", !badMotherWallet.ok);

auth.loginAsUser(storage.loadState().users.find((u) => u.role === "mother").userId);
const rewardMother = pointLedger.rewardStudent({
  parentRole: "mother", points: 50, reason: "打卡认真",
});
const stAfterMother = storage.loadState();
ok("流水. 妈妈加分扣妈妈钱包", rewardMother.ok
  && growthAssets.getParentWalletByRole(stAfterMother, fam.familyId, "mother")?.balance === 9950
  && growthAssets.getStudentWalletFromState(stAfterMother, fam.familyId, student.memberId)?.balance === 10150);

auth.loginAsUser(stuUserEarly.userId);
const studentReward = pointLedger.rewardStudent({ parentRole: "father", points: 10 });
ok("流水. 孩子不能给自己加分", !studentReward.ok);

auth.loginAsUser(fatherUser.userId);
const fatherBalBefore = growthAssets.getParentWalletByRole(storage.loadState(), fam.familyId, "father")?.balance;
const motherBalBefore = growthAssets.getParentWalletByRole(storage.loadState(), fam.familyId, "mother")?.balance;
const deduct = pointLedger.deductStudent({
  parentRole: "father", points: 30, reason: "审题马虎", advice: "先圈关键词再选答案",
});
const stAfterDeduct = storage.loadState();
const studentAfterDeduct = growthAssets.getStudentWalletFromState(stAfterDeduct, fam.familyId, student.memberId);
ok("流水. 扣分减少孩子积分", deduct.ok && studentAfterDeduct?.balance === 10120);
ok("流水. 扣分不增加父母钱包", deduct.parentWalletsUnchanged
  && growthAssets.getParentWalletByRole(stAfterDeduct, fam.familyId, "father")?.balance === fatherBalBefore
  && growthAssets.getParentWalletByRole(stAfterDeduct, fam.familyId, "mother")?.balance === motherBalBefore);
ok("流水. 扣分生成流水", (stAfterDeduct.pointTransactions || []).some(
  (t) => t.type === "criticism" && t.points === 30 && t.advice.includes("关键词"),
));
const noAdvice = pointLedger.deductStudent({
  parentRole: "father", points: 10, reason: "分心", advice: "",
});
ok("流水. 扣分必须填写建议", !noAdvice.ok);

const summary = pointLedger.getWalletSummary(fam.familyId);
ok("流水. 钱包摘要", summary.student?.balance === 10120
  && summary.recentTransactions.length >= 3
  && summary.growthMarket?.baseIndex === 4000);

storage.patchState((s) => {
  const w = growthAssets.getParentWalletByRole(s, fam.familyId, "father");
  if (w) w.balance = 40;
});
const broke = pointLedger.rewardStudent({ parentRole: "father", points: 100 });
ok("流水. 钱包不足不能加分", !broke.ok && broke.error === pointLedger.MSG_INSUFFICIENT_WALLET);

auth.loginAsUser(stuUserEarly.userId);

// 成长大盘 K 线 v14-1C
const todayKey = storage.formatDateKey();
storage.patchState((s) => {
  s.marketKlines = (s.marketKlines || []).filter((k) => k.familyId !== fam.familyId);
});
const impactBase = marketKline.calculateMarketImpact(todayKey, {
  familyId: fam.familyId, studentId: student.memberId,
});
const kFresh = marketKline.upsertMarketKline(todayKey, {
  familyId: fam.familyId, studentId: student.memberId,
});
ok("K线. 初始 open 4000", kFresh.kline.open === 4000);
ok("K线. 可生成当天K线", !!kFresh.kline?.close && kFresh.kline.date === todayKey);
ok("K线. 父母奖励影响 parentPointImpact", impactBase.parentPointImpact === 12
  && kFresh.kline.parentPointImpact === 12);
ok("K线. 扣分计入净奖励", impactBase.parentNetPoints === 120);

auth.loginAsUser(fatherUser.userId);
pointLedger.rewardStudent({ parentRole: "father", points: 20, reason: "二次奖励" });
const kMerged = marketKline.upsertMarketKline(todayKey, {
  familyId: fam.familyId, studentId: student.memberId,
});
const todayBars = storage.loadState().marketKlines.filter(
  (k) => k.familyId === fam.familyId && k.date === todayKey,
);
ok("K线. 同日多次事件合并一根", todayBars.length === 1
  && kMerged.impact.parentNetPoints === 140);

storage.patchState((s) => {
  s.pointTransactions.unshift({
    transactionId: "honor-test-1",
    familyId: fam.familyId,
    studentId: student.memberId,
    fromUserId: fatherUser.userId,
    fromRole: "father",
    type: "honor",
    honorType: "表扬信",
    points: 500,
    reason: "表扬信",
    affectsMarket: true,
    createdAt: new Date().toISOString(),
  });
});
const kHonor = marketKline.upsertMarketKline(todayKey, {
  familyId: fam.familyId, studentId: student.memberId,
});
ok("K线. 荣誉影响 honorImpact", kHonor.impact.honorImpact === 75
  && kHonor.kline.honorImpact === 75);

// 9-10 训练清零（答对全部错题）
let after = session;
for (const wrongM of mistakes.filter((m) => !m.isCorrect)) {
  const q = mat.questions.find((x) => x.questionId === wrongM.questionId);
  const graded = coach.gradeTrainingAnswer(q, wrongM, q.answerKey);
  after = coach.submitTrainingAnswer(after, wrongM.questionId, q.answerKey, graded, wrongM);
}
ok("9-10. 错题清零", after.status === "completed" && after.pool.length === 0);

const kRetrain = marketKline.upsertMarketKline(todayKey, {
  familyId: fam.familyId, studentId: student.memberId,
});
ok("K线. 复训清零 retrainImpact", kRetrain.kline.retrainImpact === 100);

const synced = storage.loadState().growthMarket;
ok("K线. currentIndex 同步 close", synced.currentIndex === kRetrain.kline.close
  && synced.index === kRetrain.kline.close);

marketKline.rebuildMarketKlines(7, { familyId: fam.familyId, studentId: student.memberId });
const week = marketKline.getMarketKlines(7, { familyId: fam.familyId, studentId: student.memberId });
ok("K线. 最近7天可读", week.length === 7);

const latest = marketKline.getLatestMarketSummary({ familyId: fam.familyId, studentId: student.memberId });
ok("K线. 最新摘要", latest.currentIndex === week[week.length - 1].close
  && latest.baseIndex === 4000);
ok("10. 错题池持久化清零", mistakes.filter((m) => !storage.getMistakes(fam.familyId).find((x) => x.questionId === m.questionId)?.isCorrect).length === 0);

// 11-13 打卡
const abilities = storage.calcAbilityScores(Object.fromEntries(
  storage.ABILITIES.flatMap((a) => a.items.map((it) => [it.id, "full"])),
));
const total = storage.calcTotal(abilities);
const rec = storage.upsertDailyRecord({
  familyId: fam.familyId,
  studentId: student.memberId,
  dateKey: storage.formatDateKey(),
  dateTime: storage.formatDateTime(),
  studyContent: "学了阅读", completedTasks: "完成作业",
  mood: "😊 开心", energy: "正常", stress: "低",
  highlight: "专注不错", tomorrowPlan: "继续词汇",
  noteToSelf: "加油", abilities, totalScore: total,
  grade: storage.getGrade(total),
  parentSummary: parentSummary.buildParentSummary(
    { studyContent: "学了阅读", completedTasks: "完成作业", abilities, totalScore: total, grade: storage.getGrade(total), highlight: "专注不错", tomorrowPlan: "继续词汇", mood: "😊 开心", energy: "正常", stress: "低" },
    { mistakeCount: 0, trainingDone: true, parentResponsePref: "只鼓励我" },
  ),
});
ok("11-13. 打卡记录", !!rec.recordId && rec.parentSummary?.tags?.overview);

// 14-17 优培爱心
auth.loginAsUser(storage.loadState().users.find((u) => u.role === "father").userId);
const stuUser = storage.loadState().users.find((u) => u.role === "student");
notes.sendHeartNotification({
  toUserId: stuUser.userId,
  fromRole: "father",
  fromName: "测爸",
  cardTitle: "爸爸鼓励",
  cardText: "今天很棒",
  cardStyle: "阳光鼓励",
  rewardType: "精神鼓励",
});
auth.loginAsUser(stuUser.userId);
ok("17. 孩子未读爱心", notes.getUnreadCount() === 1);

// 18-19 资料与导入导出
const exported = storage.exportJson();
storage.importJson(exported);
ok("19. 导出导入", storage.getFamily()?.familyName === "Daniel 的复训星球" && auth.isLoggedIn());

// 新注册家庭积分
const reg2 = auth.registerFamily({
  contact: "v14test@fuxun.local",
  password: "test5678",
  familyName: "测试家庭",
  childName: "小明",
});
const fam2 = reg2.family;
const stu2 = auth.getStudentMember(fam2?.familyId);
const stNew = storage.loadState();
ok("积分. 新注册家庭三方钱包", reg2.ok
  && growthAssets.getParentWalletByRole(stNew, fam2.familyId, "father")?.balance === 10000
  && growthAssets.getParentWalletByRole(stNew, fam2.familyId, "mother")?.balance === 10000
  && growthAssets.getStudentWalletFromState(stNew, fam2.familyId, stu2?.memberId)?.balance === 10000
  && stNew.growthMarket?.baseIndex === 4000);
auth.loginAsUser(stuUser.userId);

// 20 登出登录
auth.logout();
ok("20. 退出后未登录", !auth.isLoggedIn());
const login = auth.loginWithCredentials("demo@fuxun.local", "demo1234");
ok("20. 重新登录", login.ok);

// v15 家长奖励闭环
storage.patchState((s) => {
  const pw = growthAssets.getParentWalletByRole(s, fam.familyId, "father");
  const mw = growthAssets.getParentWalletByRole(s, fam.familyId, "mother");
  if (pw) pw.balance = 10000;
  if (mw) mw.balance = 10000;
});
const fatherUserV15 = storage.loadState().users.find((u) => u.role === "father");
const motherUserV15 = storage.loadState().users.find((u) => u.role === "mother");
auth.loginAsUser(fatherUserV15.userId);
const stBeforeFather = storage.loadState();
const fBalV15 = growthAssets.getParentWalletByRole(stBeforeFather, fam.familyId, "father")?.balance;
const sBalBefore = growthAssets.getStudentWalletFromState(stBeforeFather, fam.familyId, student.memberId)?.balance;
const rFather100 = pointLedger.rewardStudent({ parentRole: "father", points: 100, reason: "Ryan工作台奖励测试" });
const stFather = storage.loadState();
ok("v15. Ryan奖励扣钱包", rFather100.ok
  && growthAssets.getParentWalletByRole(stFather, fam.familyId, "father")?.balance === fBalV15 - 100
  && growthAssets.getStudentWalletFromState(stFather, fam.familyId, student.memberId)?.balance === sBalBefore + 100);
auth.loginAsUser(motherUserV15.userId);
const mBalV15 = growthAssets.getParentWalletByRole(stFather, fam.familyId, "mother")?.balance;
const rMother100 = pointLedger.rewardStudent({ parentRole: "mother", points: 100, reason: "Sara工作台奖励测试" });
const stMother = storage.loadState();
ok("v15. Sara奖励扣钱包", rMother100.ok
  && growthAssets.getParentWalletByRole(stMother, fam.familyId, "mother")?.balance === mBalV15 - 100);
ok("v15. 积分流水增加", (stMother.pointTransactions || []).length >= 2);
const parentSummaryMod = await import(pathToFileURL(path.join(root, "parentSummary.js")).href);
const psSp = parentSummaryMod.buildParentSummary(demoRec, {});
ok("v15. parentSummary读特别表现", (psSp.tags?.strengths || "").includes("特别表现"));
auth.loginAsUser(fatherUserV15.userId);
const spReward = pointLedger.rewardStudent({
  parentRole: "father", points: 50, reason: "特别表现确认奖励", relatedRecordId: demoRec?.recordId,
});
ok("v15. 特别表现转积分", spReward.ok
  && (storage.loadState().pointTransactions || []).some((t) => String(t.reason).includes("特别表现")));

// v16-B Ryan 投资官奖励闭环
auth.loginAsUser(fatherUserV15.userId);
const stV16b = storage.loadState();
const fBalBeforeCard = growthAssets.getParentWalletByRole(stV16b, fam.familyId, "father")?.balance;
const sBalBeforeCard = growthAssets.getStudentWalletFromState(stV16b, fam.familyId, student.memberId)?.balance;
const fatherMember = members.find((m) => m.role === "father");
const cardReward = fatherWorkbench.submitFatherReward({
  tool: "card",
  scenario: "错题清零",
  scenarioCategory: "learning",
  title: "Ryan测试贺卡",
  content: "今天复训进步很棒",
  points: 500,
  member: fatherMember,
  student,
  familyId: fam.familyId,
  relatedRecordId: demoRec?.recordId,
});
const stAfterCard = storage.loadState();
ok("v16b. 贺卡扣爸爸钱包500", cardReward.ok
  && growthAssets.getParentWalletByRole(stAfterCard, fam.familyId, "father")?.balance === fBalBeforeCard - 500);
ok("v16b. 贺卡增孩子积分500", cardReward.ok
  && growthAssets.getStudentWalletFromState(stAfterCard, fam.familyId, student.memberId)?.balance === sBalBeforeCard + 500);
ok("v16b. 贺卡生成honor流水", cardReward.ok
  && (stAfterCard.pointTransactions || []).some((t) => t.type === "honor" && t.honorType === "爸爸贺卡" && t.points === 500));
ok("v16b. 贺卡生成honorItem", cardReward.ok
  && honorItems.getHonorItems(fam.familyId, { itemType: "card" }).some((h) => h.title === "Ryan测试贺卡"));
const brokeCard = fatherWorkbench.submitFatherReward({
  tool: "medal",
  scenario: "坚持突破",
  medalType: "坚持突破星",
  points: 500,
  member: fatherMember,
  student,
  familyId: fam.familyId,
});
storage.patchState((s) => {
  const pw = growthAssets.getParentWalletByRole(s, fam.familyId, "father");
  if (pw) pw.balance = 400;
});
const brokeMedal = fatherWorkbench.submitFatherReward({
  tool: "medal",
  scenario: "测试不足",
  medalType: "坚持突破星",
  points: 500,
  member: fatherMember,
  student,
  familyId: fam.familyId,
});
ok("v16b. 积分不足不能发奖章", !brokeMedal.ok);
const snap = fatherWorkbench.buildFatherChildSnapshot(fam.familyId, student.memberId);
const ai = fatherWorkbench.buildFatherAiSuggestion(snap);
ok("v16b. 爸爸AI建议", !!ai.highlight && !!ai.rewardMethod && ai.suggestedPoints >= 100);

// 训练恢复
const restored = coach.restoreActiveSession(fam.familyId, mat.materialId);
ok("训练刷新恢复(无进行中应为空)", restored === null);

console.log("\n=== 复训星球验收结果 ===");
console.log(`通过: ${results.pass.length}`);
results.pass.forEach((p) => console.log(`  ✓ ${p}`));
if (results.fail.length) {
  console.log(`失败: ${results.fail.length}`);
  results.fail.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("\n全部自动化检查通过。");