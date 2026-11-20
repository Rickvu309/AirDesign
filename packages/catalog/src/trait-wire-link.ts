import type { TraitWire } from "./trait-wire.js"

export const linkWire: TraitWire<"link"> = {
  description: "A whole text layer's click destination; run links are separate.",
  fields: {
    target: {
      description: "Safe URL, slide ID, or none to remove it; omit to keep imported actions.",
      example: { link: { target: { kind: "url", url: "https://example.com" } } },
    },
  },
}
