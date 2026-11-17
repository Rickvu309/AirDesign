export const picturePanelCopy = {
  mode: "Fill mode",
  section: "Picture",
  source: "Icon",
  recolor: "Recolor",
  overlay: "Overlay",
  blur: "Blur",
  overlayOpacity: "Overlay opacity",
  crop: "Crop",
} as const

export const pictureWords: Readonly<Record<string, string>> = {
  fill: "Fill",
  fit: "Fit",
  crop: "Crop",
  tile: "Tile",
  stretch: "Stretch",
  grayscale: "Grayscale",
  duotone: "Duotone",
  dark: "Dark",
  light: "Light",
}
