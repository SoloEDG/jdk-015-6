<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { ExternalLink, Maximize2, Move } from "lucide-vue-next";
import type { ProjectionStore } from "../model/store";
import { createCompositor } from "../model/compositor";
import { drawOutputGuides } from "../lib/guides";
import { clamp } from "../../../shared/math";

const props = defineProps<{
  proj: ProjectionStore;
  stage: () => HTMLCanvasElement | undefined;
}>();
const emit = defineEmits<{ ready: [HTMLCanvasElement] }>();

const W = 1280,
  H = 720;
const wrap = ref<HTMLElement>(),
  canvas = ref<HTMLCanvasElement>(),
  overlay = ref<HTMLCanvasElement>();
const editing = ref(true),
  popped = ref(false),
  viewError = ref("");
const compositor = createCompositor(W, H);
let raf = 0,
  popup: Window | null = null,
  popupStream: MediaStream | undefined,
  popupTimer = 0;

onMounted(() => {
  canvas.value!.width = W;
  canvas.value!.height = H;
  overlay.value!.width = W;
  overlay.value!.height = H;
  const ctx = canvas.value!.getContext("2d")!,
    octx = overlay.value!.getContext("2d")!;
  const frame = () => {
    const stage = props.stage();
    // 合成只读取已确认版本：试调草稿不会出现在观众画面与录制里
    if (stage) compositor.render(ctx, stage, props.proj.outputs);
    if (editing.value) drawOutputGuides(octx, W, H, props.proj.view.value);
    else octx.clearRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  emit("ready", canvas.value!);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  clearInterval(popupTimer);
  popupStream?.getTracks().forEach((t) => t.stop());
  popup?.close();
});

/* —— 四角拖拽（归一化坐标命中与存储，窗口缩放不漂移） —— */
let drag: { out: number; corner: number } | null = null;
function pointAt(e: PointerEvent) {
  const r = overlay.value!.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height,
    rw: r.width,
    rh: r.height,
  };
}
function hit(e: PointerEvent) {
  const p = pointAt(e);
  let best: { out: number; corner: number; d: number } | null = null;
  props.proj.view.value.forEach((o, i) => {
    if (!o.enabled) return;
    o.corners.forEach((c, k) => {
      const d = Math.hypot((p.x - c.x) * p.rw, (p.y - c.y) * p.rh);
      if (d < 20 && (!best || d < best.d)) best = { out: i, corner: k, d };
    });
  });
  return best;
}
function down(e: PointerEvent) {
  if (!editing.value) return;
  const h = hit(e);
  if (!h) return;
  drag = h;
  overlay.value!.setPointerCapture(e.pointerId);
  props.proj.ensureDraft(); // 首次拖动即进入试调，确认前输出不变
}
function move(e: PointerEvent) {
  if (!drag) {
    if (editing.value)
      overlay.value!.style.cursor = hit(e) ? "move" : "crosshair";
    return;
  }
  const p = pointAt(e);
  props.proj.editable(drag.out).corners[drag.corner] = {
    x: clamp(p.x, -0.25, 1.25),
    y: clamp(p.y, -0.25, 1.25),
  };
}
function up() {
  drag = null;
}

/* —— 观众窗口：镜像输出画布，不含任何编辑参考线 —— */
function openAudience() {
  viewError.value = "";
  if (popup && !popup.closed) {
    popup.focus();
    return;
  }
  popup = window.open("", "resonance-audience", "width=960,height=560");
  if (!popup) {
    viewError.value = "浏览器拦截了弹出窗口，请允许后重试";
    return;
  }
  const d = popup.document;
  d.title = "RESONANCE · 观众输出";
  d.body.style.cssText =
    "margin:0;background:#000;height:100vh;overflow:hidden";
  const v = d.createElement("video");
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.style.cssText = "width:100vw;height:100vh;object-fit:contain;display:block";
  v.ondblclick = () => void v.requestFullscreen?.();
  d.body.appendChild(v);
  popupStream = canvas.value!.captureStream(30);
  v.srcObject = popupStream;
  void v.play().catch(() => {});
  popped.value = true;
  clearInterval(popupTimer);
  popupTimer = window.setInterval(() => {
    if (!popup || popup.closed) {
      clearInterval(popupTimer);
      popupStream?.getTracks().forEach((t) => t.stop());
      popupStream = undefined;
      popup = null;
      popped.value = false;
    }
  }, 500);
}
async function fullscreen() {
  try {
    await wrap.value?.requestFullscreen();
  } catch {
    viewError.value = "当前浏览器不支持全屏";
  }
}
</script>

<template>
  <section class="stage-shell output-shell">
    <div class="stage-toolbar">
      <span
        ><i class="dot on"></i> PROJECTOR OUTPUT · 实际投影画面
        <em v-if="proj.committedInvalid.value" class="output-warning"
          >校正无效 · 保持上一有效输出</em
        ></span
      >
      <span>
        <button
          class="tool-btn"
          :class="{ selected: editing }"
          @click="editing = !editing"
        >
          <Move :size="14" /> 角点校正</button
        ><button @click="openAudience" aria-label="打开观众窗口">
          <ExternalLink :size="15" /></button
        ><button @click="fullscreen" aria-label="全屏输出">
          <Maximize2 :size="15" />
        </button>
      </span>
    </div>
    <div class="output-wrap" ref="wrap">
      <canvas ref="canvas" class="output-canvas" aria-label="投影输出画面" />
      <canvas
        ref="overlay"
        class="output-overlay"
        v-show="editing"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="up"
      />
    </div>
    <div class="output-status">
      <span>{{
        popped
          ? "观众窗口已打开 · 双击画面可全屏"
          : "观众窗口与录制仅显示此画面"
      }}</span>
      <span v-if="proj.trial.value" class="trial-hint"
        >试调中 · 确认前输出不变</span
      >
    </div>
    <p v-if="viewError" role="alert">{{ viewError }}</p>
  </section>
</template>
