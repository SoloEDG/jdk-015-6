import { quadValid } from "../model/warp";
import {
  cropOf,
  OUTPUT_COLORS,
  type ProjectionOutput,
} from "../model/store";

/**
 * 编辑区（未变形舞台）上的校正参考线：
 * 中心十字 + 三分线，以及每块投影的源画面裁切框。
 * 试调中已确认版本以暗色虚线对照显示。
 */
export function drawEditorGuides(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  outputs: ProjectionOutput[],
  base?: ProjectionOutput[],
) {
  c.save();
  c.strokeStyle = "#ffffff14";
  c.lineWidth = 1;
  c.setLineDash([4, 6]);
  c.beginPath();
  c.moveTo(W / 2, 0);
  c.lineTo(W / 2, H);
  c.moveTo(0, H / 2);
  c.lineTo(W, H / 2);
  for (const f of [1 / 3, 2 / 3]) {
    c.moveTo(W * f, 0);
    c.lineTo(W * f, H);
    c.moveTo(0, H * f);
    c.lineTo(W, H * f);
  }
  c.stroke();
  c.setLineDash([]);
  if (base) drawCrops(c, W, H, base, true);
  drawCrops(c, W, H, outputs, false);
  c.restore();
}

function drawCrops(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  outputs: ProjectionOutput[],
  dim: boolean,
) {
  outputs.forEach((o, i) => {
    if (!o.enabled) return;
    const r = cropOf(o),
      col = dim ? "#8b8b9966" : OUTPUT_COLORS[i % OUTPUT_COLORS.length];
    c.strokeStyle = col;
    c.lineWidth = dim ? 1 : 1.6;
    c.setLineDash(dim ? [3, 5] : [8, 5]);
    c.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
    c.setLineDash([]);
    if (!dim) {
      c.fillStyle = col;
      c.font = "600 12px 'Space Grotesk', sans-serif";
      c.fillText(`投影 ${o.id} 源区域`, r.x * W + 9, r.y * H + 19);
    }
  });
}

/**
 * 输出监视器上的校正覆盖层：每块投影的四角轮廓与拖点。
 * 四角交叉 / 重合时标红并提示无效（输出仍保持上一有效状态）。
 */
export function drawOutputGuides(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  outputs: ProjectionOutput[],
) {
  c.clearRect(0, 0, W, H);
  outputs.forEach((o, i) => {
    if (!o.enabled) return;
    const ok = quadValid(o.corners),
      col = ok ? OUTPUT_COLORS[i % OUTPUT_COLORS.length] : "#ff8296",
      px = o.corners.map((p) => ({ x: p.x * W, y: p.y * H }));
    c.strokeStyle = col;
    c.lineWidth = 1.6;
    c.setLineDash(ok ? [] : [7, 5]);
    c.beginPath();
    px.forEach((p, k) => (k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.stroke();
    c.setLineDash([]);
    px.forEach((p, k) => {
      c.beginPath();
      c.arc(p.x, p.y, 8, 0, Math.PI * 2);
      c.fillStyle = "#101117";
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = col;
      c.font = "600 10px 'Space Grotesk', sans-serif";
      c.fillText(`${o.id}${k + 1}`, p.x + 11, p.y - 9);
    });
    if (!ok) {
      const cx = px.reduce((s, p) => s + p.x, 0) / 4,
        cy = px.reduce((s, p) => s + p.y, 0) / 4;
      c.fillStyle = "#ff8296";
      c.font = "600 13px 'DM Sans', sans-serif";
      c.textAlign = "center";
      c.fillText("校正无效 · 输出保持上一有效状态", cx, cy);
      c.textAlign = "left";
    }
  });
}
