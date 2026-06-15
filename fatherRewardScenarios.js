/**
 * Ryan 奖励场景库 — 大类 / 小类 / 自动生成草稿
 */
import { formatSpecialPerformanceSummary } from "./specialPerformance.js";

export const FATHER_TOOL_LABELS = {
  card: "发爸爸贺卡",
  "praise-letter": "写爸爸表扬信",
  medal: "发爸爸奖章",
  "method-card": "发方法卡",
  "father-pact": "发父子约定",
};

export const FATHER_SUBMIT_LABELS = {
  card: "确认发放贺卡（扣 Ryan 钱包 500 分）",
  "praise-letter": "确认发送表扬信（扣 Ryan 钱包 500 分）",
  medal: "确认颁发奖章（扣 Ryan 钱包 500 分）",
  "method-card": "确认发送方法卡（扣 Ryan 钱包 100 分）",
  "father-pact": "确认发起父子约定（扣 Ryan 钱包 300 分）",
};

export const FATHER_TOOL_DEFAULTS = {
  card: {
    title: "",
    titlePlaceholder: "贺卡标题",
    content: "爸爸看见你今天在坚持。",
    points: 500,
    tool: "card",
  },
  "praise-letter": {
    title: "",
    titlePlaceholder: "表扬信标题",
    content: "爸爸想认真表扬你今天的一个成长瞬间。",
    points: 500,
    tool: "praise-letter",
  },
  medal: {
    title: "",
    titlePlaceholder: "奖章标题",
    content: "",
    points: 500,
    tool: "medal",
  },
  "method-card": {
    title: "学习方法卡",
    titlePlaceholder: "方法卡标题",
    content: "下一次可以先找关键词，再定位答案依据。",
    points: 100,
    tool: "method-card",
  },
  "father-pact": {
    title: "父子成长约定",
    titlePlaceholder: "约定标题",
    content: "",
    points: 300,
    tool: "father-pact",
  },
};

const SP_CATEGORY_MAP = {
  "学习场景": "learning",
  "生活场景": "life",
  "情绪管理": "emotion",
  "自我管理": "plan",
  "家庭责任": "family",
  "运动健康": "life",
  "其它自定义": "custom",
};

function item(label, title, content, tool = "card", points = 500, medalType = "") {
  return { label, title, content, tool, points, medalType };
}

/** @type {Record<string, { label: string, icon: string, items: ReturnType<typeof item>[] }>} */
export const FATHER_REWARD_SCENARIOS = {
  learning: {
    label: "学习成长场景",
    icon: "📚",
    items: [
      item("错题清零", "错题清零，值得庆祝", "爸爸看见你今天把错题清零了。愿意面对不会的地方并坚持弄懂，这是最值得投资的学习成果。", "medal", 500, "错题清零星"),
      item("为一道错题坚持很久", "这一次坚持很珍贵", "爸爸看见你今天为了弄懂一道错题坚持了很久。真正的成长，不只是做对题，而是愿意把不会的地方弄明白。", "praise-letter", 500),
      item("主动复训错题", "主动复训真棒", "爸爸看见你主动投入复训。愿意回到错题上，比逃避更值得骄傲。", "card", 500),
      item("主动整理错题本", "整理错题是好习惯", "爸爸看见你主动整理错题本。把问题收好、理清，下次就会更有把握。", "card", 500),
      item("主动背词汇", "词汇积累见坚持", "爸爸看见你主动背词汇。每天一点点，积累起来会很可观。", "card", 300),
      item("主动阅读", "阅读让心更开阔", "爸爸看见你主动阅读。阅读不只是学习，也是在扩展你的世界。", "card", 300),
      item("主动问问题", "敢问问题很棒", "爸爸看见你主动问问题。敢问、敢学，是真正会学习的表现。", "card", 500),
      item("主动完成计划外学习", "自驱学习值得赞", "爸爸看见你主动完成了计划外的学习。这种自驱力，比一次分数更珍贵。", "medal", 500, "自驱学习星"),
      item("复盘今天的问题", "复盘让明天更好", "爸爸看见你愿意复盘今天的问题。复盘不是批评，而是让明天走得更稳。", "card", 500),
      item("训练正确率提升", "训练状态在变好", "爸爸看见你今天的训练正确率在提升。稳定进步，说明方法正在起作用。", "card", 500),
      item("连续打卡坚持", "坚持打卡真不容易", "爸爸看见你连续坚持打卡。每一天的坚持，都在积累你的成长资产。", "card", 500),
    ],
  },
  motherCare: {
    label: "妈妈守护场景",
    icon: "🏠",
    items: [
      item("主动帮妈妈做家务", "妈妈守护星", "爸爸看到你主动帮妈妈分担，这说明你正在长成一个有责任感、懂得关心家人的孩子。", "medal", 500, "妈妈守护星"),
      item("妈妈提醒时没有顶嘴", "愿意听，愿意改", "爸爸看见你在妈妈提醒时没有顶嘴，而是愿意听、愿意调整。这比争赢更重要。", "card", 500),
      item("主动向妈妈表达感谢", "懂得感恩真好", "爸爸听见你主动向妈妈表达感谢。懂得感恩，会让家更有温度。", "card", 500),
      item("妈妈累的时候主动分担", "分担让家更暖", "爸爸看见妈妈在累的时候，你主动站出来分担。这是很成熟、很温暖的表现。", "medal", 500, "妈妈守护星"),
      item("和妈妈发生分歧后主动沟通", "愿意沟通化解分歧", "爸爸看见你在分歧之后仍愿意和妈妈沟通。这比争赢更重要，也更成熟。", "card", 500),
      item("妈妈不在时主动完成任务", "可靠的孩子", "爸爸看见妈妈在不在时，你仍主动完成了该做的事。可靠，是一种很珍贵的品质。", "card", 500),
      item("做了一件让妈妈轻松一点的事", "温暖行动值得赞", "爸爸看见你做了一件让妈妈轻松一点的事。小小的行动，会让家更温暖。", "card", 500),
      item("对妈妈说了一句温暖的话", "一句话也很珍贵", "爸爸听见你对妈妈说了温暖的话。有时候，一句话就能让家人更有力量。", "card", 500),
    ],
  },
  fatherPact: {
    label: "父子成长契约场景",
    icon: "🤝",
    items: [
      item("完成和爸爸约定的目标", "父子约定完成奖", "爸爸看到你完成了我们之间的约定。守住目标，是一个人真正开始自我管理的表现。", "card", 500),
      item("接受爸爸给的方法", "愿意尝试新方法", "爸爸看见你愿意尝试爸爸给的方法。愿意听、愿意试，成长就会更快。", "method-card", 100),
      item("主动向爸爸汇报进度", "主动汇报很棒", "爸爸看见你主动向爸爸汇报进度。会沟通、会汇报，是自我管理的重要一步。", "card", 300),
      item("跟爸爸说了真实困难", "敢说困难是勇气", "爸爸很高兴你愿意说出真实困难。敢说困难，爸爸才能更好地陪你一起解决。", "card", 500),
      item("和爸爸一起复盘错题", "一起复盘更有方向", "爸爸看见你愿意和爸爸一起复盘错题。一起找方法，比一个人硬扛更有效。", "praise-letter", 500),
      item("完成爸爸设置的挑战任务", "挑战完成星", "爸爸看见你完成了爸爸设置的挑战任务。敢接受挑战并完成，很值得正式认可。", "medal", 500, "目标兑现星"),
      item("今天比昨天更自律", "自律在长大", "爸爸看见你今天比昨天更自律。自律不是一天练成的，但你正在一步一步靠近。", "medal", 500, "父子约定星"),
      item("完成父子成长约定", "父子约定星", "爸爸看见你完成了我们的成长约定。守住承诺，是父子之间最珍贵的信任。", "medal", 500, "父子约定星"),
    ],
  },
};

