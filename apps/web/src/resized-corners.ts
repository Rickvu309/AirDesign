import { keptCorners, presets, type Box } from "@airdesign/document"
import type { CanvasElement } from "@airdesign/render"
import type { BoxCommit } from "@/commit-edit"

export function resizedCorners(painted: CanvasElement | undefined, box: Box): Pick<BoxCommit, "corners"> {
  const geometry = painted?.geometry
  const from = painted?.box
  if (geometry === undefined || from === undefined || from === null) return {}
  const adjust = keptCorners(geometry.preset, geometry.adjusts, { cx: from.width, cy: from.height }, box)
  if (adjust === null) return {}
  const preset = presets.find((each) => each === geometry.preset)
  if (preset === undefined) return {}
  return { corners: { before: { preset, adjust: geometry.adjusts }, after: { preset, adjust } } }
}
