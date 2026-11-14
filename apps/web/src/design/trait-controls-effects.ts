import { effectsCopy } from "@/copy/effects-copy"
import type { TraitControls } from "./trait-controls"

export const effectsControls: TraitControls<"effects"> = {
  section: effectsCopy.section,
  fields: {
    shadow: { label: effectsCopy.shadow },
    glow: { label: effectsCopy.glow },
    softEdge: { label: effectsCopy.softEdge },
  },
}
