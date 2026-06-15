/**
 * 今日特别表现 — 字段定义与建议积分
 */

export const SPECIAL_HAS_OPTIONS = [
  { value: "yes", label: "有" },
  { value: "no", label: "没有" },
  { value: "unsure", label: "我不确定，想让爸爸妈妈看看" },
];

export const SPECIAL_CATEGORIES = {
  "学习场景": [
    "为一道错题坚持很久",
    "主动复训错题",
    "主动整理笔记",
    "主动背词汇",
    "主动阅读",
    "主动问问题",
    "主动完成计划外学习",
    "主动复盘今天的问题",
    "主动减少手机干扰",
  ],
  "生活场景": [
    "主动整理房间",
    "主动做家务",
    "主动运动",
    "主动早睡早起",
    "主动关心家人",
    "主动解决冲突",
    "主动表达感谢",
  ],
  "情绪管理": [
    "控制住了情绪",
    "压力大但坚持完成",
    "遇到挫折没有放弃",
    "主动沟通自己的感受",
  ],
  "自我管理": [
    "按时完成计划",
    "主动管理时间",
    "主动设定小目标",
    "主动记录成长",
  ],
  "家庭责任": [
    "主动陪伴家人",
    "主动分担家务",
    "主动照顾弟妹",
  ],
  "运动健康": [
    "坚持运动",
    "健康饮食选择",
    "主动休息恢复",
  ],
  "其它自定义": [],
};

export const SPECIAL_LEVELS = [
  { id: "small", label: "小进步", points: 50 },
  { id: "noticeable", label: "明显进步", points: 100 },
  { id: "breakthrough", label: "坚持突破", points: 200 },
  { id: "self_driven", label: "自驱表现", points: 300 },
  { id: "highlight", label: "高光时刻", points: 500 },
];

export function getSuggestedPoints(levelLabel) {
  const lv = SPECIAL_LEVELS.find((l) => l.label === levelLabel);
  return lv?.points ?? 0;
}

export function normalizeSpecialPerformance(raw) {
  if (!raw || typeof raw !== "object") return null;
  const hasPerformance = raw.hasPerformance || "";
  if (!hasPerformance || hasPerformance === "no") {
    return hasPerformance === "no"
      ? { hasPerformance: "no", category: "", subcategory: "", customDescription: "", selfRating: "", suggestedPoints: 0 }
      : null;
  }
  const selfRating = raw.selfRating || "";
  return {
    hasPerformance,
    category: raw.category || "",
    subcategory: raw.subcategory || "",
    customDescription: String(raw.customDescription || "").trim(),
    selfRating,
    suggestedPoints: raw.suggestedPoints ?? getSuggestedPoints(selfRating),
    confirmedReward: raw.confirmedReward || null,
  };
}

export function formatSpecialPerformanceSummary(sp) {
  const n = normalizeSpecialPerformance(sp);
  if (!n) return "今日未填写特别表现。";
  if (n.hasPerformance === "no") return "孩子填写：今天没有特别表现。";
  if (n.hasPerformance === "unsure") {
    return `孩子想让爸爸妈妈看看：${n.category || "未选大类"}${n.subcategory ? ` · ${n.subcategory}` : ""}${n.customDescription ? ` — ${n.customDescription}` : ""}`;
  }
  const pts = n.suggestedPoints ? `（建议 +${n.suggestedPoints} 分）` : "";
  return `${n.category}${n.subcategory ? ` · ${n.subcategory}` : ""}${n.selfRating ? ` · ${n.selfRating}` : ""}${pts}${n.customDescription ? `\n${n.customDescription}` : ""}`;
}

export function specialPerformanceHTML(draft = {}) {
  const sp = draft.specialPerformance || {};
  const has = sp.hasPerformance || "";
  const cat = sp.category || "学习场景";
  const subs = SPECIAL_CATEGORIES[cat] || [];
  const catOpts = Object.keys(SPECIAL_CATEGORIES).map((c) =>
    `<option value="${c}" ${cat === c ? "selected" : ""}>${c}</option>`
  ).join("");
  const subOpts = subs.map((s) =>
    `<option value="${s}" ${sp.subcategory === s ? "selected" : ""}>${s}</option>`
  ).join("");
  const levelOpts = SPECIAL_LEVELS.map((l) =>
    `<option value="${l.label}" data-pts="${l.points}" ${sp.selfRating === l.label ? "selected" : ""}>${l.label}（建议 +${l.points}）</option>`
  ).join("");
  const hasOpts = SPECIAL_HAS_OPTIONS.map((o) =>
    `<label class="toggle"><input type="radio" name="spHas" value="${o.value}" ${has === o.value ? "checked" : ""} /><span>${o.label}</span></label>`
  ).join("");

  return `<section class="card-block special-perf">
    <h3>✨ 今日特别表现</h3>
    <p class="hint">记录今天值得被看见的瞬间。系统只给建议积分，最终由爸爸妈妈确认后发放。</p>
    <div class="field"><span>今天有没有特别表现</span><div class="radio-row">${hasOpts}</div></div>
    <div id="sp-fields" class="${has === "yes" || has === "unsure" ? "" : "hidden"}">
      <label class="field"><span>特别表现大类</span>
        <select name="spCategory" id="sp-cat">${catOpts}</select></label>
      <label class="field"><span>特别表现小类</span>
        <select name="spSub" id="sp-sub">${subOpts || "<option value=\"\">—</option>"}</select></label>
      <label class="field"><span>自定义描述</span>
        <textarea name="spDesc" rows="2" placeholder="把今天那个值得被看见的瞬间写下来。">${sp.customDescription || ""}</textarea></label>
      <label class="field"><span>孩子自评等级</span>
        <select name="spLevel" id="sp-level"><option value="">请选择</option>${levelOpts}</select></label>
      <p class="hint" id="sp-suggest">建议积分：<strong>${sp.suggestedPoints || "—"}</strong>（需父母确认）</p>
    </div>
  </section>`;
}

export function readSpecialPerformanceFromForm(form) {
  if (!form) return null;
  const fd = new FormData(form);
  const hasPerformance = fd.get("spHas") || "";
  if (!hasPerformance) return null;
  const selfRating = fd.get("spLevel") || "";
  return normalizeSpecialPerformance({
    hasPerformance,
    category: fd.get("spCategory") || "",
    subcategory: fd.get("spSub") || "",
    customDescription: fd.get("spDesc") || "",
    selfRating,
    suggestedPoints: getSuggestedPoints(selfRating),
  });
}