import type { TraitWire } from "./trait-wire.js"

const black = "000000"
const white = "FFFFFF"

export const imageWire: TraitWire<"image"> = {
  description: "An image's source and colors. Its opacity is the change's opacity.",
  fields: {
    mode: {
      description: "Fill covers, Fit contains, Crop uses crop.rect, Tile repeats; Stretch keeps legacy distortion.",
      example: { image: { mode: "fit" } },
    },
    source: {
      description: "A Lucide icon name; an unknown name is refused with close names.",
      example: { image: { source: "rocket" } },
    },
    recolor: {
      description: "Gray tones, or two colors that replace its dark and light tones.",
      example: { image: { recolor: { duotone: { dark: "accent1", light: `#${white}` } } } },
    },
    overlay: {
      description: "A color laid over the image. The color's own opacity is how strongly it covers the image.",
      example: { image: { overlay: { solid: `#${black} alpha 50` } } },
    },
    blur: {
      description: "How soft the image looks, in percent.",
      example: { image: { blur: 40 } },
    },
  },
}
