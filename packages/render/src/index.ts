export { boxOf, ownBox, sameBox, type Moved } from "./box-gesture.js"
export type { Copied } from "./layer-copies.js"
export { pastedOffset, pastedOver } from "./paste-place.js"
export type { LayerClipboard, LayerPaste, PasteMode } from "./use-canvas-clipboard.js"
export type { Turned } from "./transform-drag.js"
export type { FlippedLayer } from "./transform-math.js"
export { ElementView, OpenSlide, useElement } from "./element-view.js"
export { Filmstrip } from "./filmstrip.js"
export { startSettling, useSettled } from "./settling.js"
export { replaceSelection, textValue } from "./paragraph-edit.js"
export { Passage } from "./passage.js"
export type { CanvasChart } from "./chart-record.js"
export type { Framing, GroupOf, Measure } from "./element-paint.js"
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
export { CanvasRulers } from "./canvas-rulers.js"
export type { GuideEdit } from "./guide-edit.js"
export { paintStore, type PaintStore } from "./store.js"
export { textFormatting, type TextFormatting } from "./text-formatting.js"
export {
  arrowOf,
  gestureFor,
  gestures,
  releases,
  type GestureId,
  type GestureRow,
  type KeyLike,
  type Keys,
  type Pointing,
} from "./gestures.js"
export { leadOf, noSelection, type Selection } from "./selection.js"
export { fontsFor, waitForFonts } from "./font-load.js"
