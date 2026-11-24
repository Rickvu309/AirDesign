export const picturePanelCopy = {
  mode: "Fill mode",
  weight: "Weight",
  color: "Color",
} as const

export const pictureWords = {
  fill: "Fill",
  fit: "Fit",
  crop: "Crop",
  tile: "Tile",
  stretch: "Stretch",
  grayscale: "Grayscale",
  duotone: "Duotone",
  dark: "Dark",
  light: "Light",
} as const satisfies Readonly<Record<string, string>>
