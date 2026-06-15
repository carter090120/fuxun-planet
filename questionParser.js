import { uid, MISTAKE_REASONS, formatDateKey } from "./storage.js";
import { detectMarkerHints } from "./ocrService.js";

export const SAT_TYPES = [
  { id: "vocabulary", label: "Vocabulary", keys: [/logical and precise word/i, /most nearly mean/i, /as used in the text/i] },
  { id: "function", label: "Function / Structure", keys: [/purpose of the underlined/i, /function of the underlined/i, /overall structure/i, /underlined sentence/i] },
  { id: "dual", label: "Dual Text", keys: [/text 1/i, /text 2/i, /both texts/i, /authors of both/i] },
  { id: "evidence", label: "Evidence", keys: [/which choice provides the best evidence/i, /graph/i, /table/i, /supports the answer/i] },
  { id: "main", label: "Main Idea", keys: [/main idea/i, /central idea/i, /main purpose/i, /primarily serves to/i] },
  { id: "inference", label: "Inference", keys: [/infer/i, /imply/i, /suggest/i, /most likely/i, /it can reasonably be concluded/i] },
];

export function detectSatType(stem) {
  const text = String(stem || "");
  for (const t of SAT_TYPES) {
    if (t.keys.some((re) => re.test(text))) return t.label;
  }
  return "SAT Reading";
}

export const MISTAKE_REASON_BY_TYPE = {
  Vocabulary: ["单词不认识", "上下文逻辑没抓住", "转折关系没抓住", "选项近义词混淆", "语气色彩判断错误"],
  "Function / Structure": ["没看懂句子作用", "没分清例子和观点", "没抓住段落结构", "被干扰选项误导"],
  "Dual Text": ["Text 1 没读懂", "Text 2 没读懂", "两文关系判断错误", "作者态度判断错误"],
  Evidence: ["没找到关键证据", "数据表理解错误", "证据和结论没对应", "选项支持力度判断错"],
  Inference: ["推理过度", "没抓住原文暗示", "把细节当结论", "被相似选项干扰"],
  "Main Idea": ["没抓住主旨", "把细节当结论", "被干扰选项误导", "段落结构没理清"],
  "SAT Reading": MISTAKE_REASONS,
};

export function getMistakeReasonOptions(type) {
  return MISTAKE_REASON_BY_TYPE[type] || MISTAKE_REASONS;
}

export function suggestMistakeReason(type, isCorrect) {
  if (isCorrect) return "";
  const opts = getMistakeReasonOptions(type);
  return opts[0] || MISTAKE_REASONS[0];
}

/**
 * Parse TXT / pasted teacher material into question cards.
 */
