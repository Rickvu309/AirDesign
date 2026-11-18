import type { TraitWire } from "./trait-wire.js"

export const linkWire: TraitWire<"link"> = {
  description:
    "A whole text layer's click destination. Run links are separate. A deleted target becomes inactive until restored; duplicates retain the original destination, including self-links.",
  fields: {
    target: {
      description: "Safe URL, stable slide ID, or none to remove the click link. Omit to preserve imported actions.",
      example: { link: { target: { kind: "url", url: "https://example.com" } } },
    },
  },
}
