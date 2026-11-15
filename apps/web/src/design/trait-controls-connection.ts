import { connectionCopy } from "@/copy/connection-copy"
import type { TraitControls } from "./trait-controls"

export const connectionControls: TraitControls<"connection"> = {
  section: connectionCopy.section,
  fields: { start: { label: connectionCopy.start }, end: { label: connectionCopy.end } },
}
