import { patchState, loadState, uid, nowIso, formatDateKey } from "./storage.js";
import { getCurrentUser } from "./auth.js";

export function sendHeartNotification({
  toUserId, fromRole, fromName,
  cardTitle, cardText, cardStyle, rewardType,
  rewardName, rewardCondition, rewardFulfilled,
}) {
  const roleLabel = fromRole === "father" ? "爸爸" : "妈妈";
  let note;
  patchState((s) => {
    note = {
      notificationId: uid(),
      userId: toUserId,
      type: "heart",
      fromRole,
      fromName,
      message: `你收到${roleLabel}的爱心了 💛`,
      cardTitle: cardTitle || "来自家人的鼓励",
      cardText: cardText || "",
      cardStyle: cardStyle || "阳光鼓励",
      rewardType: rewardType || "精神鼓励",
      rewardName: rewardName || "",
      rewardCondition: rewardCondition || "",
      rewardFulfilled: !!rewardFulfilled,
      reply: "",
      read: false,
      dateKey: formatDateKey(),
      createdAt: nowIso(),
    };
    s.notifications.unshift(note);
  });
  return note;
}

export function getNotifications(userId) {
  const uidTarget = userId || getCurrentUser()?.userId;
  if (!uidTarget) return [];
  return loadState().notifications.filter((n) => n.userId === uidTarget);
}

export function getUnreadCount(userId) {
  return getNotifications(userId).filter((n) => n.type === "heart" && !n.read).length;
}

export function markAllRead(userId) {
  const uidTarget = userId || getCurrentUser()?.userId;
  patchState((s) => {
    s.notifications.forEach((n) => { if (n.userId === uidTarget) n.read = true; });
  });
}

export function markRead(notificationId) {
  patchState((s) => {
    const n = s.notifications.find((x) => x.notificationId === notificationId);
    if (n) n.read = true;
  });
}

export function replyToNotification(notificationId, reply) {
  patchState((s) => {
    const n = s.notifications.find((x) => x.notificationId === notificationId);
    if (n) {
      n.reply = reply;
      n.read = true;
      n.repliedAt = nowIso();
    }
  });
}

export function getRecentHearts(userId, limit = 3) {
  return getNotifications(userId)
    .filter((n) => n.type === "heart")
    .slice(0, limit);
}