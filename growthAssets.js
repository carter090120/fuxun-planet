/**
 * 复训星球 — 三方积分与成长大盘数据底座
 */
function uid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }

export const PARENT_INITIAL_BALANCE = 10000;
export const STUDENT_INITIAL_BALANCE = 10000;
export const GROWTH_BASE_INDEX = 4000;

/** 成长大盘等级（指数，非积分余额） */
export const GROWTH_INDEX_LEVELS = [
  { min: 10000, name: "荣耀星球" },
  { min: 7000, name: "优秀星球" },
  { min: 5000, name: "进阶星球" },
  { min: 4000, name: "成长星球" },
  { min: 0, name: "起步星球" },
];

export function getGrowthIndexLevel(index) {
  const v = Number(index) || 0;
  for (const lv of GROWTH_INDEX_LEVELS) {
    if (v >= lv.min) return lv.name;
  }
  return GROWTH_INDEX_LEVELS.at(-1).name;
}

function findUserForMember(state, memberId) {
  return (state.users || []).find((u) => u.memberId === memberId) || null;
}

function migrateParentWallet(wallet) {
  const initial = wallet.initialBalance ?? PARENT_INITIAL_BALANCE;
  return {
    ...wallet,
    initialBalance: initial,
    balance: wallet.balance ?? initial,
    totalRewarded: wallet.totalRewarded ?? 0,
    totalDeducted: wallet.totalDeducted ?? 0,
    todayRewarded: wallet.todayRewarded ?? 0,
    todayDeducted: wallet.todayDeducted ?? 0,
    updatedAt: wallet.updatedAt || nowIso(),
  };
}

function migrateStudentWallet(wallet) {
  const initial = wallet.initialBalance ?? STUDENT_INITIAL_BALANCE;
  const balance = wallet.balance ?? initial;
  return {
    ...wallet,
    initialBalance: initial,
    balance,
    todayNetChange: wallet.todayNetChange ?? 0,
    totalEarned: wallet.totalEarned ?? 0,
    totalDeducted: wallet.totalDeducted ?? 0,
    totalInvested: wallet.totalInvested ?? 0,
    currentInvestmentValue: wallet.currentInvestmentValue ?? 0,
    totalGrowthAssets: wallet.totalGrowthAssets ?? balance,
    updatedAt: wallet.updatedAt || nowIso(),
  };
}

export function createParentWallet(familyId, parentUserId, parentRole) {
  const ts = nowIso();
  return {
    walletId: uid(),
    familyId,
    parentUserId,
    parentRole,
    initialBalance: PARENT_INITIAL_BALANCE,
    balance: PARENT_INITIAL_BALANCE,
    totalRewarded: 0,
    totalDeducted: 0,
    todayRewarded: 0,
    todayDeducted: 0,
    updatedAt: ts,
  };
}

export function createStudentWallet(familyId, studentId) {
  const ts = nowIso();
  return {
    walletId: uid(),
    familyId,
    studentId,
    initialBalance: STUDENT_INITIAL_BALANCE,
    balance: STUDENT_INITIAL_BALANCE,
    todayNetChange: 0,
    totalEarned: 0,
    totalDeducted: 0,
    totalInvested: 0,
    currentInvestmentValue: 0,
    totalGrowthAssets: STUDENT_INITIAL_BALANCE,
    updatedAt: ts,
  };
}

export function createGrowthMarketRecord(familyId, studentId, patch = {}) {
  const currentIndex = patch.currentIndex ?? GROWTH_BASE_INDEX;
  const todayChange = patch.todayChange ?? 0;
  const todayChangePercent = patch.todayChangePercent ?? 0;
  return {
    familyId,
    studentId,
    baseIndex: GROWTH_BASE_INDEX,
    currentIndex,
    todayChange,
    todayChangePercent,
    level: getGrowthIndexLevel(currentIndex),
    updatedAt: patch.updatedAt || nowIso(),
  };
}

function walletBalancesForFamily(state, familyId) {
  const father = state.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "father");
  const mother = state.parentWallets.find((w) => w.familyId === familyId && w.parentRole === "mother");
  return {
    father: father?.balance ?? PARENT_INITIAL_BALANCE,
    mother: mother?.balance ?? PARENT_INITIAL_BALANCE,
  };
}

function syncLegacyGrowthMarket(state, market, familyId) {
  const prev = state.growthMarket?.familyId === familyId ? state.growthMarket : {};
  const wallets = walletBalancesForFamily(state, familyId);
  state.growthMarket = {
    ...prev,
    ...market,
    index: market.currentIndex,
    todayChangePct: market.todayChangePercent,
    level: market.level || getGrowthIndexLevel(market.currentIndex),
    wallets,
    disclaimer: prev.disclaimer,
    history: prev.history,
    todayFactors: prev.todayFactors,
    investments: prev.investments,
  };
}

