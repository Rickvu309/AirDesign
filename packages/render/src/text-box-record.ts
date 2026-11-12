import type { ElementPaint } from "./element-paint.js"

export type TextBoxRecord = ElementPaint & { readonly kind: "shape" }
