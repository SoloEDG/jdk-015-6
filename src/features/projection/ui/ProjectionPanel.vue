<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { OUTPUT_COLORS, type ProjectionStore } from "../model/store";
import { createCompositor } from "../model/compositor";

const props = defineProps<{
  proj: ProjectionStore;
  stage: () => HTMLCanvasElement | undefined;
}>();

const num = (e: Event) => Number((e.target as HTMLInputElement).value),
  on = (e: Event) => (e.target as HTMLInputElement).checked;

/* 试调预览：仅在试调期间渲染草稿几何，观众输出与录制不受影响 */
const preview = ref<HTMLCanvasElement>();
let stop = () => {};
watch(
  () => props.proj.trial.value,
  (active) => {
    stop();
    if (!active) return;
    const ctx = preview.value?.getContext("2d");
    if (!ctx) return;
    const comp = createCompositor(640, 360);
    let raf = 0;
    const loop = () => {
      const stage = props.stage(),
        draft = props.proj.draft.value;
      if (stage && draft) comp.render(ctx, stage, draft);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    stop = () => cancelAnimationFrame(raf);
  },
);
onUnmounted(() => stop());
</script>

<template>
  <section class="panel proj-panel">
    <div class="panel-heading">
      <span>06 / PROJECTION</span><span>双投影拼接</span>
    </div>
    <div class="trial-bar" :class="{ on: proj.trial.value }">
      <template v-if="proj.trial.value">
        <span>试调中 · 观众输出与录制仍为已确认版本</span>
        <div>
          <button class="apply" @click="proj.apply">确认应用</button
          ><button @click="proj.cancel">取消</button>
        </div>
      </template>
      <template v-else>
        <span>拖动角点或调整参数即进入试调，确认后才送达投影与录制。</span>
        <button @click="proj.begin">开始试调</button>
      </template>
    </div>
    <canvas
      v-show="proj.trial.value"
      ref="preview"
      class="trial-preview"
      width="640"
      height="360"
    />
    <small v-show="proj.trial.value" class="muted preview-note"
      >试调预览 · 仅编辑可见</small
    >
    <div v-for="(o, i) in proj.view.value" :key="o.id" class="proj-output">
      <div class="proj-output-head">
        <span class="proj-dot" :style="{ background: OUTPUT_COLORS[i] }" />
        <strong>{{ o.name }}</strong>
        <label
          ><input
            type="checkbox"
            :checked="o.enabled"
            @change="proj.editable(i).enabled = on($event)"
          />
          启用</label
        ><button @click="proj.resetOne(i)">重置</button>
      </div>
      <p v-if="!proj.validity.value[i]" class="proj-invalid" role="alert">
        角点交叉或过于接近，校正无效 · 输出保持上一有效状态
      </p>
      <label class="control"
        >融合宽度 <b>{{ Math.round(o.blend * 100) }}%</b
        ><input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="o.blend"
          @input="proj.editable(i).blend = num($event)"
      /></label>
      <div class="two-controls">
        <label class="control"
          >裁切 左 <b>{{ Math.round(o.inset.l * 100) }}%</b
          ><input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            :value="o.inset.l"
            @input="proj.editable(i).inset.l = num($event)" /></label
        ><label class="control"
          >裁切 右 <b>{{ Math.round(o.inset.r * 100) }}%</b
          ><input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            :value="o.inset.r"
            @input="proj.editable(i).inset.r = num($event)" /></label
        ><label class="control"
          >裁切 上 <b>{{ Math.round(o.inset.t * 100) }}%</b
          ><input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            :value="o.inset.t"
            @input="proj.editable(i).inset.t = num($event)" /></label
        ><label class="control"
          >裁切 下 <b>{{ Math.round(o.inset.b * 100) }}%</b
          ><input
            type="range"
            min="0"
            max="0.45"
            step="0.01"
            :value="o.inset.b"
            @input="proj.editable(i).inset.b = num($event)"
        /></label>
      </div>
    </div>
    <small class="muted proj-hint"
      >在「实际投影画面」上拖动四角校正透视 · 校正点绑定舞台位置，窗口缩放不漂移</small
    >
  </section>
</template>