export function getFatherCategoryKeys() {
  return Object.keys(FATHER_REWARD_SCENARIOS);
}

export function findFatherItem(category, label) {
  const cat = FATHER_REWARD_SCENARIOS[category];
  if (!cat) return null;
  return cat.items.find((i) => i.label === label) || null;
}

export function findFatherCategoryByLabel(label) {
  for (const [key, cat] of Object.entries(FATHER_REWARD_SCENARIOS)) {
    if (cat.items.some((i) => i.label === label)) return key;
  }
  return "learning";
}

export function getFatherToolDefaults(tool) {
  return { ...(FATHER_TOOL_DEFAULTS[tool] || FATHER_TOOL_DEFAULTS.card) };
}

export function buildFatherRewardDraft(category, subcategoryLabel, customNote = "", toolOverride = "") {
  const found = findFatherItem(category, subcategoryLabel);
  const base = found || {
    label: subcategoryLabel || "自定义场景",
    title: "爸爸想对你说",
    content: "爸爸想正式记录下今天值得被看见的努力。",
    tool: "card",
    points: 500,
    medalType: "",
  };
  const tool = toolOverride || base.tool || "card";
  let content = base.content;
  if (customNote?.trim()) content = `${content}\n\n${customNote.trim()}`;
  return {
    category,
    scenario: base.label,
    title: base.title,
    content,
    points: base.points,
    tool,
    medalType: base.medalType || "",
    customNote: customNote || "",
  };
}

export function buildFatherFromSpecialPerformance(sp) {
  if (!sp?.hasPerformance || sp.hasPerformance === "no") return null;
  const sub = sp.subcategory || "";
  const useCat = sub ? findFatherCategoryByLabel(sub) : (SP_CATEGORY_MAP[sp.category] || "learning");
  const matched = sub ? findFatherItem(useCat, sub) : null;
  if (matched) {
    const draft = buildFatherRewardDraft(useCat, sub, sp.customDescription || "");
    if (sp.suggestedPoints) draft.points = sp.suggestedPoints;
    return draft;
  }
  return {
    category: useCat,
    scenario: sub || sp.category || "特别表现",
    title: "爸爸看见你的特别表现",
    content: formatSpecialPerformanceSummary(sp),
    points: sp.suggestedPoints || 500,
    tool: "praise-letter",
    medalType: "",
    fromSpecialPerformance: true,
  };
}