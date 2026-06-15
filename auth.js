import {
  loadState, saveState, patchState, uid, genCode, nowIso,
  getFamily, getMembers, getUser, getStudentMember,
} from "./storage.js";
import { ensureGrowthAssets } from "./growthAssets.js";
import { DEFAULT_PARENT_SYSTEM_ROLES, resolveCoachMember } from "./memberRoles.js";

export { getFamily, getMembers, getStudentMember };

export function hashPassword(pw) {
  return btoa(unescape(encodeURIComponent(`fuxun:${pw}`)));
}
export function verifyPassword(pw, hash) {
  return hashPassword(pw) === hash;
}

export function getSession() { return loadState().session; }

export function setSession(session) {
  patchState((s) => { s.session = session; });
}

export function logout() { setSession(null); }

export function getCurrentUser() {
  const sid = getSession()?.userId;
  return sid ? getUser(sid) : null;
}

export function getCurrentRole() {
  return getCurrentUser()?.role || null;
}

export function isLoggedIn() { return !!getCurrentUser(); }

export function enterAsMember(memberIdOrRole) {
  const state = loadState();
  const fid = state.session?.familyId;
  let member = null;

  if (memberIdOrRole === "father" || memberIdOrRole === "mother" || memberIdOrRole === "student") {
    member = resolveCoachMember(memberIdOrRole, fid)?.member
      ?? state.members.find((m) => m.familyId === fid && m.role === memberIdOrRole)
      ?? null;
  }
  if (!member) {
    member = state.members.find((m) => m.memberId === memberIdOrRole) ?? null;
  }
  if (!member) return false;

  const user = state.users.find((u) => u.memberId === member.memberId);
  if (!user) return false;
  setSession({ userId: user.userId, familyId: member.familyId, role: member.role });
  user.lastLoginAt = nowIso();
  saveState(state);
  return true;
}

