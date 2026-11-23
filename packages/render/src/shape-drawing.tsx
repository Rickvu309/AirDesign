import type { Spot } from "@airdesign/document"
import { type DrawnBox, type ShapeKind } from "./shape-draw.js"

export type ShapeLook = ShapeKind | "ellipse"

export type ShapeDrawn = { readonly at: Spot } | { readonly box: DrawnBox }

export type ShapeDrawing = { readonly look: ShapeLook; readonly onDraw: (drawn: ShapeDrawn) => void }
