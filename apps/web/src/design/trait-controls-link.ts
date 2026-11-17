import { linkCopy } from "@/copy/link-copy"
import type { TraitControls } from "./trait-controls"

export const linkControls: TraitControls<"link"> = {
  section: linkCopy.section,
  fields: { target: { label: linkCopy.target } },
}
