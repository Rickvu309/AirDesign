import { pastedMedia } from "@airdesign/document"
import { mediaTypes, type MediaType } from "@airdesign/doom"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { xmlAttribute } from "./shape-write.js"
import { shapeById } from "./shape-tree.js"

type Parts = ReadonlyMap<string, Uint8Array>

export type CarriedImage = { readonly bytes: Uint8Array; readonly type: MediaType }

export type CarriedShape = { readonly markup: string; readonly images: readonly CarriedImage[] }

const imageType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
const dropped = new Set(["a:hlinkClick", "a:hlinkHover", "a:hlinkMouseOver", "p:custDataLst", "a:ext"])
const extensions: Readonly<Record<string, MediaType>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
}

function valueOf(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function imageOf(parts: Parts, part: string, id: string): string | null {
  const rels = parts.get(relsOf(part))
  if (rels === undefined) return null
  const link = requireMarkup(rels).elements.find(
    (element) => element.kind === "Relationship" && valueOf(element, "Id") === id,
  )
  const target = link === undefined ? null : valueOf(link, "Target")
  if (link === undefined || target === null || valueOf(link, "TargetMode") === "External") return null
  return valueOf(link, "Type") === imageType ? partOf(part, target) : null
}

function droppedAround(marks: readonly MarkupElement[], element: MarkupElement): MarkupElement | null {
  for (let at: MarkupElement | undefined = element; at !== undefined; at = marks[at.parent]) {
    if (dropped.has(at.kind)) return at
    if (at.parent < 0) return null
  }
  return null
}

function prefixes(marks: readonly MarkupElement[]): ReadonlySet<string> {
  const used = new Set<string>()
  const add = (name: string) => {
    const at = name.indexOf(":")
    if (at > 0) used.add(name.slice(0, at))
  }
  for (const element of marks) {
    add(element.kind)
    for (const item of element.attributes) {
      if (!item.name.startsWith("xmlns") && !item.name.startsWith("xml:")) add(item.name)
      if (item.name === "Requires" || item.name === "mc:Ignorable")
        for (const named of item.value.split(/\s+/)) if (named !== "") used.add(named)
    }
  }
  return used
}

export function carriedShape(parts: Parts, part: string, shape: string): CarriedShape | null {
  const bytes = partBytes(parts, part)
  const document = requireMarkup(bytes)
  const found = shapeById(document.elements, shape)
  const piece = new Uint8Array(bytes.subarray(found.start, found.end))
  const marks = requireMarkup(piece).elements
  const images: CarriedImage[] = []
  const imageParts: string[] = []
  const removed: MarkupElement[] = []
  const edits: ByteEdit[] = []
  for (const element of marks) {
    for (const item of element.attributes) {
      if (!item.name.startsWith("r:")) continue
      const image = item.name === "r:embed" ? imageOf(parts, part, item.value) : null
      const type = image === null ? undefined : extensions[image.split(".").pop()?.toLowerCase() ?? ""]
      const held = image === null ? undefined : parts.get(image)
      if (image !== null && type !== undefined && held !== undefined && mediaTypes.includes(type)) {
        if (!imageParts.includes(image)) {
          imageParts.push(image)
          images.push({ bytes: held, type })
        }
        edits.push({
          start: item.valueStart,
          end: item.valueEnd,
          next: encodeUtf8(pastedMedia(imageParts.indexOf(image))),
        })
        continue
      }
      const around = droppedAround(marks, element)
      if (around === null) return null
      if (!removed.includes(around)) removed.push(around)
    }
  }
  const kept = edits.filter((edit) => !removed.some((each) => edit.start >= each.start && edit.end <= each.end))
  const cuts = removed.filter(
    (each) => !removed.some((other) => other !== each && each.start >= other.start && each.end <= other.end),
  )
  const root = marks.find((element) => element.parent < 0)
  const names = new Map(
    (document.elements.find((element) => element.parent < 0)?.attributes ?? []).flatMap((item) =>
      item.name.startsWith("xmlns:") ? [[item.name.slice("xmlns:".length), item.value] as const] : [],
    ),
  )
  if (root === undefined) return null
  const declared = new Set(
    marks.flatMap((element) =>
      element.attributes.flatMap((item) => (item.name.startsWith("xmlns:") ? [item.name.slice("xmlns:".length)] : [])),
    ),
  )
  const owed = [...prefixes(marks)].filter((prefix) => !declared.has(prefix) && names.has(prefix))
  const at = root.start + 1 + root.kind.length
  const named = owed.map((prefix) => ` xmlns:${prefix}="${xmlAttribute(names.get(prefix) ?? "")}"`).join("")
  const cut = cuts.map((each) => ({ start: each.start, end: each.end, next: new Uint8Array() }))
  return {
    markup: decodeUtf8(spliceBytes(piece, [...kept, ...cut, { start: at, end: at, next: encodeUtf8(named) }])),
    images,
  }
}
