/**
 * 家庭成员 — 家庭身份与系统角色
 */

export const SYSTEM_ROLE_OPTIONS = [
  "成长教练",
  "陪伴导师",
  "方法教练",
  "荣誉官",
  "积分官",
  "复盘官",
];

export const FAMILY_ROLE_LABELS = {
  father: "爸爸",
  mother: "妈妈",
  student: "孩子",
};

export const DEFAULT_PARENT_SYSTEM_ROLES = {
  father: ["成长教练", "积分官"],
  mother: ["陪伴导师", "荣誉官"],
};

export const PARENT_WORKBENCH = {
  father: {
    title: (name) => `${name || "爸爸"} 的成长教练台`,
    subtitle: "Growth Coach",
    tagline: "看目标、看结果、看错题、给方法、给积分奖励。",
  },
  mother: {
    title: (name) => `${name || "妈妈"} 的陪伴导师台`,
    subtitle: "Care Coach",
    tagline: "看状态、看心情、看计划、给鼓励、发荣誉和陪伴奖励。",
  },
};

export function getMemberSystemRoles(member) {
  if (!member) return [];
  if (Array.isArray(member.systemRoles) && member.systemRoles.length) {
    return member.systemRoles;
  }
  if (member.role === "father") return [...DEFAULT_PARENT_SYSTEM_ROLES.father];
  if (member.role === "mother") return [...DEFAULT_PARENT_SYSTEM_ROLES.mother];
  if (member.role === "student") return ["成长星球"];
  return [];
}

export function formatMemberRoleLine(member) {
  const family = FAMILY_ROLE_LABELS[member?.role] || member?.role || "";
  const sys = getMemberSystemRoles(member);
  return [family, ...sys].filter(Boolean).join("｜");
}

export function getParentWorkbenchMeta(role, member) {
  const wb = PARENT_WORKBENCH[role];
  if (!wb) return null;
  return {
    title: wb.title(member?.name),
    subtitle: wb.subtitle,
    tagline: wb.tagline,
    systemRoles: getMemberSystemRoles(member),
    familyRole: FAMILY_ROLE_LABELS[role],
  };
}

export function getMemberEntryPath(member) {
  if (!member) return "/home";
  if (member.role === "student") return "/checkin";
  if (member.role === "father") return "/coach/father";
  if (member.role === "mother") return "/coach/mother";
  return "/home";
}

export function getMemberEntryLabel(member) {
  if (member?.role === "student") return "进入学习";
  if (member?.role === "father" || member?.role === "mother") return "进入工作台";
  return "进入";
}