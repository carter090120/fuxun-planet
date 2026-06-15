/**
 * AI 参考答案 — 题库缺少标准答案时的辅助判分（需确认后才计入成绩）
 */
import { patchMaterialQuestion, upsertMistakes, getMistakes, nowIso } from "./storage.js";

export const AI_REF_SOURCE = "ai_reference";
export const AI_CONFIRMED_SOURCE = "ai_confirmed";

export function hasStandardAnswer(entity) {
  if (!entity) return false;
  const key = entity.correctAnswer || entity.answerKey || entity.answer;
  if (!key) return false;
  if (entity.answerSource === AI_REF_SOURCE && entity.aiReference?.needsConfirmation !== false) return false;
  return true;
}

export function getConfirmedAnswerKey(question, mistake) {
  const src = mistake?.answerSource || question?.answerSource;
  const key = mistake?.correctAnswer || question?.answerKey || question?.answer || "";
  if (!key) return "";
  if (src === AI_REF_SOURCE) return "";
  return String(key).toUpperCase();
}

export function canGenerateAiReference(question, childAnswer) {
  if (!question) return false;
  if (hasStandardAnswer(question)) return false;
  if (!childAnswer) return false;
  const stem = String(question.stem || "").trim();
  const opts = question.options?.filter((o) => o?.text || o?.key) || [];
  return stem.length > 8 && opts.length >= 2;
}

export function getConfidenceTier(confidence) {
  const c = Number(confidence) || 0;
  if (c >= 0.85) return { id: "high", label: "AI 高置信参考答案", canTempRetrain: true };
  if (c >= 0.6) return { id: "medium", label: "AI 参考答案，需要确认", canTempRetrain: false };
  return { id: "low", label: "AI 暂无法可靠判断，请手动选择标准答案", canTempRetrain: false };
}

function scoreOption(stem, opt, idx) {
  const text = String(opt.text || "").toLowerCase();
  const stemL = stem.toLowerCase();
  let score = 0.12 + idx * 0.02;
  if (/not|never|except|least|without|fail|incorrect|wrong/.test(text)) score += 0.08;
  if (/always|best|most|primary|main|because|therefore|thus/.test(text)) score += 0.1;
  if (stemL.includes(text.slice(0, Math.min(12, text.length)))) score += 0.15;
  if (/evidence|support|suggest|indicate|imply/.test(stemL) && /support|evidence|consistent/.test(text)) score += 0.12;
  if (questionTypeBoost(stemL, text)) score += 0.14;
  return score;
}

function questionTypeBoost(stem, text) {
  if (/function|purpose|structure/.test(stem) && /introduce|contrast|emphasize|illustrate/.test(text)) return true;
  if (/vocab|word|meaning/.test(stem) && text.length < 28) return true;
  return false;
}

function buildExplanation(stem, opt, confidence) {
  const tier = getConfidenceTier(confidence);
  const snippet = String(opt.text || "").slice(0, 48);
  if (tier.id === "low") {
    return "题干与选项信息不足以可靠推断，建议由家长或孩子手动确认标准答案。";
  }
  return `结合题干关键词与选项语义，${opt.key}「${snippet}${snippet.length >= 48 ? "…" : ""}」与题意匹配度较高。`;
}

function buildEvidence(stem, opt) {
  const words = String(stem).split(/\s+/).filter((w) => w.length > 4).slice(0, 3);
  return words.length
    ? `题干线索：${words.join("、")}；选项 ${opt.key} 语义呼应。`
    : `选项 ${opt.key} 与题干整体语义更一致。`;
}

