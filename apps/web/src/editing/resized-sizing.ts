import type { Box } from "@airdesign/document"
import type { CanvasElement } from "@airdesign/render"
import type { BoxCommit } from "@/editing/commit-edit"

export function resizedSizing(painted: CanvasElement | undefined, box: Box): Pick<BoxCommit, "sizing"> {
  const text = painted?.text
  const from = painted?.box
  if (text?.fit?.kind !== "grow" || from === undefined || from === null) return {}
  if (from.width === box.cx && from.height === box.cy) return {}
  return {
    sizing: {
      before: { autofit: { set: "grow" }, wrap: { set: text.wrap } },
      after: { autofit: { set: "none" }, wrap: { set: true } },
    },
  }
}
