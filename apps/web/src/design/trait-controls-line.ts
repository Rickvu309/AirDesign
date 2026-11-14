import { lineCopy } from "@/copy/line-copy"
import type { TraitControls } from "./trait-controls"

export const lineControls: TraitControls<"line"> = {
  section: lineCopy.section,
  fields: {
    fill: { label: lineCopy.fill, reset: lineCopy.reset.fill },
    width: { label: lineCopy.width, reset: lineCopy.reset.width },
    dash: { label: lineCopy.dash, reset: lineCopy.reset.dash },
    cap: { label: lineCopy.cap, reset: lineCopy.reset.cap },
    compound: { label: lineCopy.compound, reset: lineCopy.reset.compound },
    join: { label: lineCopy.join, reset: lineCopy.reset.join },
    head: { label: lineCopy.head, reset: lineCopy.reset.head },
    tail: { label: lineCopy.tail, reset: lineCopy.reset.tail },
  },
}
