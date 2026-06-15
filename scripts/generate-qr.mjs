import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "https://study-habit-pwa.vercel.app";
const out = join(__dirname, "..", "复训星球MVP演示二维码.png");

const qrDataUrl = await QRCode.toDataURL(url, {
  width: 360,
  margin: 2,
  color: { dark: "#1e3a5f", light: "#ffffff" },
});
const qrImg = await loadImage(qrDataUrl);

const padTop = 40;
const padBottom = 120;
const w = 360;
const h = 360 + padTop + padBottom;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#DBEAFE";
ctx.fillRect(0, 0, w, h);
ctx.drawImage(qrImg, 0, padTop, 360, 360);

ctx.fillStyle = "#1e3a5f";
ctx.font = "bold 26px 'Microsoft YaHei', sans-serif";
ctx.textAlign = "center";
ctx.fillText("扫码体验复训星球", w / 2, 360 + padTop + 36);

ctx.fillStyle = "#3B82F6";
ctx.font = "18px 'Microsoft YaHei', sans-serif";
ctx.fillText("错题复训清零，家庭陪伴成长", w / 2, 360 + padTop + 76);

writeFileSync(out, canvas.toBuffer("image/png"));
console.log("saved:", out);