function tagList(raw) {
  if (Array.isArray(raw)) return raw;
  return String(raw || "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
}

function parseAvatar(emoji, image, type, value) {
  const isUpload = type === "upload" || !!image;
  const av = emoji || "👤";
  return {
    avatar: av,
    avatarImage: isUpload ? (value || image || "") : "",
    avatarType: isUpload ? "upload" : (type || "emoji"),
    avatarValue: isUpload ? (value || image || "") : av,
  };
}

function parseBadge(emoji, image, id, type, value) {
  const isUpload = type === "upload" || !!image;
  const em = emoji || "🪐";
  return {
    badge: em,
    badgeImage: isUpload ? (value || image || "") : "",
    badgeId: id || "planet",
    badgeType: isUpload ? "upload" : (type || "default"),
    badgeValue: isUpload ? (value || image || "") : em,
    familyBadge: em,
  };
}

export function registerFamily(data) {
  const state = loadState();
  const contact = String(data.contact || "").trim();
  if (!contact || !data.password || data.password.length < 6) {
    return { ok: false, error: "请填写联系方式和密码（至少 6 位）" };
  }

  const familyId = uid();
  const inviteCode = data.previewInviteCode || genCode();
  const badgeFields = parseBadge(data.badge, data.badgeImage, data.badgeId, data.badgeType, data.badgeValue);

  const family = {
    familyId,
    familyName: data.familyName || "我们的家庭",
    ...badgeFields,
    motto: data.motto || "每天进步一点点",
    familyMotto: data.motto || "每天进步一点点",
    coachingStyle: data.coachingStyle || "balance",
    feedbackStyle: data.coachingStyle || "balance",
    inviteCode,
    parentJoinCode: genCode(8),
    studentJoinCode: genCode(8),
    createdAt: nowIso(),
  };

  const mkMember = (role, fields) => ({
    memberId: uid(), familyId, role, hobbies: [], personalityTags: [], coachingStyle: [], ...fields,
  });

  const father = mkMember("father", {
    name: data.dadName || "爸爸",
    ...parseAvatar(data.dadAvatar, data.dadAvatarImage, data.dadAvatarType, data.dadAvatarValue),
    hobbies: tagList(data.dadHobbies),
    personalityTags: tagList(data.dadTags),
    coachingStyle: tagList(data.dadCompanion),
    systemRoles: tagList(data.dadSystemRoles).length
      ? tagList(data.dadSystemRoles)
      : [...DEFAULT_PARENT_SYSTEM_ROLES.father],
  });
  const mother = mkMember("mother", {
    name: data.momName || "妈妈",
    ...parseAvatar(data.momAvatar, data.momAvatarImage, data.momAvatarType, data.momAvatarValue),
    hobbies: tagList(data.momHobbies),
    personalityTags: tagList(data.momTags),
    coachingStyle: tagList(data.momCompanion),
    systemRoles: tagList(data.momSystemRoles).length
      ? tagList(data.momSystemRoles)
      : [...DEFAULT_PARENT_SYSTEM_ROLES.mother],
  });
  const student = mkMember("student", {
    name: data.childName || "同学",
    nickname: data.childNickname || "",
    ...parseAvatar(data.childAvatar, data.childAvatarImage, data.childAvatarType, data.childAvatarValue),
    grade: data.childGrade || "高一",
    school: data.childSchool || "",
    learningGoal: data.learningGoal || "",
    subjectFocus: tagList(data.childSubjects),
    hobbies: tagList(data.childHobbies),
    personalityTags: tagList(data.childTags),
    parentResponsePref: data.parentResponsePref || "只鼓励我",
    parentResponsePreference: data.parentResponsePref || "只鼓励我",
    systemRoles: ["成长星球"],
  });

  const pw = hashPassword(data.password);
  const isEmail = contact.includes("@");
  const mkUser = (member, role) => ({
    userId: uid(), familyId, memberId: member.memberId, role,
    name: member.name, phone: isEmail ? "" : contact, email: isEmail ? contact : "",
    passwordHash: pw, createdAt: nowIso(), lastLoginAt: null,
  });

  const users = [mkUser(father, "father"), mkUser(mother, "mother"), mkUser(student, "student")];

  state.families.push(family);
  state.members.push(father, mother, student);
  state.users.push(...users);
  ensureGrowthAssets(state);
  saveState(state);
  setSession({ userId: users[2].userId, familyId, role: "student" });
  return { ok: true, family, codes: { invite: family.inviteCode, parent: family.parentJoinCode, student: family.studentJoinCode } };
}

export function loginWithCredentials(contact, password) {
  const c = String(contact || "").trim().toLowerCase();
  const users = loadState().users.filter(
    (u) => (u.email?.toLowerCase() === c || u.phone === contact) && verifyPassword(password, u.passwordHash)
  );
  if (!users.length) return { ok: false, error: "账号或密码不正确" };
  if (users.length === 1) {
    setSession({ userId: users[0].userId, familyId: users[0].familyId, role: users[0].role });
    return { ok: true, user: users[0] };
  }
  return { ok: true, users, needPick: true };
}

export function loginAsUser(userId) {
  const user = getUser(userId);
  if (!user) return { ok: false };
  setSession({ userId: user.userId, familyId: user.familyId, role: user.role });
  return { ok: true, user };
}

export function joinWithCode(code, name) {
  const state = loadState();
  const up = code.toUpperCase();
  const fam = state.families.find((f) => f.inviteCode === up || f.parentJoinCode === up || f.studentJoinCode === up);
  if (!fam) return { ok: false, error: "邀请码无效" };
  const member = state.members.find((m) => m.familyId === fam.familyId && m.name === name.trim());
  if (!member) return { ok: false, error: "姓名不匹配" };
  const user = state.users.find((u) => u.memberId === member.memberId);
  if (!user) return { ok: false, error: "用户不存在" };
  setSession({ userId: user.userId, familyId: fam.familyId, role: user.role });
  return { ok: true, user };
}

export { seedDemo } from "./demoData.js";