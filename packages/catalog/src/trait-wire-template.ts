import type { TraitWire } from "./trait-wire.js"

export const templateWire: TraitWire<"template"> = {
  description:
    "A slide's template style. Keeps geometry, placeholders and explicit formatting. Other slides are unchanged.",
  fields: {
    id: {
      description: "A template id from read_deck.templates. Use a slide target.",
      example: { template: { id: "ppt/theme/theme2.xml" } },
    },
  },
}
