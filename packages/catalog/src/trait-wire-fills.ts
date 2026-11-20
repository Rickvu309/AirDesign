import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"
const black = "000000"
const white = "FFFFFF"

export const fillsWire: TraitWire<"fills"> = {
  description: "Shape fill or slide background. Image fields apply to image fills.",
  fields: {
    paint: {
      description: `Color like "accent1", "#${navy}" or "accent1 lumMod 75"; "none"; "group" inherits the group fill; gradient (pos and focus %, angle degrees); pattern like "dkDnDiag"; image by Lucide icon name.`,
      example: { fills: { paint: "accent2" } },
    },
    source: {
      description: "Lucide icon name.",
      example: { fills: { source: "rocket" } },
    },
    weight: {
      description: "Icon line weight on Lucide's 24 grid.",
      example: { fills: { weight: 1.5 } },
    },
    mode: {
      description: "Fill covers, Fit contains, Crop clips, Tile repeats, Stretch distorts.",
      example: { fills: { mode: "fit" } },
    },
    tileScale: {
      description: "Tile size as a percent of the original image.",
      example: { fills: { tileScale: 50 } },
    },
    crop: {
      description: "Percent cut from each edge.",
      example: { fills: { crop: { l: 10, t: 0, r: 10, b: 0 } } },
    },
    recolor: {
      description: "Grayscale or duotone replacement colors.",
      example: { fills: { recolor: { duotone: { dark: "accent1", light: `#${white}` } } } },
    },
    overlay: {
      description: "Color or gradient over the other paints.",
      example: { fills: { overlay: `#${black} alpha 50` } },
    },
    blur: {
      description: "Image blur in percent.",
      example: { fills: { blur: 40 } },
    },
  },
}
