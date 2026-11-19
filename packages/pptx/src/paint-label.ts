import { decodedXmlText } from "./element-span.js"
import { attr, type Drawn } from "./paint-sheet.js"
import { lockedAt } from "./shape-locks.js"
import type { MarkupChildren } from "./text-value-route.js"

export type PaintLabel = { name?: string; alt?: string; locked?: true }

export function labelOf(item: Drawn, children: MarkupChildren): PaintLabel {
  const name = attr(item.identity, "name")
  const alt = attr(item.identity, "descr")
  return {
    ...(name === null || name === "" ? {} : { name: decodedXmlText(name) }),
    ...(alt === null || alt === "" ? {} : { alt: decodedXmlText(alt) }),
    ...(lockedAt(children, item.identity) ? { locked: true as const } : {}),
  }
}
