<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import type { StageDocument, Analysis } from "../../../shared/types";
import { createRenderer } from "../model/renderer";
const props = defineProps<{
  doc: StageDocument;
  read: () => Analysis;
  overlay?: (c: CanvasRenderingContext2D, w: number, h: number) => void;
}>();
const emit = defineEmits<{
  ready: [HTMLCanvasElement];
  master: [HTMLCanvasElement];
}>();
const canvas = ref<HTMLCanvasElement>();
let stop = () => {};
onMounted(() => {
  if (canvas.value) {
    const r = createRenderer(canvas.value, props.doc, props.read, props.overlay);
    stop = r.stop;
    emit("ready", canvas.value);
    emit("master", r.master);
  }
});
onUnmounted(() => stop());
</script>
<template><canvas ref="canvas" aria-label="音乐可视化舞台" /></template>
