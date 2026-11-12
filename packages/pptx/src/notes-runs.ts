import { readNotes, writeNotes } from "./notes-body.js"
import { freePart, linkedPart, notesMasterOf } from "./notes-part.js"
import { contentTypesPart, presentationPart, presentationRels, relsOf, slideAddresses } from "./package-address.js"
import type { RouteRun } from "./route-parts.js"
import type { PartTouch } from "./slide-touch.js"

type Parts = ReadonlyMap<string, Uint8Array>

const firstText = "First speaker notes & a second line\nContinue here."

function firstTouch(parts: Parts, slide: string): PartTouch {
  const notes = freePart(parts, "ppt/notesSlides/notesSlide")
  const own = { changed: [contentTypesPart, relsOf(slide)], added: [notes, relsOf(notes)], removed: [] }
  if (notesMasterOf(parts) !== null) return own
  const theme = linkedPart(parts, linkedPart(parts, presentationPart, "slideMaster") ?? "", "theme") ?? ""
  const copy = freePart(parts, "ppt/theme/theme")
  const master = freePart(parts, "ppt/notesMasters/notesMaster")
  return {
    changed: [...own.changed, presentationPart, presentationRels],
    added: [...own.added, master, relsOf(master), copy, ...(parts.has(relsOf(theme)) ? [relsOf(copy)] : [])],
    removed: [],
  }
}

function firstNotesRun(parts: Parts): RouteRun[] {
  const bare = slideAddresses(parts).find(({ part }) => linkedPart(parts, part, "notesSlide") === null)
  if (bare === undefined) return []
  try {
    const touch = firstTouch(parts, bare.part)
    return [
      {
        operation: "notes.new",
        route: "notes.new",
        edit: null,
        touch,
        parts: writeNotes(parts, bare.slide, firstText),
        error: null,
      },
    ]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [{ operation: "notes.new", route: "notes.new", edit: null, touch: null, parts: null, error: message }]
  }
}

export function notesRuns(parts: Parts): RouteRun[] {
  const notes = readNotes(parts)[0]
  const edited: RouteRun[] =
    notes === undefined
      ? []
      : [
          {
            operation: "notes.body",
            route: "notes.body",
            edit: null,
            touch: { changed: [notes.part], added: [], removed: [] },
            parts: writeNotes(parts, notes.slide, "Edited speaker notes & a second line\nContinue here."),
            error: null,
          },
        ]
  return [...edited, ...firstNotesRun(parts)]
}
