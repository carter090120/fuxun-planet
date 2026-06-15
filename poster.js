import { formatScore } from "./storage.js";

const W = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh, maxLines = 3) {
  const safe = String(text || "—").slice(0, 240);
  let line = "";
  let lines = 0;
  let cy = y;
  for (const ch of safe) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = ch;
      cy += lh;
      lines += 1;
      if (lines >= maxLines - 1) {
        ctx.fillText(`${line}…`, x, cy);
        return cy + lh;
      }
    } else line = test;
  }
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lh;
  }
  return cy;
}

function resolveBadgeEmoji(family) {
  if (!family) return "🪐";
  return family.badge || family.badgeValue || "🪐";
}

export async function generatePoster(record, privacy, family) {
  const H = 1320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#93c5fd");
  bg.addColorStop(0.4, "#dbeafe");
  bg.addColorStop(1, "#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const badgeEmoji = resolveBadgeEmoji(family);
  ctx.font = "48px sans-serif";
  ctx.fillText(badgeEmoji, 72, 88);
  ctx.fillStyle = "#17324d";
  ctx.font = "bold 44px 'Microsoft YaHei', sans-serif";
  ctx.fillText("复训星球", 140, 88);
  ctx.fillStyle = "#5b6f86";
  ctx.font = "24px 'Microsoft YaHei', sans-serif";
  ctx.fillText(String(family?.familyName || record.familyName || "").slice(0, 22), 140, 124);

  const showAvatar = privacy?.showSelfie !== false;
  if (showAvatar) {
    roundRect(ctx, 72, 150, 72, 72, 36);
    ctx.fillStyle = "#bfdbfe";
    ctx.fill();
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(record.avatarEmoji || "🧑‍🎓", 108, 202);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#17324d";
  ctx.font = "bold 36px 'Microsoft YaHei', sans-serif";
  ctx.fillText(record.childName || "同学", showAvatar ? 160 : 72, 188);
  ctx.fillStyle = "#5b6f86";
  ctx.font = "24px 'Microsoft YaHei', sans-serif";
  ctx.fillText(record.dateTime || "", showAvatar ? 160 : 72, 224);

  let y = 280;
  roundRect(ctx, 72, y, W - 144, 110, 20);
  const sg = ctx.createLinearGradient(72, y, W - 72, y);
  sg.addColorStop(0, "#facc15");
  sg.addColorStop(1, "#f97316");
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.fillStyle = "#17324d";
  ctx.font = "26px 'Microsoft YaHei', sans-serif";
  ctx.fillText("今日成长", 96, y + 40);
  if (privacy?.showScores !== false) {
    ctx.font = "bold 48px 'Segoe UI', sans-serif";
    ctx.fillText(formatScore(record.totalScore), 96, y + 92);
    ctx.font = "bold 28px 'Microsoft YaHei', sans-serif";
    ctx.fillText(`${record.grade?.letter || ""} ${record.grade?.label || ""}`, 270, y + 90);
  } else {
    ctx.font = "bold 32px 'Microsoft YaHei', sans-serif";
    ctx.fillText("成长打卡完成", 96, y + 90);
  }
  y += 130;

  const section = (title, text, startY) => {
    ctx.fillStyle = "#17324d";
    ctx.font = "bold 26px 'Microsoft YaHei', sans-serif";
    ctx.fillText(title, 72, startY);
    ctx.fillStyle = "#5b6f86";
    ctx.font = "24px 'Microsoft YaHei', sans-serif";
    return wrapText(ctx, text, 72, startY + 32, W - 144, 32, 2);
  };

  y = section("复训摘要", record.trainingSummary || record.parentSummary?.trainingSummary, y);
  y += 12;
  y = section("今日亮点", record.highlight, y);
  y += 12;
  y = section("明日计划", record.tomorrowPlan, y);
  y += 12;
  y = section("给明天自己的话", record.noteToSelf, y);

  roundRect(ctx, 72, H - 190, W - 144, 90, 18);
  ctx.fillStyle = "rgba(59,130,246,0.1)";
  ctx.fill();
  ctx.fillStyle = "#2563eb";
  ctx.font = "italic bold 26px 'Microsoft YaHei', sans-serif";
  wrapText(ctx, record.encouragement || "坚持就是成长，明天继续加油！", 92, H - 158, W - 184, 30, 2);

  ctx.fillStyle = "#17324d";
  ctx.font = "22px 'Microsoft YaHei', sans-serif";
  ctx.fillText(String(family?.motto || "错题清零，星球升级").slice(0, 30), 72, H - 52);
  ctx.fillStyle = "#3b82f6";
  ctx.font = "20px 'Segoe UI', sans-serif";
  ctx.fillText("复训星球 · Fuxun Planet", 72, H - 24);

  return canvas.toDataURL("image/png");
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function sharePoster(dataUrl, fileName) {
  const blob = await dataUrlToBlob(dataUrl);
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "今日成长海报", files: [file] });
    return { ok: true };
  }
  return { ok: false };
}

export function downloadPoster(dataUrl, fileName) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}