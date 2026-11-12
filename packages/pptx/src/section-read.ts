import type { FileSection } from "@airdesign/document"
import { decodedXmlText, markupDocument } from "./element-span.js"
import { presentationPart } from "./package-address.js"

export function readSections(parts: ReadonlyMap<string, Uint8Array>): readonly FileSection[] {
  const bytes = parts.get(presentationPart)
  if (bytes === undefined) return []
  const elements = markupDocument(bytes).elements
  const sections = elements.filter((element) => element.kind === "p14:section").sort((a, b) => a.start - b.start)
  if (sections.length === 0) return []
  const read: FileSection[] = []
  const seen = new Set<string>()
  for (const section of sections) {
    const slides: string[] = []
    for (const element of elements) {
      if (element.kind !== "p14:sldId" || element.id === null || element.start < section.start) continue
      if (element.end > section.end) continue
      slides.push(element.id)
      seen.add(element.id)
    }
    const name = decodedXmlText(section.attributes.find((item) => item.name === "name")?.value ?? "")
    read.push({ name, slides })
  }
  const listed = elements.flatMap((element) => (element.kind === "p:sldId" && element.id !== null ? [element.id] : []))
  const total = read.reduce((count, section) => count + section.slides.length, 0)
  if (seen.size !== total || listed.length !== seen.size || listed.some((id) => !seen.has(id))) return []
  return read
}

export type SectionStart = { readonly name: string; readonly start: number }

export function sectionStarts(parts: ReadonlyMap<string, Uint8Array>): readonly SectionStart[] {
  const sections = readSections(parts).filter((section) => section.slides.length > 0)
  const bytes = parts.get(presentationPart)
  if (sections.length === 0 || bytes === undefined) return []
  const order = markupDocument(bytes)
    .elements.filter((element) => element.kind === "p:sldId" && element.id !== null)
    .sort((a, b) => a.start - b.start)
    .flatMap((element) => (element.id === null ? [] : [element.id]))
  const starts: SectionStart[] = []
  let next = 0
  for (const section of sections) {
    const run = order.slice(next, next + section.slides.length)
    if (run.length !== section.slides.length || run.some((id, position) => id !== section.slides[position])) return []
    starts.push({ name: section.name, start: next })
    next += section.slides.length
  }
  return starts
}