function migrateGrowthMarket(state, familyId, studentId) {
  const gm = state.growthMarket;
  if (!gm || gm.familyId !== familyId || gm.studentId !== studentId) return false;

  const currentIndex = gm.currentIndex ?? gm.index ?? GROWTH_BASE_INDEX;
  const todayChangePercent = gm.todayChangePercent ?? gm.todayChangePct ?? 0;
  const market = {
    familyId,
    studentId,
    baseIndex: gm.baseIndex ?? GROWTH_BASE_INDEX,
    currentIndex,
    todayChange: gm.todayChange ?? 0,
    todayChangePercent,
    level: getGrowthIndexLevel(currentIndex),
    updatedAt: gm.updatedAt || nowIso(),
  };
  const before = JSON.stringify(gm);
  syncLegacyGrowthMarket(state, market, familyId);
  return JSON.stringify(state.growthMarket) !== before;
}

/**
 * 为 state 补齐三方积分与成长大盘；不重置已有余额。
 * @returns {{ state, changed: boolean }}
 */
export function ensureGrowthAssets(state) {
  let changed = false;
  if (!Array.isArray(state.parentWallets)) {
    state.parentWallets = [];
    changed = true;
  }
  if (!Array.isArray(state.studentWallets)) {
    state.studentWallets = [];
    changed = true;
  }

  for (const family of state.families || []) {
    const { familyId } = family;
    const members = (state.members || []).filter((m) => m.familyId === familyId);
    const father = members.find((m) => m.role === "father");
    const mother = members.find((m) => m.role === "mother");
    const student = members.find((m) => m.role === "student");

    for (const [member, role] of [[father, "father"], [mother, "mother"]]) {
      if (!member) continue;
      const user = findUserForMember(state, member.memberId);
      if (!user) continue;
      const idx = state.parentWallets.findIndex(
        (w) => w.familyId === familyId && w.parentUserId === user.userId,
      );
      if (idx < 0) {
        state.parentWallets.push(createParentWallet(familyId, user.userId, role));
        changed = true;
      } else {
        const migrated = migrateParentWallet(state.parentWallets[idx]);
        if (JSON.stringify(migrated) !== JSON.stringify(state.parentWallets[idx])) {
          state.parentWallets[idx] = migrated;
          changed = true;
        }
      }
    }

    if (!student) continue;

    const swIdx = state.studentWallets.findIndex(
      (w) => w.familyId === familyId && w.studentId === student.memberId,
    );
    if (swIdx < 0) {
      state.studentWallets.push(createStudentWallet(familyId, student.memberId));
      changed = true;
    } else {
      const migrated = migrateStudentWallet(state.studentWallets[swIdx]);
      if (JSON.stringify(migrated) !== JSON.stringify(state.studentWallets[swIdx])) {
        state.studentWallets[swIdx] = migrated;
        changed = true;
      }
    }

    const hasMarket = state.growthMarket
      && state.growthMarket.familyId === familyId
      && state.growthMarket.studentId === student.memberId;

    if (!hasMarket) {
      const market = createGrowthMarketRecord(familyId, student.memberId);
      syncLegacyGrowthMarket(state, market, familyId);
      changed = true;
    } else if (migrateGrowthMarket(state, familyId, student.memberId)) {
      changed = true;
    } else {
      const wallets = walletBalancesForFamily(state, familyId);
      const gm = state.growthMarket;
      if (gm.wallets?.father !== wallets.father || gm.wallets?.mother !== wallets.mother) {
        gm.wallets = wallets;
        changed = true;
      }
    }
  }

  return { state, changed };
}

/* ── 查询 ── */
export function getParentWalletsFromState(state, familyId) {
  return (state.parentWallets || []).filter((w) => w.familyId === familyId);
}

export function getParentWalletByRole(state, familyId, parentRole) {
  return (state.parentWallets || []).find(
    (w) => w.familyId === familyId && w.parentRole === parentRole,
  ) || null;
}

export function getStudentWalletFromState(state, familyId, studentId) {
  return (state.studentWallets || []).find(
    (w) => w.familyId === familyId && w.studentId === studentId,
  ) || null;
}

/* ── 权限（数据层） ── */
export function canUseParentWallet(userRole, walletParentRole) {
  if (userRole === "admin") return true;
  return userRole === walletParentRole;
}

export function canViewParentWalletBalance(userRole, parentRole) {
  return userRole === parentRole;
}

export function canViewStudentWalletBalance(userRole) {
  return userRole === "student";
}

/** @deprecated use canViewStudentWalletBalance */
export function canViewStudentWallet(userRole) {
  return canViewStudentWalletBalance(userRole);
}

export function canStudentSelfCredit(userRole) {
  return userRole !== "student";
}

export function canResetGrowthAssets(userRole) {
  return userRole === "admin";
}

export function assertParentWalletAccess(userRole, wallet) {
  if (!wallet) return { ok: false, error: "钱包不存在" };
  if (!canUseParentWallet(userRole, wallet.parentRole)) {
    return { ok: false, error: "只能使用自己的优培积分钱包" };
  }
  return { ok: true, wallet };
}

export function resetGrowthAssetsForFamily(state, familyId) {
  state.parentWallets = (state.parentWallets || []).filter((w) => w.familyId !== familyId);
  state.studentWallets = (state.studentWallets || []).filter((w) => w.familyId !== familyId);
  if (state.growthMarket?.familyId === familyId) state.growthMarket = null;
  ensureGrowthAssets(state);
  return state;
}