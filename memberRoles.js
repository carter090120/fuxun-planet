/**
 * 家庭成员 — 家庭身份与系统角色
 */

export const SYSTEM_ROLE_OPTIONS = [
  "成长投资官",
  "陪伴荣誉官",
  "情绪守护官",
  "积分官",
  "荣誉官",
  "方法教练",
  "复盘官",
  "成长教练",
  "陪伴导师",
];

export const FAMILY_ROLE_LABELS = {
  father: "爸爸",
  mother: "妈妈",
  student: "孩子",
};

export const DEFAULT_PARENT_SYSTEM_ROLES = {
  father: ["成长投资官", "积分官"],
  mother: ["陪伴荣誉官", "情绪守护官"],
};

export const PARENT_WORKBENCH = {
  father: {
    title: (name) => `${name || "爸爸"} 的成长投资官工作台`,
    subtitle: "Growth Investor",
    tagline: "看见孩子在学习、生活和家庭责任中的关键成长瞬间，并把它转化为积分、奖章、表扬信和成长资产。",
  },
  mother: {
    title: (name) => `${name || "妈妈"} 的陪伴荣誉官工作台`,
    subtitle: "Care & Honor Coach",
    tagline: "看见孩子的情绪、压力、计划和日常努力，并通过鼓励卡、荣誉、陪伴奖励和温暖反馈帮助孩子持续成长。",
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
  if (member.role === "student") return "/student";
  if (member.role === "father") return "/coach/father";
  if (member.role === "mother") return "/coach/mother";
  return "/home";
}

export function getMemberEntryLabel(member) {
  if (member?.role === "student") return "进入学习";
  if (member?.role === "father" || member?.role === "mother") return "进入工作台";
  return "进入";
}