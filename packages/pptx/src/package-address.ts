import { markupDocument, type MarkupElement } from "./element-span.js"

export type SlideAddress = {
  readonly slide: string
  readonly part: string
}

export function partOf(source: string, target: string): string {
  const path = target.startsWith("/") ? [] : source.split("/").slice(0, -1)
  for (const segment of target.split("/")) {
    if (segment === "..") path.pop()
    else if (segment !== "." && segment !== "") path.push(segment)
  }
  return path.join("/")
}

export function relsOf(part: string): string {
  const path = part.split("/")
  const name = path.pop() ?? ""
  return [...path, "_rels", `${name}.rels`].join("/")
}

export const presentationPart = "ppt/presentation.xml"
export const presentationRels = relsOf(presentationPart)

const attribute = (element: MarkupElement, name: string): string | null => {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

export function slideAddresses(parts: ReadonlyMap<string, Uint8Array>): readonly SlideAddress[] {
  const presentation = parts.get(presentationPart)
  const rels = parts.get(presentationRels)
  if (presentation === undefined || rels === undefined) return []
  const targets = new Map<string, string | null>()
  for (const item of markupDocument(rels).elements) {
    if (item.kind !== "Relationship") continue
    const id = attribute(item, "Id")
    if (id === null || targets.has(id)) continue
    const target = attribute(item, "Target")
    if (target === null || target === "") continue
    const type = attribute(item, "Type")
    targets.set(id, type !== null && !type.endsWith("/slide") ? null : partOf(presentationPart, target))
  }
  const addresses: SlideAddress[] = []
  for (const element of markupDocument(presentation).elements) {
    if (element.kind !== "p:sldId" || element.id === null) continue
    const id = attribute(element, "r:id")
    if (id === null) continue
    const part = targets.get(id)
    if (part === undefined || part === null) continue
    addresses.push({ slide: element.id, part })
  }
  return addresses
}

export function slidePart(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  return slideAddresses(parts).find((address) => address.slide === slide)?.part ?? null
}
