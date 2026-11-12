import type { PaintElement } from "@airdesign/pptx"
import { unshownCopy } from "@/copy/unshown-copy"
import type { PictureSource } from "@/picture-fill"

function formatOf(part: string): string | null {
  const name = part.split("/").pop() ?? ""
  const dot = name.lastIndexOf(".")
  return dot < 0 ? null : name.slice(dot + 1).toUpperCase() || null
}

export function unshownText(row: PaintElement, src: PictureSource): string | null {
  if (row.table !== undefined || row.diagram !== undefined) return null
  if (row.image !== null) return src(row.image) === null ? unshownCopy.picture(formatOf(row.image.part)) : null
  return row.kind === "p:graphicFrame" ? unshownCopy.frame : null
}
