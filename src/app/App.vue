<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  Maximize2,
  Radio,
  AudioLines,
  SlidersHorizontal,
  Disc3,
  ArrowUpRight,
} from "lucide-vue-next";
import { createDocument } from "../shared/document";
import { createAudio, AudioPanel } from "../features/audio";
import { StageCanvas, ThemePanel } from "../features/visuals";
import { createScenes, ScenePanel, SceneStrip } from "../features/scenes";
import {
  createControls,
  bindShortcuts,
  LivePanel,
  SignalMeter,
} from "../features/live";
import { createRecorder, RecordPanel, TakeList } from "../features/recording";
import {
  createProjection,
  drawEditorGuides,
  OutputView,
  ProjectionPanel,
} from "../features/projection";
const doc = createDocument(),
  audio = createAudio(doc),
  scenes = createScenes(doc),
  controls = createControls(doc),
  recorder = createRecorder(),
  proj = createProjection();
const masterCanvas = ref<HTMLCanvasElement>(),
  outputCanvas = ref<HTMLCanvasElement>(),
  stage = ref<HTMLElement>();
const fullError = ref("");
const unbind = bindShortcuts({
  play: () => {
    void (audio.state.playing ? audio.pause() : audio.play());
  },
  scene: (i) => scenes.select(doc.scenes[i].id),
  blackout: controls.blackout,
  freeze: controls.freeze,
  tap: controls.tap,
});
// 编辑区参考线：未变形舞台 + 各投影源区域（试调时对照已确认版本）
const stageOverlay = (c: CanvasRenderingContext2D, w: number, h: number) =>
  drawEditorGuides(
    c,
    w,
    h,
    proj.view.value,
    proj.trial.value ? proj.outputs : undefined,
  );
function start() {
  // 录制的是实际投影输出，与观众窗口一致
  if (outputCanvas.value) recorder.start(outputCanvas.value, audio.stream());
}
async function fullscreen() {
  try {
    await stage.value?.requestFullscreen();
  } catch {
    fullError.value = "当前浏览器不支持全屏";
  }
}
onUnmounted(() => {
  unbind();
  audio.dispose();
  recorder.dispose();
});
</script>
<template>
  <div class="workspace">
    <header>
      <a class="brand" href="./"
        ><AudioLines :size="25" /><span
          >RESONANCE<small>REALTIME VISUAL STUDIO</small></span
        ></a
      >
      <nav><a class="current">演出工作台</a><span>声音的另一种形状</span></nav>
      <div class="header-right">
        <span class="local-status"><i></i> LOCAL SESSION</span
        ><span class="version">v1.0</span>
      </div>
    </header>
    <div class="title-bar">
      <div>
        <div class="eyebrow">YOUR SOUND. IN MOTION.</div>
        <h1>让音乐，成为现场<span>。</span></h1>
        <p>从第一声节拍，到最后一束光。</p>
      </div>
      <div class="project-badge">
        <Disc3 :size="18" /><span
          >UNTITLED SESSION<small>实时音频驱动 / 720P</small></span
        >
      </div>
    </div>
    <main>
      <aside class="left-column">
        <AudioPanel :engine="audio" :doc="doc" /><ScenePanel
          :doc="doc"
          :store="scenes"
        />
      </aside>
      <div class="center-column">
        <section class="stage-shell" ref="stage">
          <div class="stage-toolbar">
            <span
              ><i class="dot" :class="{ on: audio.state.playing }"></i>
              {{ audio.state.playing ? "LIVE PREVIEW" : "STAGE PREVIEW" }}</span
            ><span
              >{{ scenes.active.value.name }}
              <button @click="fullscreen" aria-label="全屏预览">
                <Maximize2 :size="15" /></button
            ></span>
          </div>
          <div class="canvas-wrap">
            <StageCanvas
              :doc="doc"
              :read="() => audio.frame.value"
              :overlay="stageOverlay"
              @master="masterCanvas = $event"
            />
            <div class="stage-caption">
              <small
                >RESONANCE / 0{{
                  doc.scenes.findIndex((s) => s.id === doc.activeId) + 1
                }}</small
              ><span>{{ scenes.active.value.name }}</span>
            </div>
            <span class="canvas-resolution">16:9 · 1280 × 720</span>
          </div>
          <SignalMeter :frame="audio.frame.value" />
        </section>
        <p v-if="fullError" role="alert">{{ fullError }}</p>
        <OutputView
          :proj="proj"
          :stage="() => masterCanvas"
          @ready="outputCanvas = $event"
        />
        <SceneStrip :doc="doc" @select="scenes.select" /><ThemePanel
          :scene="scenes.active.value"
        /><TakeList :recorder="recorder" />
      </div>
      <aside class="right-column">
        <LivePanel
          :doc="doc"
          :controls="controls"
          :beat="audio.frame.value.beat"
        /><RecordPanel :recorder="recorder" @start="start" /><ProjectionPanel
          :proj="proj"
          :stage="() => masterCanvas"
        />
        <div class="note">
          <Radio :size="19" />
          <p>
            跟随声音，自由即兴。<small
              >用 1–4 切换场景，空格控制播放。<br />让灵感留在当下。</small
            >
          </p>
          <ArrowUpRight :size="17" />
        </div>
      </aside>
    </main>
    <footer>
      <span
        ><SlidersHorizontal :size="13" /> ALL SYSTEMS READY
        <i>·</i> 浏览器本地运行</span
      ><span
        >SPACE 播放 / 暂停 <i>·</i> 1–4 场景 <i>·</i> B 黑场 <i>·</i> F
        冻结</span
      ><span>MADE FOR THE MOMENT ↗</span>
    </footer>
  </div>
</template>
