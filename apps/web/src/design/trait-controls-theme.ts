import { themeCopy } from "@/copy/theme-copy"
import type { TraitControls } from "./trait-controls"

export const themeControls: TraitControls<"theme"> = {
  section: themeCopy.section,
  fields: {
    dk1: { label: themeCopy.dk1 },
    lt1: { label: themeCopy.lt1 },
    dk2: { label: themeCopy.dk2 },
    lt2: { label: themeCopy.lt2 },
    accent1: { label: themeCopy.accent1 },
    accent2: { label: themeCopy.accent2 },
    accent3: { label: themeCopy.accent3 },
    accent4: { label: themeCopy.accent4 },
    accent5: { label: themeCopy.accent5 },
    accent6: { label: themeCopy.accent6 },
    hlink: { label: themeCopy.hlink },
    folHlink: { label: themeCopy.folHlink },
    major: { label: themeCopy.major },
    minor: { label: themeCopy.minor },
  },
}
