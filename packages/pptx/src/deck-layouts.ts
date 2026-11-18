import { markupDocument, type MarkupElement } from "./element-span.js"
import { partOf, presentationPart, relsOf } from "./package-address.js"

export type DeckLayout = {
  readonly part: string
  readonly name: string
  readonly type: string | null
}

type Parts = ReadonlyMap<string, Uint8Array>

function attr(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function targets(parts: Parts, owner: string, suffix: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>()
  const rels = parts.get(relsOf(owner))
  if (rels === undefined) return found
  for (const item of markupDocument(rels).elements) {
    if (item.kind !== "Relationship") continue
    const id = attr(item, "Id")
    const type = attr(item, "Type")
    const target = attr(item, "Target")
    if (id === null || type === null || target === null || !type.endsWith(suffix) || found.has(id)) continue
    found.set(id, partOf(owner, target))
  }
  return found
}

function referenced(parts: Parts, owner: string, kind: string, suffix: string): readonly string[] {
  const bytes = parts.get(owner)
  if (bytes === undefined) return []
  const by = targets(parts, owner, suffix)
  const found: string[] = []
  for (const item of markupDocument(bytes).elements) {
    if (item.kind !== kind) continue
    const part = by.get(attr(item, "r:id") ?? "")
    if (part !== undefined && !found.includes(part)) found.push(part)
  }
  return found
}

function described(parts: Parts, part: string): DeckLayout | null {
  const bytes = parts.get(part)
  if (bytes === undefined) return null
  const elements = markupDocument(bytes).elements
  const root = elements.find((item) => item.kind === "p:sldLayout")
  if (root === undefined) return null
  const name = elements.find((item) => item.kind === "p:cSld")
  return { part, name: (name === undefined ? null : attr(name, "name")) ?? "", type: attr(root, "type") }
}

export function deckMasters(parts: Parts): readonly string[] {
  return referenced(parts, presentationPart, "p:sldMasterId", "/slideMaster")
}

export function deckLayouts(parts: Parts): readonly DeckLayout[] {
  const layouts: DeckLayout[] = []
  for (const master of deckMasters(parts)) {
    for (const part of referenced(parts, master, "p:sldLayoutId", "/slideLayout")) {
      const layout = described(parts, part)
      if (layout !== null && !layouts.some((held) => held.part === part)) layouts.push(layout)
    }
  }
  return layouts
}
