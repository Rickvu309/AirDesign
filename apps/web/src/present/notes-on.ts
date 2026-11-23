import type { SlideNotes } from "@airdesign/pptx"

export type ShownNotes = Pick<SlideNotes, "slide" | "text">

export function notesOn(notes: readonly ShownNotes[], slide: string | undefined): string {
  if (slide === undefined) return ""
  return notes.find((each) => each.slide === slide)?.text ?? ""
}
