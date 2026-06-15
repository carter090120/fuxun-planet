/**
 * 演示模式 — 一键恢复标准演示数据（仅 demo@fuxun.local）
 */
import {
  loadState, patchState, formatDateKey, upsertDailyRecord, uid, nowIso,
} from "./storage.js";
import { getStudentMember, loginWithCredentials, loginAsUser } from "./auth.js";
import { seedDemoGrowthMarket } from "./growthMarket.js";
import { ensureGrowthAssets, PARENT_INITIAL_BALANCE, STUDENT_INITIAL_BALANCE } from "./growthAssets.js";
export const DEMO_CREDENTIALS = {
  email: "demo@fuxun.local",
  password: "demo1234",
};

export const DEMO_RESET_TOAST = "演示数据已恢复。现在可以从首页开始完整演示复训星球。";

export const DEMO_SPECIAL_PERFORMANCE = {
  hasPerformance: "yes",
  category: "学习场景",
  subcategory: "Evidence 证据定位",
  customDescription: "今天为了一道 Evidence 题坚持很久，饭前还在看解析，最后终于明白了证据定位方法。",
  selfRating: "坚持突破",
  suggestedPoints: 200,
};

const DEMO_WALLET_SNAPSHOT = {
  father: { balance: 9500, totalRewarded: 500, todayRewarded: 500 },
  mother: { balance: 9500, totalRewarded: 500, todayRewarded: 500 },
  student: {
    balance: 10500,
    totalEarned: 500,
    todayNetChange: 500,
    totalGrowthAssets: 10500,
  },
};

export function isDemoAccount(user) {
  if (!user) return false;
  const u = loadState().users.find((x) => x.userId === user.userId);
  return u?.email?.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase();
}

export function isDemoFamily(familyId) {
  return loadState().users.some(
    (u) => u.familyId === familyId && u.email?.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase(),
  );
}

function mkHonorItem(data) {
  return {
    honorItemId: uid(),
    dateKey: formatDateKey(),
    createdAt: nowIso(),
    ...data,
  };
}

function mkCoachingAction(data) {
  return {
    actionId: uid(),
    createdAt: nowIso(),
    dateKey: formatDateKey(),
    ...data,
  };
}

function mkPointTx(data) {
  return {
    transactionId: uid(),
    createdAt: nowIso(),
    ...data,
  };
}

