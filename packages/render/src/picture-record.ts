import type { ElementPaint } from "./element-paint.js"

export type PictureRecord = ElementPaint & { readonly kind: "picture" }
