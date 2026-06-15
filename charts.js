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

/** 简化成长 K 线 — 蜡烛 + 折线，支持渐显动画 */
export function drawGrowthKline(canvas, candles, opts = {}) {
  if (!canvas || !candles?.length) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { t: 14, r: 10, b: 24, l: 38 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const vals = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...vals) * 0.995;
  const max = Math.max(...vals) * 1.005;
  const span = max - min || 1;
  const yOf = (v) => pad.t + plotH - ((v - min) / span) * plotH;
  const gap = plotW / candles.length;
  const barW = Math.max(8, gap * 0.5);
  const animate = opts.animate !== false;
  let progress = animate ? 0 : 1;

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#eff6ff");
    bg.addColorStop(1, "#ffffff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(59,130,246,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = pad.t + (plotH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    const linePts = [];
    candles.forEach((c, i) => {
      const x = pad.l + gap * i + gap / 2;
      const up = c.close >= c.open;
      const color = up ? "#22c55e" : "#f97316";
      const closeY = yOf(c.open + (c.close - c.open) * progress);
      const openY = yOf(c.open);
      const highY = yOf(c.high);
      const lowY = yOf(c.low);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      const top = Math.min(openY, closeY);
      const bodyH = Math.max(4, Math.abs(closeY - openY));
      ctx.fillStyle = up ? "rgba(34,197,94,0.88)" : "rgba(249,115,22,0.88)";
      roundRect(ctx, x - barW / 2, top, barW, bodyH, 4);
      ctx.fill();

      linePts.push({ x, y: closeY });
      ctx.fillStyle = "#5b6f86";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.dateKey.slice(5), x, h - 8);
    });

    if (linePts.length > 1 && progress > 0.35) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      const count = Math.max(2, Math.floor(linePts.length * progress));
      linePts.slice(0, count).forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    if (progress < 1) {
      progress = Math.min(1, progress + 0.1);
      requestAnimationFrame(frame);
    }
  };
  frame();
}

/** 投资 K 线 — 折线 + 面积 */
export function drawInvestmentKline(canvas, points, opts = {}) {
  if (!canvas || !points?.length) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { t: 12, r: 10, b: 22, l: 34 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals) * 0.96;
  const max = Math.max(...vals) * 1.04;
  const span = max - min || 1;
  const yOf = (v) => pad.t + plotH - ((v - min) / span) * plotH;
  const gap = plotW / Math.max(1, points.length - 1);
  let progress = opts.animate !== false ? 0 : 1;

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    const count = Math.max(2, Math.ceil(points.length * progress));
    const slice = points.slice(0, count);

    if (slice.length > 1) {
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, "rgba(250,204,21,0.35)");
      grad.addColorStop(1, "rgba(250,204,21,0.02)");
      ctx.beginPath();
      slice.forEach((p, i) => {
        const x = pad.l + gap * i;
        const y = yOf(p.value);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(pad.l + gap * (slice.length - 1), h - pad.b);
      ctx.lineTo(pad.l, h - pad.b);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      slice.forEach((p, i) => {
        const x = pad.l + gap * i;
        const y = yOf(p.value);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    slice.forEach((p, i) => {
      const x = pad.l + gap * i;
      ctx.fillStyle = "#5b6f86";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.dateKey?.slice(5) || "", x, h - 6);
    });

    if (progress < 1) {
      progress = Math.min(1, progress + 0.12);
      requestAnimationFrame(frame);
    }
  };
  frame();
}