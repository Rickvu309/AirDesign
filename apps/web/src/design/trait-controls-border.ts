import { appearanceCopy } from "@/copy/appearance-copy"
import { borderCopy } from "@/copy/border-copy"
import type { TraitControls } from "./trait-controls"

export const borderControls: TraitControls<"border"> = {
  section: appearanceCopy.border,
  fields: {
    fill: { label: borderCopy.color, reset: borderCopy.reset.fill },
    width: { label: borderCopy.width, reset: borderCopy.reset.width },
    dash: { label: borderCopy.dash, reset: borderCopy.reset.dash },
    cap: { label: borderCopy.cap, reset: borderCopy.reset.cap },
    compound: { label: borderCopy.compound, reset: borderCopy.reset.compound },
    join: { label: borderCopy.join, reset: borderCopy.reset.join },
    head: { label: borderCopy.head, reset: borderCopy.reset.head },
    tail: { label: borderCopy.tail, reset: borderCopy.reset.tail },
  },
}
