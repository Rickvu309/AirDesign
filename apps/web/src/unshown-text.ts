import { addedPicturePart, type PaintElement } from "@airdesign/pptx"
import { pictureCopy } from "@/copy/picture-copy"
import { unshownCopy } from "@/copy/unshown-copy"
import type { PictureSource } from "@/picture-fill"

function formatOf(part: string): string | null {
  const name = part.split("/").pop() ?? ""
  const dot = name.lastIndexOf(".")
  return dot < 0 ? null : name.slice(dot + 1).toUpperCase() || null
}

export function unshownText(row: PaintElement, src: PictureSource): string | null {
  if (row.diagram !== undefined || row.chart !== undefined) return null
  if (row.image !== null && src(row.image) !== null) return null
  if (row.image !== null && addedPicturePart(row.image.part)) return pictureCopy.uploading
  if (row.image !== null) return unshownCopy.picture(formatOf(row.image.part))
  return row.kind === "p:graphicFrame" ? unshownCopy.frame : null
}
