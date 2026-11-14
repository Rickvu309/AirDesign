import { fillCopy } from "@/copy/fill-copy"
import type { TraitControls } from "./trait-controls"

export const fillControls: TraitControls<"fill"> = {
  section: fillCopy.section,
  fields: { value: { label: fillCopy.value, reset: fillCopy.reset } },
}
