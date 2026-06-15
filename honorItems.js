/**
 * 荣誉物品 — 贺卡 / 表扬信 / 奖章等
 */
import { loadState, patchState, uid, formatDateKey, nowIso } from "./storage.js";

export function addHonorItem(data) {
  let created;
  patchState((s) => {
    if (!Array.isArray(s.honorItems)) s.honorItems = [];
    created = {
      honorItemId: uid(),
      dateKey: formatDateKey(),
      createdAt: nowIso(),
      ...data,
    };
    s.honorItems.unshift(created);
  });
  return created;
}

export function getHonorItems(familyId, opts = {}) {
  const fid = familyId || loadState().session?.familyId;
  let list = (loadState().honorItems || []).filter((h) => h.familyId === fid);
  if (opts.studentId) list = list.filter((h) => h.studentId === opts.studentId);
  if (opts.fromRole) list = list.filter((h) => h.fromRole === opts.fromRole);
  if (opts.dateKey) list = list.filter((h) => h.dateKey === opts.dateKey);
  if (opts.itemType) list = list.filter((h) => h.itemType === opts.itemType);
  const limit = opts.limit ?? list.length;
  return list.slice(0, limit);
}