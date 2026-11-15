import { bodyCopy } from "@/copy/body-copy"
import type { TraitControls } from "./trait-controls"

export const bodyControls: TraitControls<"body"> = {
  section: bodyCopy.section,
  fields: {
    insets: { label: bodyCopy.insets, reset: bodyCopy.reset.insets },
    anchor: { label: bodyCopy.anchor, reset: bodyCopy.reset.anchor },
    wrap: { label: bodyCopy.wrap, reset: bodyCopy.reset.wrap },
    autofit: { label: bodyCopy.autofit, reset: bodyCopy.reset.autofit },
    vertical: { label: bodyCopy.vertical, reset: bodyCopy.reset.vertical },
    columns: { label: bodyCopy.columns, reset: bodyCopy.reset.columns },
  },
}
