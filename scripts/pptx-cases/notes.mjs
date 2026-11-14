import { notesExportLines, notesExportNames } from "../notes-export.mjs"

export default {
  specs: ["tests/browser/notes-export.spec.ts"],
  exports: notesExportNames,
  covers: ["notes.value"],
  lines: notesExportLines,
}
