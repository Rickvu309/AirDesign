import type { ShownNotes } from "@/notes-edit"

export function notesOn(notes: readonly ShownNotes[], slide: string | undefined): string {
  if (slide === undefined) return ""
  return notes.find((each) => each.slide === slide)?.text ?? ""
}
