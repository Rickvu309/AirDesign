import type { Box } from "./box.js"
import type { ChangeRefusal, ScopedElement, SetChange } from "./change.js"
import type { Design } from "./design.js"
import type { FieldEdit } from "./row.js"

type Size = { readonly cx: number; readonly cy: number }
type Rounded = { readonly preset: "rect" | "roundRect"; readonly adjust: Readonly<Record<string, number>> }
type Opening = { readonly design?: Design; readonly box?: Box | null } | undefined

const defaultAdjust = 16_667
const emuPerPoint = 12_700
const whole = 100_000
const guideLimit = 2_147_483_647

const shortSide = (size: Size) => Math.min(size.cx, size.cy)

function cornersNow(
  edit: FieldEdit<unknown> | undefined,
  opening: Opening,
  box: Box | null,
  added: string | null,
): number | undefined {
  if (box === null) return undefined
  if (edit === undefined && added === "roundRect") return (defaultAdjust * shortSide(box)) / whole
  if (typeof edit === "object" && edit !== null && "set" in edit) {
    const shape = edit.set as { readonly preset: string; readonly adjust: Readonly<Record<string, number>> }
    return shape.preset === "roundRect" ? ((shape.adjust.adj ?? defaultAdjust) * shortSide(box)) / whole : undefined
  }
  const points = opening?.design?.["geometry.corners"]?.[0]
  const from = opening?.box
  if (opening?.design?.geometry?.[0] !== "roundRect" || typeof points !== "number" || !from) return undefined
  return shortSide(from) > 0 ? (points * emuPerPoint * shortSide(box)) / shortSide(from) : undefined
}

export function roundedShape(radius: number, size: Size): Rounded {
  const side = shortSide(size)
  if (!(radius > 0) || !(side > 0)) return { preset: "rect", adjust: {} }
  return {
    preset: "roundRect",
    adjust: { adj: Math.max(1, Math.min(guideLimit, Math.round((radius / side) * whole))) },
  }
}

function cornersSet(radius: number, size: Size): Rounded {
  return roundedShape(Math.min(radius, shortSide(size) / 2), size)
}

function cornersKeptOn(radius: number | undefined, before: Box | null, after: Size): Rounded | null {
  if (radius === undefined || !(radius > 0) || before === null || !(shortSide(after) > 0)) return null
  return shortSide(before) === shortSide(after) ? null : roundedShape(radius, after)
}

function roundable(view: ScopedElement, input: Readonly<Record<string, unknown>>): boolean {
  const preset = view.outline?.preset
  return input.shape === undefined && (preset === "rect" || preset === "roundRect")
}

function roundedEdit(change: SetChange, view: ScopedElement, placed: Readonly<Record<string, unknown>> | null) {
  const size =
    placed !== null && typeof placed.w === "number" && typeof placed.h === "number"
      ? { cx: placed.w, cy: placed.h }
      : view.box
  if (size === null) return null
  const corners = change.geometry?.corners
  if (corners !== undefined) return cornersSet(corners, size)
  if (placed === null || change.geometry !== undefined || view.shown !== undefined) return null
  return cornersKeptOn(view.corners, view.box, size)
}

export function cornersOf(...args: Parameters<typeof cornersNow>): { readonly corners?: number } {
  const corners = cornersNow(...args)
  return corners === undefined ? {} : { corners }
}

export function cornersRefusals(view: ScopedElement, input: SetChange["geometry"]): readonly ChangeRefusal[] {
  if (input?.corners === undefined || roundable(view, input)) return []
  return [{ node: view.node, trait: "geometry", code: "kind" }]
}

export function roundedPatch(change: SetChange, view: ScopedElement, placed: Readonly<Record<string, unknown>> | null) {
  const rounded = roundedEdit(change, view, placed)
  return rounded === null ? {} : { geometry: { shape: { set: rounded } } }
}
