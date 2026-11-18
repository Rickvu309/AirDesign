import { landedPatch, templateStyleNode, templateStylesNode, type ElementId, type Register } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { deckMasters } from "./deck-layouts.js"
import { contentTypesPart, partOf, presentationPart, presentationRels, relsOf } from "./package-address.js"
import { cut, replacePart, requireMarkup } from "./part-markup.js"
import { readSlides } from "./read-shapes.js"
import { slideTheme } from "./theme-swatches.js"
import { templateStyles } from "./template-style.js"
import type { Parts } from "./xml-codec.js"

function attr(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function relationships(parts: Parts, owner: string): readonly MarkupElement[] {
  const rels = parts.get(relsOf(owner))
  if (rels === undefined) return []
  return markupDocument(rels).elements.filter((element) => element.kind === "Relationship")
}

function targets(parts: Parts, owner: string, suffix: string): readonly string[] {
  const found: string[] = []
  for (const item of relationships(parts, owner)) {
    const type = attr(item, "Type")
    const target = attr(item, "Target")
    if (type === null || target === null || attr(item, "TargetMode") === "External" || !type.endsWith(suffix)) continue
    const part = partOf(owner, target)
    if (!found.includes(part)) found.push(part)
  }
  return found
}

function themeOf(parts: Parts, master: string): string | null {
  return targets(parts, master, "/theme")[0] ?? null
}

function removed(register: Register, node: ElementId): boolean {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  if (body === undefined) return false
  const edit = landedPatch(body, "text").templateStyle?.removed
  return typeof edit === "object" && edit.set === true
}

function flagged(parts: Parts, register: Register): ReadonlySet<string> {
  const styles = register.index?.templateStyles ?? templateStyles(parts)
  const ids = new Set<string>()
  if (removed(register, templateStylesNode)) for (const style of styles) ids.add(style.id)
  styles.forEach((style, index) => {
    if (removed(register, templateStyleNode(index))) ids.add(style.id)
  })
  return ids
}

function used(parts: Parts, id: string): boolean {
  return readSlides(parts).some((slide) => slideTheme(parts, slide.part) === id)
}

function exclusiveMedia(parts: Parts, gone: ReadonlySet<string>): readonly string[] {
  const media = new Set<string>()
  for (const part of gone) {
    for (const item of relationships(parts, part)) {
      const target = attr(item, "Target")
      if (target === null || attr(item, "TargetMode") === "External") continue
      const resolved = partOf(part, target)
      if (resolved.startsWith("ppt/media/")) media.add(resolved)
    }
  }
  const kept = [...parts.keys()].filter((name) => name.endsWith(".rels") && !gone.has(relsOwnerOf(name) ?? ""))
  for (const rels of kept) {
    const owner = relsOwnerOf(rels)
    if (owner === null) continue
    for (const item of markupDocument(parts.get(rels) ?? new Uint8Array()).elements) {
      if (item.kind !== "Relationship") continue
      const target = attr(item, "Target")
      if (target !== null) media.delete(partOf(owner, target))
    }
  }
  return [...media]
}

function relsOwnerOf(rels: string): string | null {
  const marker = "/_rels/"
  const at = rels.lastIndexOf(marker)
  if (at < 0 || !rels.endsWith(".rels")) return null
  return `${rels.slice(0, at)}/${rels.slice(at + marker.length, -".rels".length)}`
}

function cutAll(bytes: Uint8Array, elements: readonly MarkupElement[]): Uint8Array {
  let next = bytes
  for (const element of [...elements].sort((left, right) => right.start - left.start))
    next = cut(next, element.start, element.end)
  return next
}

function dropTheme(parts: Map<string, Uint8Array>, id: string): boolean {
  if (!parts.has(id) || used(parts, id)) return false
  const masters = deckMasters(parts)
  const dropping = masters.filter((master) => themeOf(parts, master) === id)
  if (dropping.length === 0 || dropping.length >= masters.length) return false
  const droppingSet = new Set(dropping)
  const layoutsOf = (master: string) => targets(parts, master, "/slideLayout")
  const keptLayouts = new Set(masters.filter((master) => !droppingSet.has(master)).flatMap(layoutsOf))
  const slideLayouts = new Set(readSlides(parts).flatMap((slide) => targets(parts, slide.part, "/slideLayout")))
  const layouts = dropping.flatMap(layoutsOf).filter((layout) => !keptLayouts.has(layout) && !slideLayouts.has(layout))
  const gone = new Set<string>([id, ...dropping, ...layouts])
  for (const media of exclusiveMedia(parts, gone)) gone.add(media)
  const presentation = parts.get(presentationPart)
  const rels = parts.get(presentationRels)
  if (presentation === undefined || rels === undefined) return false
  const masterRel = new Map(
    relationships(parts, presentationPart).flatMap((item) => {
      const rid = attr(item, "Id")
      const target = attr(item, "Target")
      return rid === null || target === null ? [] : [[rid, partOf(presentationPart, target)] as const]
    }),
  )
  const masterIds = requireMarkup(presentation).elements.filter(
    (element) => element.kind === "p:sldMasterId" && droppingSet.has(masterRel.get(attr(element, "r:id") ?? "") ?? ""),
  )
  replacePart(parts, presentationPart, cutAll(presentation, masterIds))
  for (const [name, bytes] of [...parts]) {
    if (!name.endsWith(".rels") || gone.has(relsOwnerOf(name) ?? "")) continue
    const owner = relsOwnerOf(name)
    if (owner === null) continue
    const linked = markupDocument(bytes).elements.filter((element) => {
      if (element.kind !== "Relationship") return false
      const target = attr(element, "Target")
      return target !== null && gone.has(partOf(owner, target))
    })
    if (linked.length > 0) replacePart(parts, name, cutAll(bytes, linked))
  }
  const types = parts.get(contentTypesPart)
  if (types !== undefined) {
    const overrides = requireMarkup(types).elements.filter(
      (element) => element.kind === "Override" && gone.has((attr(element, "PartName") ?? "").replace(/^\//, "")),
    )
    if (overrides.length > 0) replacePart(parts, contentTypesPart, cutAll(types, overrides))
  }
  for (const part of gone) {
    parts.delete(part)
    parts.delete(relsOf(part))
  }
  return true
}

export function dropUnusedTemplates(parts: Parts, register: Register): Parts {
  const ids = flagged(parts, register)
  if (ids.size === 0) return parts
  const next = new Map(parts)
  let changed = false
  for (const id of ids) changed = dropTheme(next, id) || changed
  return changed ? next : parts
}
