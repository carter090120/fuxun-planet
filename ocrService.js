/**
 * 复训星球 — OCR 服务（本地模拟 + 预留 AI）
 */

export const OCR_MODE = { LOCAL: "local", AI: "ai" };

const DEMO_OCR_TEMPLATE = `1. Which choice completes the text with the most logical and precise word?
A. innovative
B. predictable
C. controversial
D. superficial
答案：B
孩子答案：C

2. What is the main idea of the passage?
A. Technology always improves lives
B. Historical context shapes modern views
C. Authors rarely agree on facts
D. Science replaces philosophy
答案：B
孩子答案：B

3. Which finding would most directly support the researchers' claim?
A. A survey of 50 students
B. Data showing a consistent pattern ×
C. An unrelated anecdote
D. A quote from a novelist
答案：B
孩子答案：A`;

/** 压缩图片用于 localStorage 存储 */
export async function compressImage(file, maxWidth = 800, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxWidth / img.width);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL("image/jpeg", quality), width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 预留：未来接入真实 AI OCR */
export async function recognizeQuestionsWithAI(images) {
  void images;
  return {
    ok: false,
    mode: "ai",
    text: "",
    incomplete: true,
    message: "AI OCR 将在云端版启用，请使用本地识别或手动输入。",
  };
}

/** V1 本地/模拟 OCR */
export async function recognizeQuestionsFromImagesLocal(images) {
  await delay(600 + images.length * 250);
  const header = images.map((im, i) => `[图片${i + 1}: ${im.fileName || "photo"}]`).join("\n");
  const text = `${header}\n\n${DEMO_OCR_TEMPLATE}`;
  const markersDetected = detectMarkerHints(text).length > 0;
  return {
    ok: true,
    mode: "local",
    text,
    incomplete: true,
    markersDetected,
    message: "当前为模拟识别，可手动修改文本。正式版将接入 AI OCR。",
  };
}

/** 统一入口：默认识别走本地模拟 */
export async function recognizeQuestionsFromImages(images, mode = OCR_MODE.LOCAL) {
  if (mode === OCR_MODE.AI) return recognizeQuestionsWithAI(images);
  return recognizeQuestionsFromImagesLocal(images);
}

export function detectMarkerHints(text) {
  const hints = [];
  const t = String(text || "");
  if (/[×✗✕]/.test(t)) hints.push("叉号标记");
  if (/错|错误|圈选|红笔|打叉/i.test(t)) hints.push("错题标记");
  return hints;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}