import { presentationPart, presentationRels, slideAddresses } from "./package-address.js"
import { linkedPart, notesMasterOf } from "./notes-part.js"
import { requireMarkup } from "./part-markup.js"

type Parts = ReadonlyMap<string, Uint8Array>

const notesSlide = /^ppt\/notesSlides\/[^/]+\.xml$/

function masterListed(parts: Parts): boolean {
  const presentation = parts.get(presentationPart)
  const rels = parts.get(presentationRels)
  if (presentation === undefined || rels === undefined) return false
  const listed = requireMarkup(presentation)
    .elements.filter((element) => element.kind === "p:notesMasterId")
    .map((element) => element.attributes.find((item) => item.name === "r:id")?.value)
  const master = requireMarkup(rels).elements.find(
    (element) =>
      element.kind === "Relationship" &&
      element.attributes.some((item) => item.name === "Type" && item.value.endsWith("/notesMaster")),
  )
  const id = master?.attributes.find((item) => item.name === "Id")?.value
  return listed.length === 1 && id !== undefined && listed[0] === id
}

export function notesLinkFailures(parts: Parts): readonly string[] {
  const failures: string[] = []
  for (const { part } of slideAddresses(parts)) {
    const notes = linkedPart(parts, part, "notesSlide")
    if (notes !== null && !parts.has(notes)) failures.push(`${part} notes`)
  }
  const notesParts = [...parts.keys()].filter((name) => notesSlide.test(name))
  for (const notes of notesParts) {
    const slide = linkedPart(parts, notes, "slide")
    if (slide === null || !parts.has(slide) || linkedPart(parts, slide, "notesSlide") !== notes)
      failures.push(`${notes} slide`)
    const master = linkedPart(parts, notes, "notesMaster")
    if (master === null || !parts.has(master)) failures.push(`${notes} master`)
  }
  if (notesParts.length > 0 && (notesMasterOf(parts) === null || !masterListed(parts)))
    failures.push("presentation notes master")
  return failures
}

export function newNotesLinkFailures(before: Parts, after: Parts): readonly string[] {
  const known = new Set(notesLinkFailures(before))
  return notesLinkFailures(after).filter((failure) => !known.has(failure))
}
