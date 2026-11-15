import { pictureCopy } from "@/copy/picture-copy"
import type { TraitControls } from "./trait-controls"

export const cropControls: TraitControls<"crop"> = {
  section: pictureCopy.crop,
  fields: { rect: { label: pictureCopy.crop } },
}
