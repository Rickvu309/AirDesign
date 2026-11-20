import { geometryCopy } from "@/copy/geometry-copy"
import type { TraitControls } from "./trait-controls"

export const geometryControls: TraitControls<"geometry"> = {
  section: geometryCopy.section,
  fields: { shape: { label: geometryCopy.shape }, corners: { label: geometryCopy.corners } },
}
