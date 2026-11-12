import type { Kind } from "@airdesign/document"
import type { ElementPaint } from "./element-paint.js"

export type FrameRecord = ElementPaint & {
  readonly kind: Exclude<Kind, "shape" | "picture" | "connector" | "group" | "table">
}