export function applyDemoPresentationLayer(familyId) {
  const members = loadState().members.filter((m) => m.familyId === familyId);
  const father = members.find((m) => m.role === "father");
  const mother = members.find((m) => m.role === "mother");
  const student = members.find((m) => m.role === "student");
  if (!student) return { ok: false, error: "未找到演示孩子" };

  const today = formatDateKey();

  upsertDailyRecord({
    recordId: "demo-checkin-today",
    familyId,
    studentId: student.memberId,
    dateKey: today,
    studyContent: "SAT Reading · Evidence 证据定位",
    completedTasks: "完成 Evidence 题复训，理解证据定位方法",
    mood: "开心",
    energy: "充沛",
    stress: "低",
    totalScore: 88,
    specialPerformance: { ...DEMO_SPECIAL_PERFORMANCE },
  });

  patchState((s) => {
    const fam = s.families.find((f) => f.familyId === familyId);
    if (fam) {
      fam.familyName = "Daniel 的复训星球";
      fam.motto = "错题清零，星球升级。";
      fam.familyMotto = fam.motto;
    }

    ensureGrowthAssets(s);

    s.parentWallets.forEach((w) => {
      if (w.familyId !== familyId) return;
      const snap = DEMO_WALLET_SNAPSHOT[w.parentRole];
      if (!snap) return;
      w.initialBalance = PARENT_INITIAL_BALANCE;
      w.balance = snap.balance;
      w.totalRewarded = snap.totalRewarded;
      w.totalDeducted = 0;
      w.todayRewarded = snap.todayRewarded;
      w.todayDeducted = 0;
      w.updatedAt = nowIso();
    });

    s.studentWallets.forEach((w) => {
      if (w.familyId !== familyId || w.studentId !== student.memberId) return;
      const snap = DEMO_WALLET_SNAPSHOT.student;
      w.initialBalance = STUDENT_INITIAL_BALANCE;
      w.balance = snap.balance;
      w.todayNetChange = snap.todayNetChange;
      w.totalEarned = snap.totalEarned;
      w.totalDeducted = 0;
      w.totalInvested = 500;
      w.currentInvestmentValue = 528;
      w.totalGrowthAssets = snap.totalGrowthAssets;
      w.updatedAt = nowIso();
    });

    s.honorItems = (s.honorItems || []).filter((h) => h.familyId !== familyId);
    s.coachingActions = (s.coachingActions || []).filter((a) => a.familyId !== familyId);
    s.pointTransactions = (s.pointTransactions || []).filter((t) => t.familyId !== familyId);

    const honorSamples = [
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "father",
        fromName: father?.name || "Ryan",
        itemType: "praise-letter",
        title: "Evidence 突破表扬信",
        content: "今天为了一道 Evidence 题坚持很久，饭前还在看解析，爸爸看见你的韧劲。",
        scenario: "特别表现",
        points: 500,
      }),
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "mother",
        fromName: mother?.name || "Sara",
        itemType: "card",
        title: "妈妈鼓励卡",
        content: "解析看懂了就是进步，明天继续一点点来。",
        scenario: "情绪支持",
        points: 500,
      }),
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "father",
        fromName: father?.name || "Ryan",
        itemType: "medal",
        title: "错题清零星",
        medalType: "错题清零星",
        content: "3 道错题全部清零，值得一枚成长奖章。",
        scenario: "错题清零",
        points: 500,
      }),
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "mother",
        fromName: mother?.name || "Sara",
        itemType: "badge",
        title: "坚持突破星",
        medalType: "坚持突破星",
        content: "饭前还在看解析，这份坚持值得被看见。",
        scenario: "温暖坚持",
        points: 500,
      }),
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "father",
        fromName: father?.name || "Ryan",
        itemType: "certificate",
        title: "阶段目标证书",
        content: "SAT Reading Evidence 定位方法 · 阶段达成",
        scenario: "阶段目标",
        points: 0,
      }),
      mkHonorItem({
        familyId,
        studentId: student.memberId,
        fromRole: "father",
        fromName: father?.name || "Ryan",
        itemType: "growth-event",
        title: "特别表现确认",
        content: DEMO_SPECIAL_PERFORMANCE.customDescription,
        scenario: "Evidence 证据定位",
        points: 200,
        specialPerformance: true,
      }),
    ];
    s.honorItems.unshift(...honorSamples);

    const coachSamples = [
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "father",
        type: "praise",
        content: JSON.stringify({ tool: "praise-letter", points: 500, title: "Evidence 突破表扬信" }),
        payload: { tool: "praise-letter", honorType: "表扬信", points: 500, title: "Evidence 突破表扬信" },
      }),
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "mother",
        type: "card",
        content: JSON.stringify({ tool: "card", points: 500, title: "妈妈鼓励卡" }),
        payload: { tool: "card", honorType: "鼓励卡", points: 500, title: "妈妈鼓励卡" },
      }),
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "father",
        type: "medal",
        content: JSON.stringify({ tool: "medal", medalType: "错题清零星", points: 500 }),
        payload: { tool: "medal", honorType: "奖章", medalType: "错题清零星", points: 500 },
      }),
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "mother",
        type: "stars",
        content: JSON.stringify({ tool: "badge", medalType: "坚持突破星", points: 500 }),
        payload: { tool: "badge", honorType: "荣誉徽章", medalType: "坚持突破星", points: 500 },
      }),
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "father",
        type: "method",
        content: JSON.stringify({ tool: "method-card", title: "证据定位三步法" }),
        payload: { tool: "method-card", honorType: "方法卡", title: "证据定位三步法" },
      }),
      mkCoachingAction({
        familyId,
        studentId: student.memberId,
        parentRole: "mother",
        type: "plan",
        content: JSON.stringify({ tool: "tomorrow-goal", title: "明日先完成错题复训" }),
        payload: { tool: "tomorrow-goal", honorType: "明日小目标", title: "明日先完成错题复训" },
      }),
    ];
    s.coachingActions.unshift(...coachSamples);

    const fatherUser = s.users.find((u) => u.memberId === father?.memberId);
    const motherUser = s.users.find((u) => u.memberId === mother?.memberId);

    const txs = [
      mkPointTx({
        familyId,
        studentId: student.memberId,
        fromUserId: fatherUser?.userId,
        fromRole: "father",
        type: "reward",
        points: 500,
        reason: "Evidence 突破表扬信",
        honorType: "表扬信",
        honorItemType: "praise-letter",
        affectsMarket: false,
      }),
      mkPointTx({
        familyId,
        studentId: student.memberId,
        fromUserId: motherUser?.userId,
        fromRole: "mother",
        type: "reward",
        points: 500,
        reason: "妈妈鼓励卡",
        honorType: "鼓励卡",
        honorItemType: "card",
        affectsMarket: false,
      }),
    ];
    s.pointTransactions.unshift(...txs);

    if (s.growthMarket?.familyId === familyId) {
      s.growthMarket.wallets = { father: 9500, mother: 9500 };
    }
  });

  seedDemoGrowthMarket(familyId, student.memberId);
  return { ok: true, familyId, studentId: student.memberId };
}

