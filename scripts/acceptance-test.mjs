/**
 * 复训星球闭环验收脚本（Node 模拟 localStorage）
 * 运行：node scripts/acceptance-test.mjs
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

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
storage.saveState(st);
const reloaded = storage.loadState();
ok("积分. 刷新后持久化",
  growthAssets.getParentWalletByRole(reloaded, fam.familyId, "father")?.balance === 10000
  && growthAssets.getStudentWalletFromState(reloaded, fam.familyId, student.memberId)?.balance === 10000
  && reloaded.growthMarket?.baseIndex === 4000);
ok("积分. 权限-孩子不能自加分", !growthAssets.canStudentSelfCredit("student"));
ok("积分. 权限-爸爸只能用爸爸钱包", growthAssets.canUseParentWallet("father", "father")
  && !growthAssets.canUseParentWallet("father", "mother"));

// 9-10 训练清零（答对全部错题）
let after = session;
for (const wrongM of mistakes.filter((m) => !m.isCorrect)) {
  const q = mat.questions.find((x) => x.questionId === wrongM.questionId);
  const graded = coach.gradeTrainingAnswer(q, wrongM, q.answerKey);
  after = coach.submitTrainingAnswer(after, wrongM.questionId, q.answerKey, graded, wrongM);
}
ok("9-10. 错题清零", after.status === "completed" && after.pool.length === 0);
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