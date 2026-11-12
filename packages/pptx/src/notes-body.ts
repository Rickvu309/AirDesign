import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { partOf, relsOf, slideAddresses } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { notesBodyShape, notesParagraphs, newNotes } from "./notes-part.js"
import { holderText } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>
export type SlideNotes = { readonly slide: string; readonly part: string; readonly text: string }

function attr(element: MarkupElement, name: string) {
  return element.attributes.find((attribute) => attribute.name === name)?.value
}

function notesPart(parts: Parts, slide: string): string | null {
  const rels = parts.get(relsOf(slide))
  if (rels === undefined) return null
  const links = markupDocument(rels).elements.filter(
    (element) =>
      element.kind === "Relationship" &&
      attr(element, "Type")?.endsWith("/notesSlide") &&
      attr(element, "TargetMode") !== "External",
  )
  const target = links.length === 1 ? attr(links[0]!, "Target") : undefined
  return target === undefined ? null : partOf(slide, target)
}

function notesBody(bytes: Uint8Array) {
  const document = markupDocument(bytes)
  if (!document.wellFormed) return null
  const elements = document.elements
  const bodies = elements.filter((element) => element.kind === "p:ph" && attr(element, "type") === "body")
  if (bodies.length !== 1) return null
  let shape = elements[bodies[0]!.parent]
  while (shape !== undefined && shape.kind !== "p:sp") shape = elements[shape.parent]
  if (shape === undefined) return null
  const body = elements.find((element) => element.parent === shape.index && element.kind === "p:txBody")
  if (body === undefined || body.selfClosing) return null
  const paragraphs = elements.filter((element) => element.parent === body.index && element.kind === "a:p")
  if (paragraphs.length === 0) return null
  const text = paragraphs
    .map((paragraph) => {
      const inlines = elements.filter(
        (element) => element.parent === paragraph.index && ["a:r", "a:fld", "a:br"].includes(element.kind),
      )
      return inlines
        .map((inline) =>
          inline.kind === "a:br"
            ? "\n"
            : holderText(
                bytes,
                elements.find((element) => element.parent === inline.index && element.kind === "a:t"),
              ),
        )
        .join("")
    })
    .join("\n")
  return { paragraphs, text }
}

export function readNotes(parts: Parts): readonly SlideNotes[] {
  return slideAddresses(parts).flatMap(({ slide, part }) => {
    const notes = notesPart(parts, part)
    const bytes = notes === null ? undefined : parts.get(notes)
    const body = bytes === undefined ? null : notesBody(bytes)
    return notes === null || body === null ? [] : [{ slide, part: notes, text: body.text }]
  })
}

export function writeNotes(parts: Parts, slide: string, text: string): Map<string, Uint8Array> {
  const notes = readNotes(parts).find((notes) => notes.slide === slide)
  if (notes === undefined) return firstNotes(parts, slide, text)
  if (notes.text === text) return new Map(parts)
  const bytes = parts.get(notes.part)!
  const body = notesBody(bytes)!
  const xml = notesParagraphs(text)
  const next = new Map(parts)
  const edits = body.paragraphs.map((paragraph, index) => ({
    start: paragraph.start,
    end: paragraph.end,
    next: encodeUtf8(index === 0 ? xml : ""),
  }))
  next.set(notes.part, spliceBytes(bytes, edits))
  return next
}

function firstNotes(parts: Parts, slide: string, text: string): Map<string, Uint8Array> {
  const part = slideAddresses(parts).find((address) => address.slide === slide)?.part
  if (part === undefined) throw new Error("notes-body")
  if (text === "") return new Map(parts)
  const existing = notesPart(parts, part)
  const next = new Map(parts)
  if (existing === null) {
    newNotes(next, part, text)
    return next
  }
  const bytes = parts.get(existing)
  const document = bytes === undefined ? null : markupDocument(bytes)
  const tree = document?.elements.find((element) => element.kind === "p:spTree")
  if (bytes === undefined || document === null || !document.wellFormed || tree === undefined || tree.selfClosing)
    throw new Error("notes-body")
  const ids = document.elements.flatMap((element) =>
    element.kind === "p:cNvPr" ? [Number(attr(element, "id") ?? 0) || 0] : [],
  )
  next.set(
    existing,
    spliceBytes(bytes, [
      { start: tree.closeStart, end: tree.closeStart, next: encodeUtf8(notesBodyShape(Math.max(1, ...ids) + 1, text)) },
    ]),
  )
  return next
}
