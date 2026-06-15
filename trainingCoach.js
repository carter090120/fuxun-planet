import {
  uid, formatDateKey, saveTrainingSession, getMistakes, upsertMistakes, upsertPhotoMistakes,
  getTrainingSessions, loadState,
} from "./storage.js";
import { normalizeAnswerInput } from "./questionParser.js";

const ACTIVE_KEY = "fuxun-active-training";

function freshRound(session) {
  return {
    roundNumber: session.stats?.rounds || 1,
    poolSize: session.pool?.length || 0,
    answered: 0,
    correct: 0,
    wrong: 0,
    pendingQids: [...(session.pool || [])],
  };
}

export function createTrainingSession(mistakes, material) {
  const pool = mistakes.filter((m) => !m.isCorrect).map((m) => m.questionId);
  const session = {
    sessionId: uid(),
    familyId: material.familyId,
    studentId: material.studentId,
    materialId: material.materialId,
    dateKey: formatDateKey(),
    status: pool.length ? "active" : "completed",
    pool: [...pool],
    initialPoolSize: pool.length,
    stats: { answered: 0, correct: 0, streak: 0, maxStreak: 0, rounds: 1 },
    roundResults: [],
    currentRound: null,
    paused: false,
    showRoundEnd: false,
    startedAt: new Date().toISOString(),
    completedAt: pool.length ? null : new Date().toISOString(),
    history: [],
    reasonCounts: {},
    typeMissCounts: {},
  };
  if (pool.length) session.currentRound = freshRound(session);
  saveTrainingSession(session);
  setActiveSession(session);
  return session;
}

