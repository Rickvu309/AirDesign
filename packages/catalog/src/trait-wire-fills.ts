import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"
const black = "000000"
const white = "FFFFFF"

export const fillsWire: TraitWire<"fills"> = {
  description:
    "What fills a shape, or a slide's background: a color, gradient, pattern, image, none, or the group's fill. Image fields apply while an image fills it.",
  fields: {
    paint: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none"; "group" for the group's fill; a gradient (pos and focus in percent, angle in degrees); a pattern preset such as "dkDnDiag" with two colors; or an image such as a Lucide icon name.`,
      example: { fills: { paint: "accent2" } },
    },
    source: {
      description: "The image: a Lucide icon name; an unknown name is refused with close names.",
      example: { fills: { source: "rocket" } },
    },
    mode: {
      description:
        "How the image sits: Fill covers, Fit contains, Crop uses crop, Tile repeats; Stretch keeps legacy distortion.",
      example: { fills: { mode: "fit" } },
    },
    crop: {
      description: "Percent of the image cut from its left, top, right and bottom; the frame keeps its size.",
      example: { fills: { crop: { l: 10, t: 0, r: 10, b: 0 } } },
    },
    recolor: {
      description: "Gray tones, or two colors that replace the image's dark and light tones.",
      example: { fills: { recolor: { duotone: { dark: "accent1", light: `#${white}` } } } },
    },
    overlay: {
      description: "A color or gradient laid over a photo or the other paints.",
      example: { fills: { overlay: `#${black} alpha 50` } },
    },
    blur: {
      description: "How soft the image looks, in percent.",
      example: { fills: { blur: 40 } },
    },
  },
}
