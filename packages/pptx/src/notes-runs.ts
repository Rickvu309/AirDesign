import { readNotes, writeNotes } from "./notes-body.js"
import type { RouteRun } from "./route-parts.js"

export function notesRuns(parts: ReadonlyMap<string, Uint8Array>): RouteRun[] {
  const notes = readNotes(parts)[0]
  if (notes === undefined) return []
  return [
    {
      operation: "notes.body",
      route: "notes.body",
      edit: null,
      touch: { changed: [notes.part], added: [], removed: [] },
      parts: writeNotes(parts, notes.slide, "Edited speaker notes & a second line\nContinue here."),
      error: null,
    },
  ]
}
