/**
 * Sara 陪伴场景库 — 大类 / 小类 / 自动生成草稿
 */
import { formatSpecialPerformanceSummary } from "./specialPerformance.js";

export const MOTHER_TOOL_LABELS = {
  card: "鼓励卡",
  "praise-letter": "温暖表扬信",
  badge: "荣誉徽章",
  "family-reward": "亲子奖励",
  "tomorrow-goal": "明日小目标",
};

export const MOTHER_SUBMIT_LABELS = {
  card: "确认发放鼓励卡（扣 Sara 钱包）",
  "praise-letter": "确认发送表扬信（扣 Sara 钱包）",
  badge: "确认颁发荣誉徽章（扣 Sara 钱包）",
  "family-reward": "确认发放亲子奖励（扣 Sara 钱包）",
  "tomorrow-goal": "确认发送明日小目标",
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

const SP_RATING_MAP = {
  "小进步": { points: 300, tool: "card" },
  "明显进步": { points: 500, tool: "card" },
  "坚持突破": { points: 500, tool: "praise-letter" },
  "自驱表现": { points: 500, tool: "badge", badgeType: "温暖坚持星" },
  "高光时刻": { points: 800, tool: "praise-letter" },
};

function item(label, title, content, tool = "card", points = 500, badgeType = "") {
  return { label, title, content, tool, points, badgeType };
}

/** @type {Record<string, { label: string, icon: string, items: ReturnType<typeof item>[] }>} */
export const MOTHER_COMPANION_SCENARIOS = {
  emotion: {
    label: "情绪支持",
    icon: "💛",
    items: [
      item("压力大但坚持完成", "妈妈看见你的坚持", "妈妈看到你今天虽然有压力，但还是坚持完成了该做的事。这种不轻易放弃的状态，比一次分数更值得被看见。", "card", 500),
      item("遇到挫折没有放弃", "挫折里仍有光", "妈妈看到你在遇到挫折时没有立刻放弃。愿意再试一次，本身就是一种很珍贵的力量。", "card", 500),
      item("主动表达自己的感受", "谢谢你愿意说出来", "妈妈很高兴你今天愿意表达自己的感受。被听见，是成长里很重要的一步。", "card", 500),
      item("今天愿意沟通", "愿意沟通真好", "妈妈看到你今天愿意和家人沟通。愿意打开心门，关系就会更温暖。", "card", 500),
      item("情绪稳定了一次", "情绪稳定星", "妈妈注意到你今天在情绪波动时，成功稳住了一次自己。这是很重要的自我管理进步。", "badge", 500, "情绪稳定星"),
      item("没有把压力带给家人", "你在保护这个家", "妈妈看到你有压力时，仍努力把情绪照顾好，没有轻易把压力带给家人。这很成熟，也很温暖。", "card", 500),
    ],
  },
  plan: {
    label: "计划陪伴",
    icon: "📋",
    items: [
      item("明天计划清晰", "明天会更有方向", "妈妈看到你对明天已经有了比较清晰的计划。知道下一步怎么走，心里就会更踏实。", "tomorrow-goal", 100),
      item("主动安排学习顺序", "会安排，会成长", "妈妈看到你主动安排了学习顺序，这说明你正在学会管理自己的节奏。", "card", 300),
      item("提前准备学习资料", "准备充分值得赞", "妈妈看到你提前准备好了学习资料。准备充分，做事就会更从容。", "card", 300),
      item("主动复盘今天的问题", "复盘让明天更好", "妈妈看到你愿意复盘今天的问题。复盘不是批评，而是让明天走得更稳。", "card", 500),
      item("知道下一步怎么做", "方向感很棒", "妈妈看到你知道下一步该怎么做。有方向感，就不容易迷茫。", "card", 300),
      item("愿意接受提醒", "愿意听，愿意改", "妈妈看到你愿意接受提醒并做出调整。这种开放的态度，会让成长更快。", "card", 500),
    ],
  },
  warm: {
    label: "温暖成长",
    icon: "🌸",
    items: [
      item("今天有一个小进步", "小进步也值得庆祝", "妈妈看到你今天有一个小进步。成长不一定轰轰烈烈，一点点积累也很珍贵。", "card", 300),
      item("今天对自己更有耐心", "对自己温柔一点", "妈妈看到你今天对自己更有耐心了。学会善待自己，是长期成长的基础。", "card", 500),
      item("今天没有轻易放弃", "没有放弃真好", "妈妈看到你今天没有轻易放弃。坚持本身，就是值得被看见的品质。", "card", 500),
      item("今天愿意重新开始", "重新开始需要勇气", "妈妈看到你愿意重新开始。愿意再出发，比完美更重要。", "card", 500),
      item("今天比昨天更稳定", "稳定是一种力量", "妈妈看到你今天比昨天更稳定。稳定下来，才能走得更远。", "badge", 500, "温暖坚持星"),
      item("今天值得被抱抱", "今天值得被抱抱", "妈妈觉得你今天特别值得被抱抱。你的努力、耐心和坚持，妈妈都看见了。", "card", 500),
    ],
  },
  family: {
    label: "家庭关系",
    icon: "🏠",
    items: [
      item("主动感谢家人", "谢谢你的感谢", "妈妈听到你主动表达感谢，心里很暖。懂得感恩的孩子，会让家更有温度。", "card", 500),
      item("主动帮妈妈做事", "谢谢你的温暖行动", "妈妈看到你今天主动帮家里分担，这说明你正在长成一个有责任感、懂得关心家人的孩子。", "badge", 500, "感恩表达星"),
      item("主动和妈妈好好说话", "好好说话很重要", "妈妈看到你今天愿意好好说话、耐心沟通。这会让我们彼此更靠近。", "card", 500),
      item("主动整理房间", "家因你而整洁", "妈妈看到你主动整理房间。照顾好自己的空间，也是在照顾自己的生活状态。", "card", 300),
      item("主动承担家庭责任", "家庭责任星", "妈妈看到你主动承担家庭责任。这说明你正在长成一个可靠、有担当的人。", "badge", 500, "亲子陪伴星"),
      item("和家人发生分歧后愿意沟通", "愿意沟通化解分歧", "妈妈看到你在分歧之后仍愿意沟通。这比争赢更重要，也更成熟。", "card", 500),
    ],
  },
  learning: {
    label: "学习陪伴",
    icon: "📚",
    items: [
      item("为一道错题坚持很久", "这一次坚持很珍贵", "妈妈看到你为了弄懂一道错题坚持了很久。真正的成长，不只是做对题，而是愿意把不会的地方弄明白。", "praise-letter", 500),
      item("主动完成复训", "主动复训真棒", "妈妈看到你主动完成复训。愿意面对错题，比逃避更值得骄傲。", "card", 500),
      item("主动整理错题", "整理错题是好习惯", "妈妈看到你主动整理错题。把问题收好、理清，下次就会更有把握。", "card", 500),
      item("主动阅读", "阅读让心更开阔", "妈妈看到你主动阅读。阅读不只是学习，也是在扩展你的世界。", "card", 300),
      item("主动背词汇", "词汇积累见坚持", "妈妈看到你主动背词汇。每天一点点，积累起来会很可观。", "card", 300),
      item("主动问问题", "敢问问题很棒", "妈妈看到你主动问问题。敢问、敢学，是真正会学习的表现。", "card", 500),
      item("复训后还愿意继续练", "愿意继续练很棒", "妈妈看到你在复训之后还愿意继续练习。这种不肯轻易停下的劲头，很值得被肯定。", "praise-letter", 500),
    ],
  },
  life: {
    label: "生活自理",
    icon: "🌿",
    items: [
      item("主动早睡早起", "作息规律真好", "妈妈看到你主动早睡早起。照顾好身体，学习和生活都会更有精力。", "card", 300),
      item("主动运动", "运动让人更有劲", "妈妈看到你主动运动。身体有劲，心情和状态也会更好。", "card", 300),
      item("主动控制手机", "自控力在长大", "妈妈看到你主动控制手机使用。能管理诱惑，是很了不起的自控力。", "badge", 500, "自我照顾星"),
      item("主动整理书桌", "书桌整洁心情好", "妈妈看到你主动整理书桌。环境整洁，注意力也会更集中。", "card", 300),
      item("主动安排时间", "时间管理进步", "妈妈看到你主动安排时间。会安排时间，就更容易把想做的事做完。", "card", 300),
      item("主动照顾自己的状态", "懂得照顾自己", "妈妈看到你主动照顾自己的状态。懂得照顾自己，才能持续成长。", "card", 500),
    ],
  },
  custom: {
    label: "自定义场景",
    icon: "✏️",
    items: [
      item("自定义场景", "妈妈想对你说", "妈妈想记录下今天一个值得被温柔看见的瞬间。你可以在下文补充具体细节。", "card", 500),
    ],
  },
};

export function getCompanionCategoryKeys() {
  return Object.keys(MOTHER_COMPANION_SCENARIOS);
}

export function getCompanionItemLabels(category) {
  return (MOTHER_COMPANION_SCENARIOS[category]?.items || []).map((i) => i.label);
}

export function findCompanionItem(category, label) {
  const cat = MOTHER_COMPANION_SCENARIOS[category];
  if (!cat) return null;
  return cat.items.find((i) => i.label === label) || null;
}

export function findScenarioCategoryByLabel(label) {
  for (const [key, cat] of Object.entries(MOTHER_COMPANION_SCENARIOS)) {
    if (cat.items.some((i) => i.label === label)) return key;
  }
  return "warm";
}

export function buildCompanionRewardDraft(category, subcategoryLabel, customNote = "", toolOverride = "") {
  const found = findCompanionItem(category, subcategoryLabel);
  const base = found || {
    label: subcategoryLabel || "自定义场景",
    title: "妈妈想对你说",
    content: "妈妈想温柔地记录下今天值得被看见的努力。",
    tool: "card",
    points: 500,
    badgeType: "",
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
    badgeType: base.badgeType || "",
    familyRewardType: tool === "family-reward" ? "一起聊天 20 分钟" : "",
  };
}

export function buildCompanionFromSpecialPerformance(sp) {
  if (!sp?.hasPerformance || sp.hasPerformance === "no") return null;
  const category = SP_CATEGORY_MAP[sp.category] || "warm";
  const sub = sp.subcategory || "";
  const rating = SP_RATING_MAP[sp.selfRating] || { points: sp.suggestedPoints || 500, tool: "card" };
  const matched = sub ? findCompanionItem(category, sub) : null;
  if (matched) {
    const draft = buildCompanionRewardDraft(category, sub, sp.customDescription || "");
    if (sp.suggestedPoints) draft.points = sp.suggestedPoints;
    return draft;
  }
  return {
    category,
    scenario: sub || sp.category || "特别表现",
    title: "妈妈看见你的特别表现",
    content: formatSpecialPerformanceSummary(sp),
    points: sp.suggestedPoints || rating.points,
    tool: rating.tool,
    badgeType: rating.badgeType || "",
    familyRewardType: "",
    fromSpecialPerformance: true,
  };
}