import { pictureCopy } from "@/copy/picture-copy"
import type { TraitControls } from "./trait-controls"

export const imageControls: TraitControls<"image"> = {
  section: pictureCopy.section,
  fields: {
    mode: { label: pictureCopy.mode },
    source: { label: pictureCopy.source },
    recolor: { label: pictureCopy.recolor },
  },
}
