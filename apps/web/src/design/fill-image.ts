import { landedPatch, shapeOf, type ElementId, type Register } from "@airdesign/document"
import { readShapes } from "@airdesign/pptx"
import { fillCopy } from "@/copy/fill-copy"
import { caseSeed } from "@/design/control-seed"

const seeded = caseSeed("fills.paint.image", { scheme: "accent1" })

export type HeldPaint = { readonly image: string } | { readonly image: true }

export function fillImageChoice(
  value: unknown,
  control: { readonly trait: string; readonly field: string; readonly label: string },
): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "image" in value &&
    (value as { readonly image: unknown }).image === seeded &&
    control.trait === "fills" &&
    control.field === "paint" &&
    control.label !== fillCopy.box
  )
}

export function heldPaint(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
  node: ElementId,
): HeldPaint | null {
  const body = register?.elements[node]
  const source = body === undefined ? undefined : landedPatch(body, "text").fills?.source
  if (typeof source === "object" && typeof source.set === "string") return { image: source.set }
  const { slide, shape } = shapeOf(node)
  const picture = readShapes(parts).some(
    (each) => each.slide === slide && each.shape === shape && each.kind === "p:pic",
  )
  return picture ? { image: true } : null
}

export function chosenFill(
  value: unknown,
  control: { readonly trait: string; readonly field: string; readonly label: string },
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register | null,
  node: ElementId,
): { readonly pick: true } | { readonly value: unknown } {
  if (!fillImageChoice(value, control)) return { value }
  const held = heldPaint(parts, register, node)
  return held === null ? { pick: true } : { value: held }
}
