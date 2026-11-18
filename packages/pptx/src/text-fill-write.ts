import { spliceBytes } from "./element-span.js"
import { imageMarkup } from "./fill-markup.js"
import { encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { withRunFill } from "./run-color.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren } from "./text-value-route.js"
import { runOwner, type LinkAt } from "./trait-xml-link.js"
import type { Parts } from "./xml-codec.js"

export function writtenRunImage(
  parts: Parts,
  at: LinkAt & { readonly paragraph: number; readonly run: number },
  ref: string,
): Parts {
  const next = new Map(parts)
  const bytes = next.get(at.part)
  if (bytes === undefined) return parts
  const { elements } = requireMarkup(bytes)
  const found = runOwner(bytes, markupChildren(elements), shapeById(elements, at.shape), at.paragraph, at.run)
  if (found === null || found.holder.kind !== "a:rPr") throw new Error("text-fill-image")
  const { holder } = found
  const written = imageMarkup(next, at, ref)
  const filled = withRunFill(bytes.subarray(holder.start, holder.end), encodeUtf8(written.xml))
  next.set(at.part, spliceBytes(bytes, [{ start: holder.start, end: holder.end, next: filled }]))
  return next
}
