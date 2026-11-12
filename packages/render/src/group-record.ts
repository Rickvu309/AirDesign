import type { ElementPaint } from "./element-paint.js"

export type GroupRecord = ElementPaint & { readonly kind: "group" }
