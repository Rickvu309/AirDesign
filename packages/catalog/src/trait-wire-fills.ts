import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"
const black = "000000"
const white = "FFFFFF"

export const fillsWire: TraitWire<"fills"> = {
  description: "Shape fill or slide background. Image fields apply to image fills.",
  fields: {
    paint: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none"; "group" for the group's fill; a gradient (pos and focus in percent, angle in degrees); a pattern preset such as "dkDnDiag" with two colors; or an image such as a Lucide icon name.`,
      example: { fills: { paint: "accent2" } },
    },
    source: {
      description: "Lucide icon name. Unknown names return suggestions.",
      example: { fills: { source: "rocket" } },
    },
    mode: {
      description:
        "How the image sits: Fill covers, Fit contains, Crop uses crop, Tile repeats; Stretch keeps legacy distortion.",
      example: { fills: { mode: "fit" } },
    },
    crop: {
      description: "Percent cut from each edge. Keeps frame size.",
      example: { fills: { crop: { l: 10, t: 0, r: 10, b: 0 } } },
    },
    recolor: {
      description: "Grayscale or two replacement colors for dark and light tones.",
      example: { fills: { recolor: { duotone: { dark: "accent1", light: `#${white}` } } } },
    },
    overlay: {
      description: "A color or gradient laid over a photo or the other paints.",
      example: { fills: { overlay: `#${black} alpha 50` } },
    },
    blur: {
      description: "Image blur in percent.",
      example: { fills: { blur: 40 } },
    },
  },
}
