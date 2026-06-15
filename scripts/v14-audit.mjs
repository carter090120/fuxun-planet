/**
 * v14 完成度自查脚本
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
const gm = await import(pathToFileURL(path.join(root, "growthMarket.js")).href);
const growthAssets = await import(pathToFileURL(path.join(root, "growthAssets.js")).href);
const memberRoles = await import(pathToFileURL(path.join(root, "memberRoles.js")).href);
const pointLedger = await import(pathToFileURL(path.join(root, "pointLedger.js")).href);
const marketKline = await import(pathToFileURL(path.join(root, "marketKline.js")).href);

seedDemo();
const fam = auth.getFamily();
const student = auth.getStudentMember();
const members = auth.getMembers();
auth.loginWithCredentials("demo@fuxun.local", "demo1234");

const market = gm.getGrowthMarket(fam.familyId, student.memberId);
const st = storage.loadState();
const klines = (st.marketKlines || []).filter((k) => k.familyId === fam.familyId);
const sorted = [...klines].sort((a, b) => a.date.localeCompare(b.date));
const last = sorted.at(-1);

console.log("\n=== v14-B K线演示数据（seedDemo 后，未手工加分）===");
console.log("history.length:", market?.history?.length ?? 0);
console.log("index:", market?.index);
console.log("level:", market?.level);
console.log("todayChange:", market?.todayChange, "pct:", market?.todayChangePct ?? market?.todayChangePercent);
console.log("todayFactors:", market?.todayFactors?.map((f) => `${f.label}:${f.value}`).join(" | ") || "(无)");
console.log("marketKlines count:", klines.length, "last close:", last?.close);
console.log("disclaimer:", market?.disclaimer);
console.log("empty state?:", !market?.history?.length);

console.log("\n=== v14-A 角色 ===");
members.forEach((m) => {
  console.log(`${m.name}: ${memberRoles.formatMemberRoleLine(m)} -> ${memberRoles.getMemberEntryPath(m)}`);
});

console.log("\n=== v14-C 钱包 ===");
const fatherW = growthAssets.getParentWalletByRole(st, fam.familyId, "father");
const motherW = growthAssets.getParentWalletByRole(st, fam.familyId, "mother");
const studentW = growthAssets.getStudentWalletFromState(st, fam.familyId, student.memberId);
console.log("Ryan:", fatherW?.balance, "Sara:", motherW?.balance, "Daniel:", studentW?.balance);

console.log("\n=== v14-D 特别表现字段 ===");
const rec = storage.getTodayRecord(fam.familyId);
console.log("todayRecord keys:", rec ? Object.keys(rec) : "(无今日打卡)");
const checkinFields = ["specialPerformance", "todaySpecial", "highlightPerformance", "specialPerf"];
checkinFields.forEach((f) => console.log(`  ${f}:`, rec?.[f] ?? "(不存在)"));

console.log("\n=== 数据闭环：爸爸加分 ===");
const fatherUser = st.users.find((u) => u.role === "father");
auth.loginAsUser(fatherUser.userId);
const fb = fatherW.balance;
const reward = pointLedger.rewardStudent({ parentRole: "father", points: 50, reason: "测试奖励" });
const after = storage.loadState();
const fa = growthAssets.getParentWalletByRole(after, fam.familyId, "father")?.balance;
const sa = growthAssets.getStudentWalletFromState(after, fam.familyId, student.memberId)?.balance;
const txs = (after.pointTransactions || []).length;
const m2 = gm.getGrowthMarket(fam.familyId, student.memberId);
console.log("reward ok:", reward.ok, "father", fb, "->", fa, "student balance:", sa, "tx count:", txs);
console.log("K线 index after reward:", m2?.index);

console.log("\n=== saveCoach 是否联动积分 ===");
console.log("(saveCoach 仅 addCoachingAction，不调用 rewardStudent — 需代码确认)");