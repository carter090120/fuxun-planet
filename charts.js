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

const KLINE_UP = "#ef4444";
const KLINE_DOWN = "#16a34a";

function normalizeCandle(c) {
  const dateKey = c.dateKey || c.date || "";
  return {
    dateKey,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    change: c.change ?? (c.close - c.open),
    changePercent: c.changePercent,
    reasons: c.reasons || [],
  };
}

/** 成长 K 线 — 红涨绿跌，中国习惯 */
export function drawGrowthKline(canvas, candles, opts = {}) {
  if (!canvas || !candles?.length) return [];
  const list = candles.map(normalizeCandle);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = { t: 16, r: 12, b: 28, l: 42 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const vals = list.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...vals) * 0.995;
  const max = Math.max(...vals) * 1.005;
  const span = max - min || 1;
  const yOf = (v) => pad.t + plotH - ((v - min) / span) * plotH;
  const gap = plotW / list.length;
  const barW = Math.max(6, Math.min(14, gap * 0.55));
  const hitAreas = [];

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

  list.forEach((c, i) => {
    const x = pad.l + gap * i + gap / 2;
    const up = c.close >= c.open;
    const color = up ? KLINE_UP : KLINE_DOWN;
    const openY = yOf(c.open);
    const closeY = yOf(c.close);
    const highY = yOf(c.high);
    const lowY = yOf(c.low);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    const top = Math.min(openY, closeY);
    const bodyH = Math.max(3, Math.abs(closeY - openY));
    ctx.fillStyle = color;
    roundRect(ctx, x - barW / 2, top, barW, bodyH, 2);
    ctx.fill();

    ctx.fillStyle = "#5b6f86";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.dateKey.slice(5), x, h - 10);

    hitAreas.push({
      x: x - gap / 2,
      y: pad.t,
      w: gap,
      h: plotH + pad.b,
      candle: c,
      cx: x,
    });
  });

  if (opts.highlightIndex != null && hitAreas[opts.highlightIndex]) {
    const a = hitAreas[opts.highlightIndex];
    ctx.strokeStyle = "rgba(59,130,246,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x + 1, a.y, a.w - 2, a.h);
  }

  return hitAreas;
}

/**
 * 挂载可滚动成长 K 线图 + tooltip
 * @returns {{ destroy: () => void, select: (index: number) => void }}
 */
export function mountGrowthKlineChart(wrapEl, candles, opts = {}) {
  if (!wrapEl || !candles?.length) return { destroy() {}, select() {} };

  const list = candles.map(normalizeCandle);
  const barPx = opts.barWidth || 26;
  const height = opts.height || 200;
  const minW = Math.max(wrapEl.clientWidth || 320, list.length * barPx + 56);

  wrapEl.innerHTML = "";
  wrapEl.classList.add("growth-kline-scroll");
  const canvas = document.createElement("canvas");
  canvas.className = "growth-kline";
  canvas.width = minW;
  canvas.height = height;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "成长大盘K线图");
  wrapEl.appendChild(canvas);

  const tooltip = document.createElement("div");
  tooltip.className = "growth-kline-tooltip hidden";
  wrapEl.parentElement?.appendChild(tooltip);

  let selected = list.length - 1;
  let hitAreas = [];

  const render = () => {
    hitAreas = drawGrowthKline(canvas, list, { highlightIndex: selected, animate: false });
    showTooltip(selected);
    if (opts.defaultScrollEnd !== false) {
      wrapEl.scrollLeft = wrapEl.scrollWidth;
    }
  };

  const showTooltip = (index) => {
    if (!tooltip || index < 0 || !hitAreas[index]) {
      tooltip?.classList.add("hidden");
      return;
    }
    const c = hitAreas[index].candle;
    const pct = c.changePercent != null
      ? `${c.changePercent >= 0 ? "+" : ""}${c.changePercent}%`
      : "";
    const chg = c.change >= 0 ? `+${c.change}` : String(c.change);
    const reasons = (c.reasons || []).join(" / ") || "—";
    tooltip.innerHTML = `<strong>${c.dateKey}</strong>
      <span>开 ${c.open} · 收 ${c.close}</span>
      <span class="${c.change >= 0 ? "is-up" : "is-down"}">${chg} ${pct}</span>
      <span class="growth-kline-tooltip__reasons">${reasons}</span>`;
    tooltip.classList.remove("hidden");

    const wrapRect = wrapEl.getBoundingClientRect();
    const parent = wrapEl.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const area = hitAreas[index];
    const canvasRect = canvas.getBoundingClientRect();
    const cx = canvasRect.left - parentRect.left + area.cx - wrapEl.scrollLeft;
    let left = cx - tooltip.offsetWidth / 2;
    left = Math.max(8, Math.min(left, parentRect.width - tooltip.offsetWidth - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = "4px";
  };

  const pickFromEvent = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const idx = hitAreas.findIndex((a) => x >= a.x && x < a.x + a.w);
    if (idx >= 0) {
      selected = idx;
      render();
      opts.onSelect?.(list[idx], idx);
    }
  };

  const onClick = (e) => pickFromEvent(e.clientX);
  const onTouch = (e) => {
    if (e.touches[0]) pickFromEvent(e.touches[0].clientX);
  };

  canvas.addEventListener("click", onClick);
  canvas.addEventListener("touchend", onTouch);

  render();
  requestAnimationFrame(render);

  return {
    destroy() {
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchend", onTouch);
      tooltip?.remove();
      wrapEl.innerHTML = "";
    },
    select(index) {
      if (index >= 0 && index < list.length) {
        selected = index;
        render();
      }
    },
  };
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