export function getActiveSession() {
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** 刷新后从 localStorage 恢复进行中的训练（sessionStorage 丢失时） */
export function restoreActiveSession(familyId, materialId) {
  const cached = getActiveSession();
  const fid = familyId || loadState().session?.familyId;
  if (cached?.familyId === fid && (!materialId || cached.materialId === materialId)) {
    if (cached.status === "completed" || !cached.pool?.length) return null;
    return cached;
  }
  const dk = formatDateKey();
  const saved = getTrainingSessions(fid)
    .filter((t) => t.dateKey === dk && (!materialId || t.materialId === materialId))
    .find((t) => (t.status === "active" || t.status === "paused_exit") && t.pool?.length);
  if (saved) {
    setActiveSession(saved);
    return saved;
  }
  return null;
}

export function getOrResumeTrainingSession(mistakes, material) {
  const restored = restoreActiveSession(material.familyId, material.materialId);
  if (restored) return restored;
  const wrong = mistakes.filter((m) => !m.isCorrect);
  if (!wrong.length) return null;
  return createTrainingSession(wrong, material);
}

export function setActiveSession(session) {
  if (session) sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(ACTIVE_KEY);
}

export function getCurrentQuestion(session, mistakes, material) {
  if (!session?.pool?.length) return null;
  const qid = session.pool[0];
  const mistake = mistakes.find((m) => m.questionId === qid);
  const question = material?.questions?.find((q) => q.questionId === qid);
  return { mistake, question, qid };
}

export function gradeTrainingAnswer(question, mistake, answer) {
  const norm = normalizeAnswerInput(answer, question?.options);
  const src = mistake?.answerSource || question?.answerSource;
  const rawKey = mistake?.correctAnswer || question?.answerKey || question?.answer || "";
  if (!rawKey || src === "ai_reference") return false;
  const key = String(rawKey).toUpperCase();
  if (key.length === 1) return norm.toUpperCase() === key;
  return norm.toLowerCase() === String(rawKey).trim().toLowerCase();
}

export function submitTrainingAnswer(session, qid, answer, isCorrect, mistake) {
  const next = { ...session, stats: { ...session.stats, answered: session.stats.answered + 1 } };
  next.history.push({ qid, answer, isCorrect, at: Date.now(), round: next.stats.rounds });

  if (!next.currentRound) next.currentRound = freshRound(next);
  next.currentRound.answered += 1;
  if (isCorrect) next.currentRound.correct += 1;
  else next.currentRound.wrong += 1;
  next.currentRound.pendingQids = next.currentRound.pendingQids.filter((id) => id !== qid);

  if (isCorrect) {
    next.stats.correct += 1;
    next.stats.streak += 1;
    next.stats.maxStreak = Math.max(next.stats.maxStreak, next.stats.streak);
    next.pool = next.pool.filter((id) => id !== qid);
    const cleared = getMistakes(session.familyId).filter((m) => m.questionId === qid && m.materialId === session.materialId);
    if (cleared.length) {
      upsertMistakes(cleared.map((m) => ({ ...m, isCorrect: true })));
      upsertPhotoMistakes(cleared.map((m) => ({ ...m, isCorrect: true, needManualConfirm: false })));
    }
  } else {
    next.stats.streak = 0;
    next.pool = [...next.pool.filter((id) => id !== qid), qid];
    if (mistake?.mistakeReason) {
      next.reasonCounts = { ...next.reasonCounts, [mistake.mistakeReason]: (next.reasonCounts[mistake.mistakeReason] || 0) + 1 };
    }
    if (mistake?.questionType) {
      next.typeMissCounts = { ...next.typeMissCounts, [mistake.questionType]: (next.typeMissCounts[mistake.questionType] || 0) + 1 };
    }
  }

  next.showRoundEnd = false;

  if (!next.pool.length) {
    next.status = "completed";
    next.completedAt = new Date().toISOString();
    next.currentRound = null;
  } else if (next.currentRound.pendingQids.length === 0) {
    next.roundResults = [...(next.roundResults || []), { ...next.currentRound }];
    next.showRoundEnd = true;
    next.stats.rounds += 1;
    next.currentRound = freshRound(next);
  }

  saveTrainingSession(next);
  setActiveSession(next.status === "active" ? next : null);
  return next;
}

export function dismissRoundEnd(session) {
  const next = { ...session, showRoundEnd: false };
  saveTrainingSession(next);
  setActiveSession(next);
  return next;
}

export function pauseTraining(session) {
  const next = { ...session, paused: true };
  saveTrainingSession(next);
  setActiveSession(next);
  return next;
}

export function resumeTraining(session) {
  const next = { ...session, paused: false };
  saveTrainingSession(next);
  setActiveSession(next);
  return next;
}

export function exitTraining(session) {
  const next = { ...session, status: "active", paused: true };
  saveTrainingSession(next);
  setActiveSession(next);
  return next;
}

export function trainingProgress(session) {
  const remaining = session?.pool?.length || 0;
  const total = session?.initialPoolSize || 0;
  const done = total - remaining;
  const accuracy = session?.stats?.answered
    ? Math.round((session.stats.correct / session.stats.answered) * 100)
    : 0;
  const round = session?.currentRound;
  const roundProgress = round?.poolSize
    ? Math.round((round.answered / round.poolSize) * 100)
    : 0;
  return {
    remaining, total, done, accuracy,
    streak: session?.stats?.streak || 0,
    rounds: session?.stats?.rounds || 1,
    roundAnswered: round?.answered || 0,
    roundTotal: round?.poolSize || remaining,
    roundProgress,
  };
}

export function getTrainingEndStats(session, mistakes = []) {
  const wrong = mistakes.filter((m) => !m.isCorrect);
  const answered = session?.stats?.answered || 0;
  const correct = session?.stats?.correct || 0;
  const wrongCount = answered - correct;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  const reasons = Object.entries(session?.reasonCounts || {})
    .sort((a, b) => b[1] - a[1]);
  const types = Object.entries(session?.typeMissCounts || {})
    .sort((a, b) => b[1] - a[1]);

  const topReason = reasons[0]?.[0] || "—";
  const weakType = types[0]?.[0] || (wrong[0]?.questionType) || "—";

  let tomorrowTip = "明天先复习今日高频错因，再练 3 道同类型题。";
  if (topReason.includes("词汇") || topReason.includes("单词")) {
    tomorrowTip = "明天先过一遍今日错题词汇，再练 2 道 Vocabulary 题。";
  } else if (weakType.includes("Evidence")) {
    tomorrowTip = "明天练习「回原文找证据」，每题标出支持句。";
  }

  return {
    totalQuestions: answered,
    correctCount: correct,
    wrongCount,
    accuracy,
    rounds: session?.stats?.rounds || 1,
    maxStreak: session?.stats?.maxStreak || 0,
    topReason,
    weakType,
    zeroMistakes: session?.status === "completed" && !wrong.length,
    tomorrowTip,
    roundResults: session?.roundResults || [],
  };
}