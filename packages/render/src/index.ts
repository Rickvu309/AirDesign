export { boxOf, ownBox, sameBox, type Moved } from "./box-gesture.js"
export { ElementView, OpenSlide, useElement } from "./element-view.js"
export { Filmstrip } from "./filmstrip.js"
export { replaceSelection, textValue } from "./paragraph-edit.js"
export { Passage } from "./passage.js"
export type { CanvasChart } from "./chart-record.js"
export type { Framing, GroupOf } from "./element-paint.js"
export type { CanvasLayer } from "./fill-layers.js"
export {
  type CanvasEffects,
  type CanvasElement,
  type CanvasLine,
  type CanvasOutline,
  type CanvasParagraph,
  type CanvasRunStyle,
  type CanvasSlide,
  type CanvasText,
  type CanvasTemplateColor,
  type CanvasTable,
  type ElementRecord,
  type PaintBox,
} from "./record.js"
export { holdKeys, type HeldKeys } from "./held-keys.js"
export { adjustDefaults, openPreset, presetOutline } from "./preset-path.js"
export { SlideCanvas, unshownFill, type Entering } from "./slide-canvas.js"
export { paintStore, type PaintStore } from "./store.js"
export { textFormatting, type TextFormatting } from "./text-formatting.js"
export { gestureFor, gestures, type GestureId } from "./gestures.js"
export { leadOf, noSelection, type Selection } from "./selection.js"
export { fontsFor, waitForFonts } from "./font-load.js"