/** 本地启发式生成 AI 参考答案（无云端 API 时的 MVP 实现） */
export function generateAiReferenceAnswer(question) {
  const stem = String(question.stem || "").trim();
  const opts = (question.options || []).slice(0, 4).filter((o) => o?.key);
  if (!stem || opts.length < 2) {
    return {
      ok: false,
      suggestedAnswer: "",
      confidence: 0.35,
      explanation: "题目信息不完整，无法生成可靠参考答案。",
      evidence: "",
      needsConfirmation: true,
      source: AI_REF_SOURCE,
    };
  }

  const scored = opts.map((o, i) => ({ o, score: scoreOption(stem, o, i) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1]?.score || 0;
  const gap = best.score - second;
  let confidence = Math.min(0.92, 0.55 + gap * 1.8 + best.score * 0.35);
  if (question.explanation) confidence = Math.min(0.9, confidence + 0.08);
  if (opts.length < 4) confidence -= 0.05;
  confidence = Math.round(confidence * 100) / 100;

  return {
    ok: confidence >= 0.6,
    suggestedAnswer: best.o.key,
    confidence,
    explanation: buildExplanation(stem, best.o, confidence),
    evidence: buildEvidence(stem, best.o),
    needsConfirmation: true,
    source: AI_REF_SOURCE,
    generatedAt: nowIso(),
  };
}

export function applyAiReferenceToQuestion(materialId, questionId, aiRef) {
  patchMaterialQuestion(materialId, questionId, {
    aiReference: { ...aiRef, needsConfirmation: true, source: AI_REF_SOURCE },
    answerSource: AI_REF_SOURCE,
  });
}

export function confirmAiReferenceAnswer(materialId, questionId, aiRef, userId) {
  const key = aiRef?.suggestedAnswer || "";
  patchMaterialQuestion(materialId, questionId, {
    answerKey: key,
    answer: key,
    answerSource: AI_CONFIRMED_SOURCE,
    confirmedBy: userId,
    confirmedAt: nowIso(),
    aiReference: { ...aiRef, needsConfirmation: false, confirmedAt: nowIso() },
  });
  const mistakes = getMistakes().filter((m) => m.materialId === materialId && m.questionId === questionId);
  if (mistakes.length) {
    upsertMistakes(mistakes.map((m) => ({
      ...m,
      correctAnswer: key,
      answerSource: AI_CONFIRMED_SOURCE,
      aiReference: { ...aiRef, needsConfirmation: false },
      pendingConfirmation: false,
    })));
  }
}

export function markQuestionPendingConfirmation(materialId, questionId, aiRef) {
  const mistakes = getMistakes().filter((m) => m.materialId === materialId && m.questionId === questionId);
  if (mistakes.length) {
    upsertMistakes(mistakes.map((m) => ({
      ...m,
      pendingConfirmation: true,
      aiReference: aiRef,
      answerSource: AI_REF_SOURCE,
    })));
  }
}

export function aiReferenceCardHTML(question, childAnswer, aiRef = null) {
  const qid = question.questionId;
  if (hasStandardAnswer(question)) return "";
  if (!childAnswer) {
    return `<div class="ai-ref-card ai-ref-card--warn" data-ai-ref="${qid}">
      <h4>本题缺少标准答案</h4>
      <p class="hint">可以使用 AI 生成参考答案，或手动选择标准答案。</p>
      <p class="hint">请先选择孩子答案后再生成 AI 参考答案。</p>
      <div class="ai-ref-actions">
        <button type="button" class="btn btn--ghost btn--sm" data-ai-dismiss="${qid}">暂不处理</button>
      </div>
    </div>`;
  }
  if (!aiRef) {
    return `<div class="ai-ref-card ai-ref-card--warn" data-ai-ref="${qid}">
      <h4>本题缺少标准答案</h4>
      <p class="hint">可以使用 AI 生成参考答案，或手动选择标准答案。</p>
      <div class="ai-ref-actions">
        <button type="button" class="btn btn--primary btn--sm" data-ai-gen="${qid}">AI 生成参考答案</button>
        <button type="button" class="btn btn--sun btn--sm" data-ai-manual="${qid}">手动选择标准答案</button>
        <button type="button" class="btn btn--ghost btn--sm" data-ai-dismiss="${qid}">暂不处理</button>
      </div>
      <div class="ai-ref-manual hidden" data-ai-manual-panel="${qid}">
        <div class="photo-abcd">${["A", "B", "C", "D"].map((k) =>
          `<button type="button" class="photo-abcd__btn" data-ai-pick="${k}" data-q="${qid}">${k}</button>`
        ).join("")}</div>
      </div>
    </div>`;
  }
  const tier = getConfidenceTier(aiRef.confidence);
  const pct = Math.round((aiRef.confidence || 0) * 100);
  const status = aiRef.needsConfirmation !== false ? "待爸爸妈妈或孩子确认" : "已确认";
  return `<div class="ai-ref-card ai-ref-card--result ${tier.id === "low" ? "ai-ref-card--low" : ""}" data-ai-ref="${qid}">
    <h4>${tier.label}</h4>
    <div class="compare-row"><span>AI 参考答案</span><strong>${aiRef.suggestedAnswer || "—"}</strong></div>
    <div class="compare-row"><span>置信度</span><strong>${pct}%</strong></div>
    <p class="hint">${aiRef.explanation || ""}</p>
    ${aiRef.evidence ? `<p class="hint ai-ref-evidence">依据：${aiRef.evidence}</p>` : ""}
    <p class="ai-ref-status">状态：${status}</p>
    ${tier.id !== "low" && aiRef.needsConfirmation !== false ? `<div class="ai-ref-actions">
      <button type="button" class="btn btn--primary btn--sm" data-ai-confirm="${qid}">确认采用此答案</button>
      <button type="button" class="btn btn--ghost btn--sm" data-ai-manual="${qid}">手动选择标准答案</button>
    </div>` : `<div class="ai-ref-actions">
      <button type="button" class="btn btn--sun btn--sm" data-ai-manual="${qid}">手动选择标准答案</button>
    </div>`}
    <div class="ai-ref-manual hidden" data-ai-manual-panel="${qid}">
      <div class="photo-abcd">${["A", "B", "C", "D"].map((k) =>
        `<button type="button" class="photo-abcd__btn" data-ai-pick="${k}" data-q="${qid}">${k}</button>`
      ).join("")}</div>
    </div>
  </div>`;
}