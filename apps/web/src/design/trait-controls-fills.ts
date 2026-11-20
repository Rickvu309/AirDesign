import { fillCopy } from "@/copy/fill-copy"
import { pictureCopy } from "@/copy/picture-copy"
import type { TraitControls } from "./trait-controls"

export const fillsControls: TraitControls<"fills"> = {
  section: fillCopy.section,
  fields: {
    paint: { label: fillCopy.value, reset: fillCopy.reset },
    mode: { label: pictureCopy.mode },
    tileScale: { label: pictureCopy.tileScale },
    source: { label: pictureCopy.source },
    weight: { label: pictureCopy.weight },
    crop: { label: pictureCopy.crop },
    recolor: { label: pictureCopy.recolor },
    overlay: { label: pictureCopy.overlay },
    blur: { label: pictureCopy.blur },
  },
}
