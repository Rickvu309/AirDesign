import { identityCopy } from "@/copy/identity-copy"
import type { TraitControls } from "./trait-controls"

export const identityControls: TraitControls<"identity"> = {
  section: identityCopy.section,
  fields: {
    name: { label: identityCopy.name },
    alt: { label: identityCopy.alt },
    hidden: { label: identityCopy.hidden },
    locked: { label: identityCopy.locked },
  },
}
