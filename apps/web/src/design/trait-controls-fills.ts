import { fillCopy } from "@/copy/fill-copy"
import type { TraitControls } from "./trait-controls"

export const fillsControls: TraitControls<"fills"> = {
  section: fillCopy.section,
  fields: { paint: { label: fillCopy.value, reset: fillCopy.reset } },
}
