import { boxCopy } from "@/copy/box-copy"
import type { TraitControls } from "./trait-controls"

export const boxControls: TraitControls<"box"> = {
  section: boxCopy.section,
  fields: {
    x: { label: boxCopy.x },
    y: { label: boxCopy.y },
    w: { label: boxCopy.w },
    h: { label: boxCopy.h },
    rot: { label: boxCopy.rot },
    flipH: { label: boxCopy.flipH },
    flipV: { label: boxCopy.flipV },
    align: { label: boxCopy.align },
    distribute: { label: boxCopy.distribute },
  },
}
