export { boxOf, sameBox } from "./box-gesture.js"
export {
  guidesAt,
  lineAt,
  nearestLine,
  reachOf,
  snapMove,
  type Bounds,
  type Guide,
  type Line,
  type SnapTargets,
  type Watched,
} from "./snapping.js"
export type { ResizeGrip, RotateGrip, TransformGrip } from "./transform-math.js"
export {
  flipSelection,
  normalizeDegrees,
  resizeBox,
  resizeCursor,
  resizeSelection,
  rotateCursor,
  rotatedAngle,
} from "./transform-math.js"
export { Filmstrip } from "./filmstrip.js"
export { NodeArt } from "./node-art.js"
export { TextLines } from "./node-text.js"
export { DoomSlide, SlidePaint, useDoomSlide } from "./doom-slide.js"
export { useSettled } from "./settling.js"
export { singleLineHeight } from "./text-look.js"
export type { CanvasCrop, Framing, GroupOf, Measure } from "./element-paint.js"
export { placedFrame } from "./crop-drag.js"
export type { CanvasLayer } from "./fill-layers.js"
export {
  type CanvasBullet,
  type CanvasEffects,
  type CanvasElement,
  type CanvasLine,
  type CanvasOutline,
  type CanvasParagraph,
  type CanvasRunStyle,
  type CanvasSlide,
  type CanvasText,
  type CanvasTemplateColor,
  type ElementRecord,
  type PaintBox,
} from "./record.js"
export { adjustDefaults, openPreset, presetOutline } from "./preset-path.js"
export type { ShapeDrawn } from "./shape-drawing.js"

export { paintStore, type PaintStore } from "./store.js"
export { type TextFormatting } from "./text-formatting.js"
export {
  arrowOf,
  gestureFor,
  gestures,
  releases,
  type GestureId,
  type GestureRow,
  type KeyLike,
  type Pointing,
} from "./gestures.js"
export { noSelection, type Selection } from "./selection.js"
export { fontsFor, installedFaces, waitForFonts } from "./font-load.js"
export { unshownFill } from "./unshown-fill.js"
