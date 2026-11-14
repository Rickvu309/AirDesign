import { tableCopy } from "@/copy/table-copy"
import type { TraitControls } from "./trait-controls"

export const tableControls: TraitControls<"table"> = {
  section: tableCopy.section,
  fields: { value: { label: tableCopy.cells } },
}
