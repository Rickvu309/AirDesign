import type { TraitWire } from "./trait-wire.js"

export const identityWire: TraitWire<"identity"> = {
  description: "What the element is called and whether it shows.",
  fields: {
    name: { description: "Its name in PowerPoint's Selection Pane.", example: { identity: { name: "Launch icon" } } },
    alt: {
      description: "Alt text a screen reader reads.",
      example: { identity: { alt: "A rocket lifting off" } },
    },
    hidden: { description: "true hides it on the slide.", example: { identity: { hidden: true } } },
  },
}
