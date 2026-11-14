import { notesCopy } from "@/copy/notes-copy"
import type { TraitControls } from "./trait-controls"

export const notesControls: TraitControls<"notes"> = {
  section: notesCopy.section,
  fields: { value: { label: notesCopy.value } },
}
