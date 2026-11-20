import { frameCopy } from "@/copy/frame-copy"
import type { TraitControls } from "./trait-controls"

export const layoutControls: TraitControls<"layout"> = {
  section: frameCopy.autoLayout,
  fields: {
    flow: { label: frameCopy.flow },
    gap: { label: frameCopy.gap },
    padding: { label: frameCopy.padding },
    align: { label: frameCopy.align },
  },
}
