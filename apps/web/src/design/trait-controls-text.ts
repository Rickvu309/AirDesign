import { textCopy } from "@/copy/text-copy"
import type { TraitControls } from "./trait-controls"

export const textControls: TraitControls<"text"> = {
  section: textCopy.section,
  fields: { value: { label: textCopy.value } },
}
