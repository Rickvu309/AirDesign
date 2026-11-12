import type { ElementPaint } from "./element-paint.js"

export type PresetRecord = ElementPaint & { readonly kind: "shape" | "connector" }
