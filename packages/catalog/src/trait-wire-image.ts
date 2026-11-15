import type { TraitWire } from "./trait-wire.js"

const white = "FFFFFF"

export const imageWire: TraitWire<"image"> = {
  description: "A picture's source and colors. Its opacity is the change's opacity.",
  fields: {
    source: {
      description: "A Lucide icon name; an unknown name is refused with close names.",
      example: { image: { source: "rocket" } },
    },
    recolor: {
      description: "Gray tones, or two colors that replace its dark and light tones.",
      example: { image: { recolor: { duotone: { dark: "accent1", light: `#${white}` } } } },
    },
  },
}
