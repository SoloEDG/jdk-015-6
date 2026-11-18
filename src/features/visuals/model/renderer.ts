import type { Analysis, Scene, StageDocument } from "../../../shared/types";
import { getTheme } from "./themes";
import { drawScene } from "../lib/geometry";
export function createRenderer(
  canvas: HTMLCanvasElement,
  doc: StageDocument,
  read: () => Analysis,
  overlay?: (c: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = canvas.getContext("2d")!;
  let raf = 0,
    last = 0,
    phase = 0,
    current = "",
    previous: Scene | undefined,
    changed = 0;
  // 未变形的主画面：编辑预览、投影输出与录制共用同一帧源。
  // 投影校正只读取它，不回写任何状态，音乐响应时序不受几何调整影响。
  const master = document.createElement("canvas");
  master.width = 1280;
  master.height = 720;
  const mc = master.getContext("2d")!;
  const scratch = document.createElement("canvas");
  scratch.width = 1280;
  scratch.height = 720;
  const sc = scratch.getContext("2d")!;
  canvas.width = 1280;
  canvas.height = 720;
  function render(ms: number) {
    const dt = Math.min(0.08, (ms - last) / 1000) || 0;
    last = ms;
    const scene =
      doc.scenes.find((s) => s.id === doc.activeId) ?? doc.scenes[0];
    if (current !== scene.id) {
      previous = doc.scenes.find((s) => s.id === current);
      current = scene.id;
      changed = ms;
    }
    if (!doc.frozen) phase += dt * scene.speed;
    const a = read(),
      t = getTheme(scene.theme);
    drawScene(mc, 1280, 720, scene, a, t, phase, doc.sensitivity);
    const mix = Math.min(1, (ms - changed) / (doc.transition * 1000 || 1));
    if (previous && mix < 1) {
      drawScene(
        sc,
        1280,
        720,
        previous,
        a,
        getTheme(previous.theme),
        phase,
        doc.sensitivity,
      );
      mc.globalAlpha = 1 - mix;
      mc.drawImage(scratch, 0, 0);
      mc.globalAlpha = 1;
    }
    if (doc.strobe && a.beat) {
      mc.fillStyle = "#ffffff66";
      mc.fillRect(0, 0, 1280, 720);
    }
    mc.fillStyle = `rgba(0,0,0,${doc.blackout ? 1 : 1 - doc.master})`;
    mc.fillRect(0, 0, 1280, 720);
    c.drawImage(master, 0, 0);
    overlay?.(c, 1280, 720);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);
  return { stop: () => cancelAnimationFrame(raf), master };
}
