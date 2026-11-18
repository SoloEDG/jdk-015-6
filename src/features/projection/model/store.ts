import { computed, reactive, ref } from "vue";
import { quadValid, type Crop, type Quad } from "./warp";

export interface ProjectionOutput {
  id: string;
  name: string;
  enabled: boolean;
  /** 输出画面上的四角（归一化坐标），拖动做透视校正 */
  corners: Quad;
  /** 源画面裁切（四边内缩比例） */
  inset: { l: number; r: number; t: number; b: number };
  /** 重叠区融合宽度 0–1 */
  blend: number;
}

export const OUTPUT_COLORS = ["#7fc4ff", "#ffab7a"];

const DEFAULTS: ProjectionOutput[] = [
  {
    id: "A",
    name: "投影 A · 左",
    enabled: true,
    corners: [
      { x: 0, y: 0 },
      { x: 0.55, y: 0 },
      { x: 0.55, y: 1 },
      { x: 0, y: 1 },
    ],
    inset: { l: 0, r: 0.45, t: 0, b: 0 },
    blend: 0.6,
  },
  {
    id: "B",
    name: "投影 B · 右",
    enabled: true,
    corners: [
      { x: 0.45, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.45, y: 1 },
    ],
    inset: { l: 0.45, r: 0, t: 0, b: 0 },
    blend: 0.6,
  },
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function cropOf(o: ProjectionOutput): Crop {
  return {
    x: o.inset.l,
    y: o.inset.t,
    w: Math.max(0.05, 1 - o.inset.l - o.inset.r),
    h: Math.max(0.05, 1 - o.inset.t - o.inset.b),
  };
}

/**
 * 双投影拼接状态。
 * outputs 是已确认版本 —— 观众窗口与录制始终使用它；
 * 演出中的一切调整先进入 draft（试调），apply 一次性送达输出，
 * cancel 丢弃试调，正在录制的投影版本不受影响。
 */
export function createProjection() {
  const outputs = reactive(clone(DEFAULTS)) as ProjectionOutput[];
  const draft = ref<ProjectionOutput[] | null>(null);
  const trial = computed(() => draft.value !== null);
  /** 编辑区参考线显示的几何：试调中显示草稿，否则显示已确认版本 */
  const view = computed(() => draft.value ?? outputs);
  const validity = computed(() => view.value.map((o) => quadValid(o.corners)));
  const committedInvalid = computed(() =>
    outputs.some((o) => o.enabled && !quadValid(o.corners)),
  );
  function ensureDraft() {
    if (!draft.value) draft.value = clone(outputs);
  }
  /** 取试调草稿中的第 i 块（首次调用自动进入试调） */
  function editable(i: number) {
    ensureDraft();
    return draft.value![i];
  }
  function begin() {
    ensureDraft();
  }
  function apply() {
    if (!draft.value) return;
    outputs.splice(0, outputs.length, ...clone(draft.value));
    draft.value = null;
  }
  function cancel() {
    draft.value = null;
  }
  function resetOne(i: number) {
    ensureDraft();
    draft.value![i] = clone(DEFAULTS[i]);
  }
  return {
    outputs,
    draft,
    trial,
    view,
    validity,
    committedInvalid,
    begin,
    apply,
    cancel,
    resetOne,
    editable,
    ensureDraft,
  };
}
export type ProjectionStore = ReturnType<typeof createProjection>;
