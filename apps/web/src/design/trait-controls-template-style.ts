import { designCopy } from "@/copy/design-copy"
import { templateStyleCopy } from "@/copy/template-style-copy"
import type { TraitControls } from "./trait-controls"

export const templateStyleControls: TraitControls<"templateStyle"> = {
  section: templateStyleCopy.section,
  fields: {
    id: { label: designCopy.chooseTemplateStyle },
    name: { label: templateStyleCopy.name },
    dk1: { label: templateStyleCopy.dk1 },
    lt1: { label: templateStyleCopy.lt1 },
    dk2: { label: templateStyleCopy.dk2 },
    lt2: { label: templateStyleCopy.lt2 },
    accent1: { label: templateStyleCopy.accent1 },
    accent2: { label: templateStyleCopy.accent2 },
    accent3: { label: templateStyleCopy.accent3 },
    accent4: { label: templateStyleCopy.accent4 },
    accent5: { label: templateStyleCopy.accent5 },
    accent6: { label: templateStyleCopy.accent6 },
    hlink: { label: templateStyleCopy.hlink },
    folHlink: { label: templateStyleCopy.folHlink },
    major: { label: templateStyleCopy.major },
    minor: { label: templateStyleCopy.minor },
    custom: { label: templateStyleCopy.custom },
    removed: { label: templateStyleCopy.removed },
    textStyle: { label: templateStyleCopy.textStyle },
  },
}
