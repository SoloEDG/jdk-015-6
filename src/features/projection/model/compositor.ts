import { cropOf, type ProjectionOutput } from "./store";
import {
  buildMasks,
  quadValid,
  warpDraw,
  type Crop,
  type Quad,
} from "./warp";

/**
 * 投影合成器：每帧把未变形的舞台主画面按各投影的几何校正
 *  warp 到输出画布，再叠加融合蒙版做拼接。
 * 只读取舞台画布，不回写任何音频 / 动画状态 —— 调整其中一块
 * 不会改变另一块（乃至整体）的音乐响应时序。
 */
export function createCompositor(W: number, H: number) {
  const layers = [0, 1].map(() => {
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    return { cv, ctx: cv.getContext("2d")! };
  });
  /** 每块投影各自记住上一次有效四角，校正失效时回退 */
  const lastValid: (Quad | undefined)[] = [undefined, undefined];
  let maskKey = "",
    masks: HTMLCanvasElement[] = [];

  function render(
    out: CanvasRenderingContext2D,
    stage: HTMLCanvasElement,
    outputs: ProjectionOutput[],
  ) {
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    out.fillStyle = "#000";
    out.fillRect(0, 0, W, H);
    const active: { i: number; quad: Quad; blend: number; crop: Crop }[] = [];
    outputs.forEach((o, i) => {
      if (!o.enabled || i >= layers.length) return;
      if (quadValid(o.corners))
        lastValid[i] = o.corners.map((p) => ({ ...p })) as Quad;
      const quad = lastValid[i];
      if (quad)
        active.push({ i, quad, blend: o.blend, crop: cropOf(o) });
    });
    // 蒙版只随几何变化重建（每帧最多一次），避免拖角点时卡顿
    const key = JSON.stringify(active.map((a) => [a.quad, a.blend]));
    if (key !== maskKey) {
      maskKey = key;
      masks = buildMasks(
        W >> 1,
        H >> 1,
        active.map((a) => ({ quad: a.quad, blend: a.blend })),
      );
    }
    active.forEach((a, k) => {
      const L = layers[a.i],
        lc = L.ctx;
      lc.globalCompositeOperation = "source-over";
      lc.clearRect(0, 0, W, H);
      warpDraw(lc, stage, a.crop, a.quad, W, H);
      const mask = masks[k];
      if (mask) {
        lc.globalCompositeOperation = "destination-in";
        lc.drawImage(mask, 0, 0, W, H);
      }
      // 权重已归一化（Σ = 1），加法合成即柔和拼接
      out.globalCompositeOperation = "lighter";
      out.drawImage(L.cv, 0, 0);
    });
    out.globalCompositeOperation = "source-over";
  }
  return { render };
}
export type Compositor = ReturnType<typeof createCompositor>;