export function parseQuestionBank(text, meta = {}) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions = [];
  let cur = null;

  const flush = () => {
    if (!cur?.stem) return;
    cur.questionId = uid();
    cur.type = detectSatType(cur.stem);
    cur.explanation = cur.explanation || `本题属于 ${cur.type}，请回到原文定位关键句。`;
    questions.push(cur);
    cur = null;
  };

  for (const line of lines) {
    const num = line.match(/^(\d+)[.、)\]]\s*(.+)/);
    const opt = line.match(/^([A-Da-d])[.、)\]]\s*(.+)/);
    const ans = line.match(/^(?:答案|Answer|正确答案|Key)[：:]\s*(.+)/i);
    const child = line.match(/^(?:孩子答案|我的答案|学生答案|Child(?:'s)?\s*Answer)[：:]\s*(.+)/i);
    const exp = line.match(/^(?:解析|Explanation)[：:]\s*(.+)/i);

    if (num) { flush(); cur = { number: Number(num[1]), stem: num[2], options: [], answer: "", answerKey: "", studentAnswer: "", explanation: "", hasMarker: false }; }
    else if (opt && cur) cur.options.push({ key: opt[1].toUpperCase(), text: opt[2] });
    else if (ans && cur) {
      const a = ans[1].trim();
      if (/^[A-D]$/i.test(a)) {
        cur.answerKey = a.toUpperCase();
        const idx = a.toUpperCase().charCodeAt(0) - 65;
        cur.answer = cur.options[idx]?.text || a;
      } else cur.answer = a;
    } else if (child && cur) {
      const raw = child[1].trim().replace(/[×✗✕]\s*$/, "").trim();
      cur.studentAnswer = raw;
      if (/[×✗✕]|错/.test(child[1])) cur.hasMarker = true;
    } else if (exp && cur) cur.explanation = exp[1];
    else if (cur) {
      if (/[×✗✕]/.test(line)) cur.hasMarker = true;
      cur.stem += ` ${line}`;
    }
    else { flush(); cur = { number: questions.length + 1, stem: line, options: [], answer: "", answerKey: "", studentAnswer: "", explanation: "", hasMarker: /[×✗✕]|错/.test(line) }; }
  }
  flush();

  return {
    title: meta.title || "今日课后资料",
    subject: meta.subject || "SAT Reading",
    sourceNote: meta.sourceNote || "",
    questions,
  };
}

/** Reserved for Word — Phase 2 */
export async function parseDocxQuestionBank(file) {
  return {
    ok: false,
    message: "Word 解析将在云端版启用。请先将题库资料另存为 TXT 导入，或使用拍图导入。",
    questions: [],
  };
}

function gradeChildAnswer(q, childRaw) {
  const child = normalizeAnswerInput(childRaw, q.options);
  const key = (q.answerKey || "").toUpperCase();
  const correct = key
    ? child.toUpperCase() === key
    : child.trim().toLowerCase() === String(q.answer).trim().toLowerCase();
  return { child, correct };
}

export function buildMistakesFromAnswers(material, childAnswers) {
  return material.questions.map((q) => {
    const raw = childAnswers[q.questionId] ?? q.studentAnswer ?? "";
    const { child, correct } = gradeChildAnswer(q, raw);
    const type = q.type || detectSatType(q.stem);
    return {
      mistakeId: uid(),
      materialId: material.materialId,
      questionId: q.questionId,
      number: q.number,
      questionType: type,
      stem: q.stem,
      options: q.options,
      correctAnswer: q.answerKey || q.answer,
      studentAnswer: child,
      isCorrect: correct,
      mistakeReason: suggestMistakeReason(type, correct),
      explanation: q.explanation,
      dateKey: formatDateKey(),
    };
  });
}

/** 拍图导入专用错题记录（含 imageId / needManualConfirm） */
export function buildPhotoMistakes(material, childAnswers, opts = {}) {
  const { imageId, familyId, studentId } = opts;
  const globalMarkers = detectMarkerHints(material.ocrText || "");
  const defaultImageId = imageId || material.images?.[0]?.imageId || null;

  return material.questions.map((q) => {
    const raw = childAnswers[q.questionId] ?? q.studentAnswer ?? "";
    const { child, correct } = gradeChildAnswer(q, raw);
    const type = q.type || detectSatType(q.stem);
    const hasMarker = q.hasMarker || /[×✗✕]|错/.test(`${q.stem} ${raw}`);
    const needManualConfirm = !child || hasMarker || globalMarkers.length > 0;

    return {
      mistakeId: uid(),
      familyId,
      studentId,
      materialId: material.materialId,
      imageId: defaultImageId,
      questionId: q.questionId,
      number: q.number,
      questionType: type,
      stem: q.stem,
      options: q.options,
      correctAnswer: q.answerKey || q.answer,
      studentAnswer: child,
      isCorrect: correct && !hasMarker,
      mistakeReason: suggestMistakeReason(type, correct && !hasMarker),
      explanation: q.explanation,
      needManualConfirm,
      markerHint: hasMarker ? "可能为错题，请人工确认" : "",
      dateKey: formatDateKey(),
    };
  });
}

export function photoImportStats(mistakes) {
  const total = mistakes.length;
  const answered = mistakes.filter((m) => m.studentAnswer).length;
  const wrong = mistakes.filter((m) => !m.isCorrect).length;
  const pending = mistakes.filter((m) => m.needManualConfirm || !m.studentAnswer).length;
  return { total, answered, wrong, pending };
}

export function normalizeAnswerInput(input, options) {
  const v = String(input || "").trim();
  if (/^[A-Da-d]$/.test(v)) return v.toUpperCase();
  const idx = options?.findIndex((o) => o.text?.toLowerCase() === v.toLowerCase());
  if (idx >= 0) return String.fromCharCode(65 + idx);
  return v;
}