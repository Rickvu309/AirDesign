import type { ElementPaint } from "./element-paint.js"

export type TableRecord = ElementPaint & { readonly kind: "table" | "chart" }
