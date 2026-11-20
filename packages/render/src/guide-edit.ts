import type { Guide } from "@airdesign/document"
import { nearestLine, type Axis, type SnapTargets } from "./snapping.js"

export type GuideEditName = "add-guide" | "move-guide" | "delete-guide"

export type GuideEdit = { readonly guides: readonly Guide[]; readonly name: GuideEditName }

export type GuideRelease = {
  readonly from: number | null
  readonly axis: Axis
  readonly offset: number
  readonly away: boolean
}

export function guideAt(pointer: number, origin: number, pixelsPerEmu: number): number {
  return Math.round((pointer - origin) / pixelsPerEmu)
}

export function snappedGuide(axis: Axis, offset: number, targets: SnapTargets, reach: number): number {
  const line =
    axis === "x"
      ? { left: offset, right: offset, top: 0, bottom: 0 }
      : { left: 0, right: 0, top: offset, bottom: offset }
  const found = nearestLine(line, { layers: targets.layers, slide: targets.slide }, axis, ["start"], reach)
  return found === null ? offset : offset + found.offset
}

export function guideDrop(guides: readonly Guide[], release: GuideRelease): GuideEdit | null {
  const { from, axis, offset, away } = release
  if (from === null) return away ? null : { name: "add-guide", guides: [...guides, { axis, offset }] }
  const held = guides[from]
  if (held === undefined) return null
  if (away) return { name: "delete-guide", guides: guides.filter((_, index) => index !== from) }
  if (held.offset === offset) return null
  return { name: "move-guide", guides: guides.map((guide, index) => (index === from ? { axis, offset } : guide)) }
}
