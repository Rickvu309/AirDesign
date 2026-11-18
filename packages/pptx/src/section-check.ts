import { markupDocument, type MarkupElement } from "./element-span.js"
import { presentationPart } from "./package-address.js"
import { decodeUtf8 } from "./package-bytes.js"

type Parts = ReadonlyMap<string, Uint8Array>

const guid = /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/
const zoomObjects = new Set(["sectionZmObj", "summaryZmObj"])

function attributeOf(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((item) => item.name === name)?.value
}

function localName(kind: string): string {
  return kind.slice(kind.indexOf(":") + 1)
}

type SectionReference = { readonly part: string; readonly id: string }

function zoomReferences(parts: Parts): SectionReference[] {
  const found: SectionReference[] = []
  for (const [part, bytes] of parts) {
    if (!part.endsWith(".xml")) continue
    if (!decodeUtf8(bytes).includes("sectionId=")) continue
    for (const element of markupDocument(bytes).elements) {
      if (!zoomObjects.has(localName(element.kind))) continue
      const id = attributeOf(element, "sectionId")
      if (id !== undefined) found.push({ part, id })
    }
  }
  return found
}

export function sectionReferences(parts: Parts): ReadonlySet<string> {
  return new Set(zoomReferences(parts).map((reference) => reference.id))
}

function referenceFailures(parts: Parts, known: ReadonlySet<string>): string[] {
  return zoomReferences(parts).flatMap(({ part, id }) =>
    known.has(id) ? [] : [`reference: ${part} names section ${id}, which the section list does not have`],
  )
}

function idFailures(sections: readonly MarkupElement[]): string[] {
  const failures: string[] = []
  const firstWith = new Map<string, number>()
  for (const [index, section] of sections.entries()) {
    const id = attributeOf(section, "id")
    if (id === undefined) {
      failures.push(`id: section ${index + 1} has no id`)
      continue
    }
    if (!guid.test(id)) failures.push(`id: section ${index + 1} has id ${id}, which is not a GUID`)
    const earlier = firstWith.get(id)
    if (earlier === undefined) firstWith.set(id, index)
    else failures.push(`id: sections ${earlier + 1} and ${index + 1} have id ${id}`)
  }
  return failures
}

export function sectionListFailures(parts: Parts): readonly string[] {
  const bytes = parts.get(presentationPart)
  if (bytes === undefined) return []
  const elements = markupDocument(bytes).elements
  const lists = new Set(elements.filter((element) => element.kind === "p14:sectionLst").map((list) => list.index))
  const sections = elements
    .filter((element) => element.kind === "p14:section" && lists.has(element.parent))
    .sort((left, right) => left.start - right.start)
  const order = elements
    .filter((element) => element.kind === "p:sldId" && element.id !== null)
    .sort((left, right) => left.start - right.start)
    .map((element) => element.id ?? "")
  const known = new Set(sections.flatMap((section) => attributeOf(section, "id") ?? []))
  if (lists.size === 0) return referenceFailures(parts, known)
  const inDeck = new Set(order)
  const listed = sections.map((section) => {
    const slideList = elements.find((element) => element.kind === "p14:sldIdLst" && element.parent === section.index)
    return elements
      .filter((element) => element.kind === "p14:sldId" && element.parent === slideList?.index)
      .sort((left, right) => left.start - right.start)
      .map((element) => element.id ?? "")
  })
  const failures: string[] = []
  const counts = new Map<string, number>()
  for (const [index, slides] of listed.entries()) {
    for (const slide of slides) {
      counts.set(slide, (counts.get(slide) ?? 0) + 1)
      if (!inDeck.has(slide))
        failures.push(`slide: section ${index + 1} lists slide ${slide}, which is not in the deck`)
    }
  }
  for (const slide of order) {
    const count = counts.get(slide) ?? 0
    if (count === 0) failures.push(`cover: slide ${slide} is in no section`)
    if (count > 1) failures.push(`cover: slide ${slide} is in ${count} sections`)
  }
  const once = (slide: string) => inDeck.has(slide) && counts.get(slide) === 1
  const expected = order.filter(once)
  const runs = listed.flatMap((slides, index) => slides.filter(once).map((slide) => ({ slide, index })))
  const wrong = runs.findIndex((run, position) => run.slide !== expected[position])
  const found = runs[wrong]
  if (found !== undefined) {
    failures.push(
      `order: section ${found.index + 1} lists slide ${found.slide} where the deck has slide ${expected[wrong]}`,
    )
  }
  return [...failures, ...idFailures(sections), ...referenceFailures(parts, known)]
}
