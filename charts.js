/** Simple canvas charts — no external libs */

export function drawBarChart(canvas, labels, values, opts = {}) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const max = Math.max(...values, 1);
  const pad = 24;
  const barW = (w - pad * 2) / labels.length - 8;

  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#eff6ff");
  bg.addColorStop(1, "#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  labels.forEach((label, i) => {
    const val = values[i] || 0;
    const barH = ((h - 50) * val) / max;
    const x = pad + i * (barW + 8);
    const y = h - 30 - barH;
    const g = ctx.createLinearGradient(x, y, x, h - 30);
    g.addColorStop(0, opts.colorTop || "#3b82f6");
    g.addColorStop(1, opts.colorBottom || "#22c55e");
    ctx.fillStyle = g;
    roundRect(ctx, x, y, barW, barH, 6);
    ctx.fill();
    ctx.fillStyle = "#17324d";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(val), x + barW / 2, y - 4);
    ctx.font = "10px sans-serif";
    ctx.fillStyle = "#5b6f86";
    ctx.fillText(label.slice(0, 4), x + barW / 2, h - 10);
  });
  ctx.textAlign = "left";
}

export function drawRing(canvas, percent, label) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 10;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * percent) / 100);
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.fillStyle = "#17324d";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${percent}%`, cx, cy + 4);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#5b6f86";
  ctx.fillText(label, cx, cy + 24);
  ctx.textAlign = "left";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}