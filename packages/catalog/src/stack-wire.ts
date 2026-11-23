import { readElementId, shapeOf, type ElementId, type Target } from "@airdesign/document"

export type Stack = "front" | "back" | { readonly above: ElementId } | { readonly below: ElementId }

const besideLayer = /^(above|below) (\S+)$/

export function readStack(raw: unknown, target: Target): Stack | null {
  if (!("node" in target) || typeof raw !== "string") return null
  if (raw === "front" || raw === "back") return raw
  const found = besideLayer.exec(raw)
  const other = readElementId(found?.[2])
  if (found === null || other === undefined) return null
  if (other === target.node || shapeOf(other).slide !== shapeOf(target.node).slide) return null
  return found[1] === "above" ? { above: other } : { below: other }
}