function restoreDemoSession(prevRole) {
  const login = loginWithCredentials(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
  if (!login.ok) return login;
  const users = login.users || (login.user ? [login.user] : []);
  const target = users.find((u) => u.role === prevRole) || users.find((u) => u.role === "father") || users[0];
  if (!target) return { ok: false, error: "演示账号登录失败" };
  loginAsUser(target.userId);
  return { ok: true, user: target };
}

export async function resetDemoData(opts = {}) {
  const prevRole = opts.preserveRole || loadState().session?.role || "father";
  const { seedDemo } = await import("./demoData.js");
  const seeded = seedDemo();
  if (!seeded.ok) return seeded;

  const session = restoreDemoSession(prevRole);
  if (!session.ok) return session;

  return { ok: true, message: DEMO_RESET_TOAST };
}

export function regenerateDemoGrowthMarket() {
  const user = loadState().users.find((u) => u.userId === loadState().session?.userId);
  if (!isDemoAccount(user)) return { ok: false, error: "仅演示账号可使用此功能" };
  const student = getStudentMember();
  if (!student) return { ok: false, error: "未找到孩子成员" };
  seedDemoGrowthMarket(user.familyId, student.memberId);
  return { ok: true, message: "成长大盘已重新生成" };
}

export function clearDemoTodayOperations() {
  const user = loadState().users.find((u) => u.userId === loadState().session?.userId);
  if (!isDemoAccount(user)) return { ok: false, error: "仅演示账号可使用此功能" };
  const fid = user.familyId;
  const today = formatDateKey();

  patchState((s) => {
    s.coachingActions = (s.coachingActions || []).filter(
      (a) => !(a.familyId === fid && a.dateKey === today),
    );
    s.honorItems = (s.honorItems || []).filter(
      (h) => !(h.familyId === fid && h.dateKey === today),
    );
    s.pointTransactions = (s.pointTransactions || []).filter((t) => {
      if (t.familyId !== fid) return true;
      const dk = t.createdAt?.slice(0, 10);
      return dk !== today;
    });

    ensureGrowthAssets(s);
    s.parentWallets.forEach((w) => {
      if (w.familyId !== fid) return;
      w.todayRewarded = 0;
      w.todayDeducted = 0;
      w.updatedAt = nowIso();
    });
    s.studentWallets.forEach((w) => {
      if (w.familyId !== fid) return;
      w.todayNetChange = 0;
      w.updatedAt = nowIso();
    });
  });

  return { ok: true, message: "今日操作记录已清空" };
}