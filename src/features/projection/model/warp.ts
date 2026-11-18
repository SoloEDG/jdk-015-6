// 透视校正与边缘融合的纯几何运算。
// 所有坐标均为归一化坐标（0–1，相对舞台 / 输出画面），与窗口尺寸、
// 显示器比例无关 —— 画布内部分辨率恒定，缩放只发生在 CSS 层，校正点不漂移。
export interface Pt {
  x: number;
  y: number;
}
/** 四角顺序：左上 → 右上 → 右下 → 左下 */
export type Quad = [Pt, Pt, Pt, Pt];
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 单位正方形 → 目标四边形的单应矩阵（3×3 行主序，h33 = 1） */
export function homography(q: Quad): number[] {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    sx = p0.x - p1.x + p2.x - p3.x,
    sy = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1 || 1e-12;
  const g = (sx * dy2 - dx2 * sy) / det,
    h = (dx1 * sy - sx * dy1) / det;
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h,
    1,
  ];
}

export function applyH(m: number[], u: number, v: number): Pt {
  const w = m[6] * u + m[7] * v + 1 || 1e-12;
  return {
    x: (m[0] * u + m[1] * v + m[2]) / w,
    y: (m[3] * u + m[4] * v + m[5]) / w,
  };
}

export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i],
      n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return a / 2;
}

/**
 * 有效四边形：凸、边不相交（非蝴蝶结）、无重合边、面积高于阈值。
 * 交叉或几乎重合时返回 false，调用方应保留上一次有效输出。
 */
export function quadValid(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-7) return false;
    const s = Math.sign(cross);
    if (!sign) sign = s;
    else if (s !== sign) return false;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.02) return false;
  }
  return Math.abs(quadArea(q)) >= 0.004;
}

const GRID = 16;

/**
 * 将源画面的 crop 区域按四角单应变换绘制到输出上下文。
 * 采用 16×16 网格 + 逐三角形仿射映射逼近透视变换。
 */
export function warpDraw(
  c: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  crop: Crop,
  q: Quad,
  W: number,
  H: number,
) {
  const m = homography(q),
    sw = src.width,
    sh = src.height;
  const pts: Pt[][] = [];
  for (let r = 0; r <= GRID; r++) {
    const row: Pt[] = [];
    for (let col = 0; col <= GRID; col++)
      row.push(applyH(m, col / GRID, r / GRID));
    pts.push(row);
  }
  const sx = (u: number) => (crop.x + u * crop.w) * sw,
    sy = (v: number) => (crop.y + v * crop.h) * sh;
  for (let r = 0; r < GRID; r++)
    for (let col = 0; col < GRID; col++) {
      const u0 = col / GRID,
        u1 = (col + 1) / GRID,
        v0 = r / GRID,
        v1 = (r + 1) / GRID;
      const p00 = pts[r][col],
        p10 = pts[r][col + 1],
        p01 = pts[r + 1][col],
        p11 = pts[r + 1][col + 1];
      triangle(
        c,
        src,
        sx(u0),
        sy(v0),
        sx(u1),
        sy(v0),
        sx(u0),
        sy(v1),
        p00.x * W,
        p00.y * H,
        p10.x * W,
        p10.y * H,
        p01.x * W,
        p01.y * H,
      );
      triangle(
        c,
        src,
        sx(u1),
        sy(v0),
        sx(u1),
        sy(v1),
        sx(u0),
        sy(v1),
        p10.x * W,
        p10.y * H,
        p11.x * W,
        p11.y * H,
        p01.x * W,
        p01.y * H,
      );
    }
}

/** 源三角形 (x*) → 目标三角形 (u*) 的仿射纹理映射 */
function triangle(
  c: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
) {
  const d = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
  if (Math.abs(d) < 1e-9) return;
  // 目标三角形沿质心外扩 0.7px，掩盖相邻网格的接缝
  const cx = (u0 + u1 + u2) / 3,
    cy = (v0 + v1 + v2) / 3,
    grow = (x: number, y: number): [number, number] => {
      const dx = x - cx,
        dy = y - cy,
        l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * 0.7, y + (dy / l) * 0.7];
    },
    [g0x, g0y] = grow(u0, v0),
    [g1x, g1y] = grow(u1, v1),
    [g2x, g2y] = grow(u2, v2);
  c.save();
  c.beginPath();
  c.moveTo(g0x, g0y);
  c.lineTo(g1x, g1y);
  c.lineTo(g2x, g2y);
  c.closePath();
  c.clip();
  c.transform(
    (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / d,
    (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / d,
    (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / d,
    (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / d,
    (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / d,
    (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / d,
  );
  c.drawImage(src, 0, 0);
  c.restore();
}

export interface BlendItem {
  quad: Quad;
  /** 0–1，映射为输出宽度 0–30% 的融合过渡带 */
  blend: number;
}

/**
 * 为每块投影生成融合蒙版（半分辨率，绘制时平滑放大）：
 * 重叠区各投影权重归一化（Σ = 1，不变亮）；
 * 仅一块覆盖的区域权重恒为 1（非重叠边缘不变暗）。
 */
export function buildMasks(
  W: number,
  H: number,
  items: BlendItem[],
): HTMLCanvasElement[] {
  const cov: Float32Array[] = [];
  for (const it of items) {
    const c = new Float32Array(W * H),
      blendPx = it.blend * 0.3 * W,
      winding = Math.sign(quadArea(it.quad)) || 1,
      pts = it.quad.map((p) => ({ x: p.x * W, y: p.y * H })),
      edges = pts.map((p, i) => {
        const q = pts[(i + 1) % 4],
          ex = q.x - p.x,
          ey = q.y - p.y;
        return { ex, ey, px: p.x, py: p.y, len: Math.hypot(ex, ey) || 1 };
      });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let dmin = Infinity;
        for (const e of edges) {
          const d =
            ((e.ex * (y + 0.5 - e.py) - e.ey * (x + 0.5 - e.px)) * winding) /
            e.len;
          if (d < dmin) dmin = d;
        }
        if (dmin <= 0) continue;
        const t = blendPx > 0 ? Math.min(1, dmin / blendPx) : 1;
        c[y * W + x] = t * t * (3 - 2 * t);
      }
    cov.push(c);
  }
  return items.map((_, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!,
      img = ctx.createImageData(W, H);
    for (let p = 0; p < W * H; p++) {
      let sum = 0;
      for (let k = 0; k < items.length; k++) sum += cov[k][p];
      img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = 255;
      img.data[p * 4 + 3] = Math.round((sum > 0 ? cov[i][p] / sum : 0) * 255);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  });
}
