import { readNotes, writeNotes } from "./notes-body.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

const notesValue: PartCodec<string> = {
  read: (parts, at) => readNotes(parts).find((notes) => notes.slide === at.slide)?.text ?? null,
  write: (parts, at, value) => writeNotes(parts, at.slide, value),
}

export const notesXml: TraitXml<"notes"> = { slot: null, fields: { value: whole(notesValue) } }
